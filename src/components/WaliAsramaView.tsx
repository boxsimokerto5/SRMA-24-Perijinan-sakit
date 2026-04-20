import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Clock, 
  User, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  Calendar, 
  Plus, 
  MapPin, 
  ClipboardList, 
  Activity, 
  Mail, 
  Search, 
  Menu, 
  ChevronRight, 
  Tablet,
  Check,
  Building,
  Users,
  AlertCircle,
  Send
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, HealthCheckProposal } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateHealthCheckProposalPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import { motion, AnimatePresence } from 'motion/react';

interface WaliAsramaViewProps {
  user: AppUser;
  activeTab: string;
}

export default function WaliAsramaView({ user, activeTab }: WaliAsramaViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

  const [viewMode, setViewMode] = useState<'perizinan' | 'cek_kesehatan' | 'memorandum'>('perizinan');
  const [showMenu, setShowMenu] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  
  // Health Check Proposal states
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [proposalNotes, setProposalNotes] = useState('');
  const [proposalHistory, setProposalHistory] = useState<HealthCheckProposal[]>([]);
  const [submittingProposal, setSubmittingProposal] = useState(false);

  const handleProcessProposal = async (id: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'health_check_proposals', id), {
        status: 'processed'
      });
      alert('Usulan telah ditandai selesai');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `health_check_proposals/${id}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Permits Watcher - Wali Asrama can see all permits but focus on their role
    const q = query(
      collection(db, 'izin_sakit'),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        kelas: normalizeKelas((doc.data() as any).kelas)
      } as IzinSakit));
      setPermits(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'izin_sakit');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'wali_asrama'),
      orderBy('tgl_memo', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'memorandums');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'siswa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() as Siswa,
        kelas: normalizeKelas((doc.data() as any).kelas)
      }))
      .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
      setStudents(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'health_check_proposals'),
      where('proposer_uid', '==', user.uid),
      orderBy('tgl_usulan', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProposalHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthCheckProposal)));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const filteredPermits = permits.filter(p => {
    const permitDate = p.tgl_surat?.toDate();
    if (!permitDate) return false;

    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(permitDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(permitDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(permitDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(permitDate);

    const matchesSearch = 
      p.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomor_surat.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch && matchesTime;
  });

  const handleSubmitProposal = async () => {
    if (selectedStudents.length === 0) {
      alert('Pilih setidaknya satu siswa');
      return;
    }
    setSubmittingProposal(true);
    try {
      await addDoc(collection(db, 'health_check_proposals'), {
        proposer_name: user.name,
        proposer_uid: user.uid,
        asrama: 'Asrama', // Should ideally come from user profile if available
        tgl_usulan: serverTimestamp(),
        daftar_siswa: selectedStudents,
        status: 'pending',
        keterangan: proposalNotes
      });

      notifyAllRoles(['dokter'], 'Usulan Cek Kesehatan Baru', `Wali Asrama ${user.name} mengusulkan pengecekan kesehatan untuk ${selectedStudents.length} siswa.`);
      
      setSelectedStudents([]);
      setProposalNotes('');
      alert('Usulan berhasil dikirim ke Dokter');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'health_check_proposals');
    } finally {
      setSubmittingProposal(false);
    }
  };

  const toggleStudentSelection = (name: string) => {
    setSelectedStudents(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const filteredStudents = students.filter(s => {
    const name = s.nama_lengkap || '';
    const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase());
    const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).sort()];

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-700 relative">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Halo, {user.name.split(' ')[0]}!</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Wali Asrama</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/60 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-4 z-50 overflow-hidden"
                >
                  <button
                    onClick={() => { setViewMode('perizinan'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'perizinan' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'perizinan' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    Riwayat Perizinan
                  </button>
                  <button
                    onClick={() => { setViewMode('cek_kesehatan'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'cek_kesehatan' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'cek_kesehatan' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    Usulan Cek Kesehatan
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {viewMode === 'perizinan' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
               <Search className="w-5 h-5 text-slate-400 ml-2" />
               <input 
                 type="text" 
                 placeholder="Cari nama siswa atau no surat..."
                 className="bg-transparent border-none outline-none text-sm font-medium w-full p-2"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    timeFilter === filter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
                <AnimatePresence>
                  {filteredPermits.map(permit => (
                    <motion.div
                      key={permit.id}
                      layout
                      className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                    >
                      <div className="flex items-center justify-between" onClick={() => setSelectedPermit(permit)}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${
                            permit.tipe === 'sakit' ? 'bg-rose-50 text-rose-600' : 
                            permit.tipe === 'umum' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {permit.tipe === 'sakit' ? <Activity className="w-5 h-5" /> : 
                             permit.tipe === 'umum' ? <Calendar className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight">{permit.nama_siswa}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{permit.kelas} • {permit.nomor_surat}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            permit.status === 'approved' || permit.status === 'acknowledged' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {permit.status}
                          </div>
                          {permit.tipe === 'sakit' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                generatePermitPDF(permit);
                              }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Cetak Surat Sakit"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
            {filteredPermits.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada riwayat ditemukan</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'cek_kesehatan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-black text-slate-900 font-display">Usulan Baru</h3>
               <div className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                 {selectedStudents.length} Siswa Terpilih
               </div>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      selectedClass === c
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredStudents.map(student => (
                  <div 
                    key={student.id}
                    onClick={() => toggleStudentSelection(student.nama_lengkap)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      selectedStudents.includes(student.nama_lengkap)
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${selectedStudents.includes(student.nama_lengkap) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {student.nama_lengkap.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{student.kelas}</p>
                      </div>
                    </div>
                    {selectedStudents.includes(student.nama_lengkap) ? (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan Tambahan (Opsional)</label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium min-h-[100px]"
                  placeholder="Misal: Siswa mengeluh pusing sejak pagi..."
                />
              </div>

              <button
                onClick={handleSubmitProposal}
                disabled={submittingProposal || selectedStudents.length === 0}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingProposal ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rotate-45" />}
                KIRIM USULAN KE DOKTER
              </button>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Riwayat Usulan Anda</h3>
                <AnimatePresence>
                  {proposalHistory.map(prop => (
                    <div key={prop.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                              <Activity className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {prop.tgl_usulan && typeof prop.tgl_usulan.toDate === 'function' ? format(prop.tgl_usulan.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                              </p>
                              <h4 className="font-bold text-slate-900">{prop.daftar_siswa.length} Siswa diusulkan</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             {prop.status === 'pending' && (
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleProcessProposal(prop.id!);
                                 }}
                                 disabled={loading}
                                 className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                               >
                                 <CheckCircle2 className="w-3.5 h-3.5" /> {loading ? '...' : 'Selesai'}
                               </button>
                             )}
                            <button
                              onClick={() => generateHealthCheckProposalPDF(prop)}
                              className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak
                            </button>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              prop.status === 'processed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {prop.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {prop.daftar_siswa.join(', ')}
                        </p>
                        {prop.keterangan && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex gap-2">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <p className="text-[10px] text-slate-500 font-bold">{prop.keterangan}</p>
                          </div>
                        )}
                    </div>
                  ))}
                </AnimatePresence>
             {proposalHistory.length === 0 && (
               <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                 <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada riwayat usulan</p>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Modal Detail Izin (View Only) */}
      <AnimatePresence>
        {selectedPermit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedPermit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600' : 
                    selectedPermit.tipe === 'umum' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {selectedPermit.tipe === 'sakit' ? <Activity className="w-5 h-5" /> : 
                     selectedPermit.tipe === 'umum' ? <Calendar className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">Detail Izin</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{selectedPermit.nomor_surat}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPermit(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</label>
                    <p className="font-black text-slate-900">{selectedPermit.nama_siswa}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                    <p className="font-black text-slate-900">{selectedPermit.kelas}</p>
                  </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {selectedPermit.tipe === 'sakit' ? 'Diagnosa' : 'Alasan'}
                   </label>
                   <p className="text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     {selectedPermit.tipe === 'sakit' ? selectedPermit.diagnosa : (selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.isi_catatan)}
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {selectedPermit.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                    <p className="text-[10px] font-bold text-slate-500">
                      {selectedPermit.tgl_surat && typeof selectedPermit.tgl_surat.toDate === 'function' ? format(selectedPermit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riwayat Tindakan</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                      selectedPermit.tindakan.map((t, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[9px] font-black text-indigo-600 uppercase">{t.oleh} ({t.peran})</span>
                          </div>
                          <p className="text-[11px] text-slate-700 font-medium">{t.pesan}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Belum ada tindakan tercatat</p>
                    )}
                  </div>
                </div>
              </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => setSelectedPermit(null)}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-[10px]"
                  >
                    Tutup
                  </button>
                  {selectedPermit.tipe === 'sakit' && (
                    <button
                      onClick={() => generatePermitPDF(selectedPermit)}
                      className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </button>
                  )}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
