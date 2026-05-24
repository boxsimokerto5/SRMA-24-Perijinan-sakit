import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp, serverTimestamp, where, or } from 'firebase/firestore';
import { Agenda, AppUser, UserRole } from '../types';
import { format, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Plus, X, Clock, User, Trash2, CheckSquare, Square, ChevronRight, Loader2 } from 'lucide-react';
import { notifyAllRoles } from '../services/fcmService';

interface AgendaViewProps {
  user: AppUser;
}

const ROLE_LABELS: Record<string, string> = {
  wali_kelas: 'Wali Kelas',
  guru_mapel: 'Guru Mapel',
  wali_asuh: 'Wali Asuh',
  wali_asrama: 'Wali Asrama',
  dokter: 'Dokter',
  kepala_sekolah: 'Kepala Sekolah',
};

export default function AgendaView({ user }: AgendaViewProps) {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'semua' | 'minggu_ini' | 'bulan_ini'>('semua');

  const weeklyAgendas = agendas.filter(a => {
    const date = a.date?.toDate ? a.date.toDate() : (a.date instanceof Date ? a.date : null);
    return date ? isThisWeek(date, { weekStartsOn: 1 }) : false;
  });

  const monthlyAgendas = agendas.filter(a => {
    const date = a.date?.toDate ? a.date.toDate() : (a.date instanceof Date ? a.date : null);
    return date ? isThisMonth(date) : false;
  });

  const filteredAgendas = agendas.filter(a => {
    const date = a.date?.toDate ? a.date.toDate() : (a.date instanceof Date ? a.date : null);
    if (!date) return true;
    if (timeFilter === 'minggu_ini') return isThisWeek(date, { weekStartsOn: 1 });
    if (timeFilter === 'bulan_ini') return isThisMonth(date);
    return true;
  });

  // New Agenda Form State
  const [newAgenda, setNewAgenda] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    sharedWith: [] as UserRole[],
  });

  // Set default visibility based on user role
  useEffect(() => {
    if (isAdding) {
      let defaults: UserRole[] = [];
      if (user.role === 'kepala_sekolah') {
        defaults = Object.keys(ROLE_LABELS) as UserRole[];
      } else if (user.role === 'wali_asuh' || user.role === 'wali_asrama') {
        defaults = ['wali_asuh', 'wali_asrama'];
      } else if (user.role === 'wali_kelas' || user.role === 'guru_mapel') {
        defaults = ['wali_kelas', 'guru_mapel'];
      } else {
        defaults = [user.role];
      }
      setNewAgenda(prev => ({ ...prev, sharedWith: defaults }));
    }
  }, [isAdding, user.role]);

  useEffect(() => {
    let q;
    if (user.role === 'kepala_sekolah') {
      q = query(collection(db, 'agendas'), orderBy('date', 'asc'));
    } else {
      q = query(
        collection(db, 'agendas'),
        or(
          where('author_uid', '==', user.uid),
          where('sharedWith', 'array-contains', user.role)
        ),
        orderBy('date', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allAgendas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Agenda));

      setAgendas(allAgendas);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agendas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.role, user.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgenda.title || !newAgenda.date || newAgenda.sharedWith.length === 0) {
      alert('Harap isi judul, tanggal, dan pilih minimal satu target menu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const agendaData = {
        title: newAgenda.title,
        description: newAgenda.description,
        date: Timestamp.fromDate(new Date(newAgenda.date)),
        author_name: user.name || user.email,
        author_uid: user.uid,
        author_role: user.role,
        sharedWith: newAgenda.sharedWith,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'agendas'), agendaData);
      
      // Notify target roles
      notifyAllRoles(newAgenda.sharedWith, 'Agenda Baru', `${user.name} menambahkan agenda baru: ${newAgenda.title}`);

      setIsAdding(false);
      setNewAgenda({ title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), sharedWith: [] });
      alert('Agenda berhasil ditambahkan!');
    } catch (err) {
      console.error('Failed to add agenda:', err);
      alert('Gagal menambahkan agenda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus agenda ini?')) return;
    try {
      await deleteDoc(doc(db, 'agendas', id));
    } catch (err) {
      console.error('Failed to delete agenda:', err);
    }
  };

  const toggleRole = (role: UserRole) => {
    setNewAgenda(prev => ({
      ...prev,
      sharedWith: prev.sharedWith.includes(role)
        ? prev.sharedWith.filter(r => r !== role)
        : [...prev.sharedWith, role]
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* 7:16 Horizontal Brown Header */}
      <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
              <CalendarIcon className="w-6 h-6 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Agenda Kegiatan</h1>
                <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                  AGENDA
                </span>
              </div>
              <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-80">
                MONITORING DAN PENJADWALAN KEGIATAN SEKOLAH &amp; ASRAMA
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-[#d7ccc8] hover:bg-[#b0bdc4] text-[#3e2723] px-4 py-2 rounded-xl font-black shadow-lg transition-all active:scale-95 text-[10px] uppercase tracking-widest italic shrink-0"
          >
            <Plus className="w-4 h-4" />
            AGENDA BARU
          </button>
        </div>
      </div>

      {/* Weekly and Monthly Agenda summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8d6e63] opacity-70" />
          <div>
            <div className="flex items-center justify-between mb-2 pl-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8d6e63] animate-pulse" />
                <span className="text-[8px] font-black text-[#5d4037] tracking-wider uppercase italic">MUTASI AGENDA MINGGUAN</span>
              </div>
              <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Minggu Ini</span>
            </div>

            <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Kegiatan Terjadwal</h4>
            <div className="bg-[#fcfaf6] p-4 rounded-xl border border-stone-100/60 flex items-center justify-between pl-2 mb-2">
              <div>
                <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">TOTAL KEGIATAN</span>
                <span className="text-2xl font-black text-[#5d4037] leading-tight mt-1">{weeklyAgendas.length} Agenda</span>
              </div>
              <button 
                onClick={() => setTimeFilter('minggu_ini')}
                className={`px-3 py-1 bg-[#3e2723] hover:bg-[#5d4037] text-white text-[8px] font-extrabold rounded-lg uppercase tracking-wide transition-all ${timeFilter === 'minggu_ini' ? 'ring-2 ring-amber-300' : ''}`}
              >
                Lihat Detail
              </button>
            </div>
          </div>
        </div>

        {/* Monthly card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#5d4037] opacity-70" />
          <div>
            <div className="flex items-center justify-between mb-2 pl-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#5d4037] animate-pulse" />
                <span className="text-[8px] font-black text-[#5d4037] tracking-wider uppercase italic">MUTASI AGENDA BULANAN</span>
              </div>
              <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Bulan Ini</span>
            </div>

            <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Rekapitulasi Bulanan</h4>
            <div className="bg-[#fcfaf6] p-4 rounded-xl border border-stone-100/60 flex items-center justify-between pl-2 mb-2">
              <div>
                <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">TOTAL KEGIATAN</span>
                <span className="text-2xl font-black text-[#3e2723] leading-tight mt-1">{monthlyAgendas.length} Agenda</span>
              </div>
              <button 
                onClick={() => setTimeFilter('bulan_ini')}
                className={`px-3 py-1 bg-[#3e2723] hover:bg-[#5d4037] text-white text-[8px] font-extrabold rounded-lg uppercase tracking-wide transition-all ${timeFilter === 'bulan_ini' ? 'ring-2 ring-amber-300' : ''}`}
              >
                Lihat Detail
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Time Filters bar inline style */}
      <div className="flex bg-white p-2.5 rounded-xl border border-stone-100 shadow-sm justify-between sm:justify-start gap-2 items-center w-full">
        <div className="text-[9px] font-black text-stone-400 uppercase tracking-widest italic ml-2 hidden sm:block">
          FILTER PERIODE AGENDA
        </div>
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto ml-auto">
          {(['semua', 'minggu_ini', 'bulan_ini'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all italic border-b-2 hover:scale-[1.02] active:scale-[0.98] ${
                timeFilter === filter 
                  ? 'bg-[#3e2723] text-amber-200 border-stone-600 shadow-md scale-105 font-bold' 
                  : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100'
              }`}
            >
              {filter === 'semua' ? 'SEMUA AGENDA' : filter === 'minggu_ini' ? 'MINGGU INI' : 'BULAN INI'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-stone-100 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#3e2723] animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] italic text-[10px]">Memuat agenda...</p>
        </div>
      ) : filteredAgendas.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-dashed border-stone-200 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-stone-50 rounded-xl flex items-center justify-center text-stone-300 border border-stone-100">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-[#3e2723] italic uppercase font-display">Belum Ada Agenda</h3>
            <p className="text-stone-400 font-bold text-[9px] uppercase tracking-widest italic leading-none">Saat ini tidak ada agenda kegiatan untuk filter ini.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAgendas.map((agenda, idx) => {
            const agendaDate = agenda.date.toDate();
            const isToday = format(agendaDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <motion.div
                key={agenda.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`group bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md flex flex-col sm:flex-row overflow-hidden relative text-left ${
                  isToday ? 'border-[#8d6e63] ring-1 ring-[#8d6e63]/25' : 'border-stone-100 hover:border-stone-200'
                }`}
              >
                {/* Left zone: 7:16 Horizontal Banner feel with warm brown theme */}
                <div className="w-full sm:w-44 shrink-0 bg-[#3e2723] text-[#d7ccc8] p-4 flex flex-col justify-center items-center relative select-none">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
                  
                  <div className="relative z-10 text-center space-y-1">
                    <span className="text-[8px] font-black text-amber-200 tracking-widest uppercase block">
                      {format(agendaDate, 'EEEE', { locale: id })}
                    </span>
                    <span className="text-3xl font-black font-display text-white tracking-tight leading-none block">
                      {format(agendaDate, 'dd')}
                    </span>
                    <span className="text-[9px] font-black text-amber-100/70 tracking-widest uppercase block">
                      {format(agendaDate, 'MMMM yyyy', { locale: id })}
                    </span>
                  </div>

                  {isToday && (
                    <span className="absolute top-2 right-2 bg-amber-400 text-[#3e2723] text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider italic">
                      HARI INI
                    </span>
                  )}
                </div>
                
                {/* Right zone: Content & Actions */}
                <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-extrabold text-[#3e2723] leading-snug uppercase tracking-tight font-display">{agenda.title}</h3>
                      {(user.role === 'kepala_sekolah' || agenda.author_uid === user.uid) && (
                        <button
                          onClick={() => agenda.id && handleDelete(agenda.id)}
                          className="p-1 px-1.5 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all shrink-0 self-start"
                          title="Hapus Agenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {agenda.description && (
                      <p className="text-stone-500 mt-2 text-xs font-medium leading-relaxed italic whitespace-pre-wrap">{agenda.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-xs">
                        {agenda.author_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-[#3e2723] text-[10px] italic leading-none">{agenda.author_name}</p>
                        <p className="text-[7px] font-bold text-stone-400 uppercase tracking-widest italic mt-0.5">{agenda.author_role.replace('_', ' ')}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {agenda.sharedWith.map(role => (
                        <span key={role} className="text-[7px] bg-stone-50 text-stone-400 px-2.5 py-0.5 rounded font-black uppercase tracking-widest border border-stone-100 transition-all italic">
                          {ROLE_LABELS[role] || role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Agenda Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-900 p-8 text-white flex items-center justify-between relative">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg italic">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase font-display leading-none">Buat Agenda Baru</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mt-1">Tambahkan jadwal kegiatan</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isSubmitting && setIsAdding(false)}
                  className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all relative z-10 active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic text-left">Judul Agenda</label>
                    <input
                      type="text"
                      required
                      value={newAgenda.title}
                      onChange={(e) => setNewAgenda(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Masukkan judul agenda..."
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-900 text-sm italic placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic text-left">Tanggal</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      <input
                        type="date"
                        required
                        value={newAgenda.date}
                        onChange={(e) => setNewAgenda(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-16 pr-6 py-4 focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-900 text-sm italic"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic text-left">Deskripsi (Opsional)</label>
                    <textarea
                      value={newAgenda.description}
                      onChange={(e) => setNewAgenda(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Tambahkan detail kegiatan..."
                      rows={4}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-[2rem] px-6 py-5 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 text-sm italic placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic text-left">Tampilkan Ke Menu</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setNewAgenda(prev => ({
                              ...prev,
                              sharedWith: prev.sharedWith.includes(role)
                                ? prev.sharedWith.filter(r => r !== role)
                                : [...prev.sharedWith, role]
                            }));
                          }}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                            newAgenda.sharedWith.includes(role)
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 italic shadow-sm'
                            : 'bg-white border-slate-50 text-slate-400 italic hover:border-slate-100'
                          }`}
                        >
                          <div className={`p-1 rounded-md ${newAgenda.sharedWith.includes(role) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-200'}`}>
                            {newAgenda.sharedWith.includes(role) ? <CheckSquare className="w-4 h-4 shadow-sm" /> : <Square className="w-4 h-4" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest italic">{ROLE_LABELS[role]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 p-2 bg-slate-50 rounded-[2rem] border border-slate-50 italic">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all italic"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 border-b-4 border-indigo-800 italic"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Simpan Agenda
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
