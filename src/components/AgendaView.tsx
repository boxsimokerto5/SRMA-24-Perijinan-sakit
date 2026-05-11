import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp, serverTimestamp, where, or } from 'firebase/firestore';
import { Agenda, AppUser, UserRole } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Plus, X, Clock, User, Trash2, CheckSquare, Square, ChevronRight } from 'lucide-react';
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
};

export default function AgendaView({ user }: AgendaViewProps) {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (user.role === 'wali_asuh' || user.role === 'wali_asrama') {
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight font-display">Agenda Kegiatan</h2>
          <p className="text-slate-500 font-medium">Monitoring dan penjadwalan kegiatan sekolah</p>
        </div>
        {user.role !== 'kepala_sekolah' && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 text-sm"
          >
            <Plus className="w-5 h-5" />
            Agenda Baru
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold">Memuat agenda...</p>
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
            <CalendarIcon className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Belum Ada Agenda</h3>
            <p className="text-slate-500">Saat ini tidak ada agenda kegiatan yang terdaftar.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agendas.map((agenda) => {
            const agendaDate = agenda.date.toDate();
            const isToday = format(agendaDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <motion.div
                key={agenda.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl shadow-sm border ${isToday ? 'border-indigo-200 ring-2 ring-indigo-50' : 'border-slate-100'} overflow-hidden flex flex-col hover:shadow-md transition-all`}
              >
                <div className={`p-4 ${isToday ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-700'} flex items-center justify-between`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CalendarIcon className="w-4 h-4" />
                    {format(agendaDate, 'EEEE, dd MMMM yyyy', { locale: id })}
                  </div>
                  {isToday && (
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                      Hari Ini
                    </span>
                  )}
                </div>
                
                <div className="p-6 flex-1 space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">{agenda.title}</h3>
                    {agenda.description && (
                      <p className="text-slate-600 mt-2 text-sm leading-relaxed whitespace-pre-wrap">{agenda.description}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                        {agenda.author_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">{agenda.author_name}</p>
                        <p className="text-[10px]">{agenda.author_role.replace('_', ' ').toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {agenda.sharedWith.map(role => (
                        <span key={role} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                          {ROLE_LABELS[role] || role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {(user.role === 'kepala_sekolah' || agenda.author_uid === user.uid) && (
                  <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex justify-end">
                    <button
                      onClick={() => agenda.id && handleDelete(agenda.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Hapus Agenda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-white relative">
                <button 
                  onClick={() => !isSubmitting && setIsAdding(false)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-display">Buat Agenda Baru</h3>
                <p className="text-indigo-100 opacity-80">Jadwalkan kegiatan dan atur visibilitas.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Judul Agenda</label>
                    <input
                      type="text"
                      required
                      value={newAgenda.title}
                      onChange={e => setNewAgenda(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Contoh: Rapat Koordinasi Bulanan"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={newAgenda.date}
                      onChange={e => setNewAgenda(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Keterangan / Deskripsi</label>
                    <textarea
                      value={newAgenda.description}
                      onChange={e => setNewAgenda(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Tuliskan deskripsi agenda di sini..."
                      rows={3}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tampilkan ke Menu:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(role)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                            newAgenda.sharedWith.includes(role)
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                              : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {newAgenda.sharedWith.includes(role) ? (
                            <CheckSquare className="w-5 h-5 flex-shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 flex-shrink-0" />
                          )}
                          <span className="font-bold text-xs">{ROLE_LABELS[role]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Agenda'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    disabled={isSubmitting}
                    className="px-8 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Batal
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
