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
  Send,
  ShieldCheck,
  GraduationCap,
  LogOut,
  LayoutDashboard,
  IdCard,
  Database,
  BookOpen,
  MessageSquare,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, HealthCheckProposal, SarprasReport } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateHealthCheckProposalPDF, generateSarprasReportPDF, generateSarprasSummaryPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import WallView from './WallView';
import EvaluationNotesView from './EvaluationNotesView';
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

  const [viewMode, setViewMode] = useState<'perizinan' | 'cek_kesehatan' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'sarpras' | 'agenda' | 'dinding' | 'catatan_evaluasi'>('perizinan');
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Sarpras states
  const [sarprasReports, setSarprasReports] = useState<SarprasReport[]>([]);
  const [sarprasFilter, setSarprasFilter] = useState<'minggu_ini' | 'bulan_ini' | 'semua'>('minggu_ini');
  const [isAddingSarpras, setIsAddingSarpras] = useState(false);
  const [newSarpras, setNewSarpras] = useState({
    item_name: '',
    damage_description: '',
    location: '',
    asrama: ''
  });
  const [submittingSarpras, setSubmittingSarpras] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
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

  useEffect(() => {
    const q = query(
      collection(db, 'sarpras_reports'),
      orderBy('tgl_lapor', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSarprasReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SarprasReport)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sarpras_reports');
    });
    return () => unsubscribe();
  }, []);

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

  const handleSubmitSarpras = async () => {
    if (!newSarpras.item_name || !newSarpras.damage_description || !newSarpras.location || !newSarpras.asrama) {
      alert('Mohon lengkapi semua data laporan');
      return;
    }
    setSubmittingSarpras(true);
    try {
      await addDoc(collection(db, 'sarpras_reports'), {
        ...newSarpras,
        author_name: user.name,
        author_uid: user.uid,
        tgl_lapor: serverTimestamp(),
        status: 'pending'
      });

      notifyAllRoles(['kepala_sekolah', 'wali_asuh'], 'Laporan Kerusakan Sarpras Baru', `Wali Asrama ${user.name} melaporkan adanya kerusakan sarana & prasarana.`);
      
      setNewSarpras({
        item_name: '',
        damage_description: '',
        location: '',
        asrama: ''
      });
      setIsAddingSarpras(false);
      alert('Laporan berhasil dikirim');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sarpras_reports');
    } finally {
      setSubmittingSarpras(false);
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

  const viewTitles: Record<string, string> = {
    perizinan: 'Riwayat Perizinan',
    cek_kesehatan: 'Usulan Cek Kesehatan',
    memorandum: 'Memorandum',
    pangkalan_data: 'Pangkalan Data Wali Asuh',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Kegiatan',
    dinding: 'Dinding Wali Asrama',
    sarpras: 'Sarana & Prasarana',
    catatan_evaluasi: 'Catatan Evaluasi'
  };

  const navItems = [
    { id: 'perizinan', label: 'Perizinan', icon: ClipboardList },
    { id: 'cek_kesehatan', label: 'Usulan Cek', icon: Activity },
    { id: 'catatan_evaluasi', label: 'Evaluasi', icon: ClipboardList },
    { id: 'pangkalan_data', label: 'Pangkalan Data', icon: Tablet },
    { id: 'memorandum', label: 'Memorandum', icon: Mail },
    { id: 'profil', label: 'Profil Saya', icon: User }
  ];

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      dokter: 'Dokter',
      wali_asuh: 'Wali Asuh',
      wali_kelas: 'Wali Kelas',
      kepala_sekolah: 'Kepala Sekolah',
      guru_mapel: 'Guru Mapel',
      wali_asrama: 'Wali Asrama'
    };
    return labels[role] || role;
  };

  const features = [
    'Monitoring Kehadiran & Kepulangan Siswa',
    'Review Riwayat Perizinan Siswa',
    'Review & Verifikasi Memorandum',
    'Pengajuan Usulan Cek Kesehatan (Cek-UP)',
    'Pangkalan Data Siswa Terpadu',
    'Berbagi Catatan di Mading Sekolah'
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#075e6e] text-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  <div className="bg-[#085a6a] rounded-3xl p-5 mb-8 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight">SRMA 24 KEDIRI</span>
                        <span className="text-[10px] font-bold text-cyan-200 uppercase tracking-widest mt-0.5 opacity-70">SEKOLAH RAKYAT</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <p className="text-[10px] font-black text-cyan-100/40 uppercase tracking-[0.2em] mb-4 px-2">HOME</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'perizinan', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'agenda', label: 'Agenda Kegiatan', icon: Calendar },
                          { id: 'dinding', label: 'Dinding Wali Asrama', icon: MessageSquare },
                          { id: 'catatan_evaluasi', label: 'Catatan Evaluasi', icon: ClipboardList },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'cek_kesehatan', label: 'Usulan Cek Kesehatan', icon: Activity },
                          { id: 'sarpras', label: 'Sarana & Prasarana', icon: Wrench },
                          { id: 'pangkalan_data', label: 'Pangkalan Data', icon: Database },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
                          { id: 'profil', label: 'Profil Saya', icon: User }
                        ].map((item: any) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setViewMode(item.id);
                              setShowSidebar(false);
                            }}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black transition-all duration-300 ${
                              viewMode === item.id 
                                ? 'bg-white text-[#075e6e] shadow-xl shadow-black/10' 
                                : 'bg-transparent text-white/70 hover:bg-[#085a6a] hover:text-white'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-[#075e6e]' : 'text-white/40'}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-100/60'} backdrop-blur-xl border-b shadow-[0_4px_20px_rgb(0,0,0,0.03)]`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#075e6e]">
              {viewTitles[viewMode] || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-500'} transition-all`}
            >
              {isDarkMode ? <Activity className="w-5 h-5" /> : <Activity className="w-5 h-5 rotate-180" />}
            </button>
          </div>
        </div>
      </header>

      <main className={`p-6 ${viewMode === 'mading' || viewMode === 'dinding' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'dinding' && <WallView user={user} wallType="asrama" title="Dinding Wali Asrama" />}
        {viewMode === 'catatan_evaluasi' && <EvaluationNotesView user={user} />}

        {viewMode === 'perizinan' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#075e6e] to-[#0a8ea4] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <h1 className="text-3xl font-black font-display tracking-tight mb-2">Hallo, {user.name || user.email}</h1>
                <p className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
                  <ShieldCheck className="w-5 h-5" />
                  {getRoleLabel(user.role || 'wali_asrama')}
                </p>
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-50 mb-4 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Daftar Fitur Akun:
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {features.map((f, i) => (
                      <motion.li 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 text-sm font-semibold text-white/95"
                      >
                        <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                        {f}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
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

      {viewMode === 'pangkalan_data' && (
        <div className="h-[calc(100vh-180px)] w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/60 animate-in fade-in zoom-in-95 duration-500">
           <iframe 
             src="https://app.box.com/s/3ogn8xtw84he8uxb1yfnvum9mgwpc7db"
             className="w-full h-full border-none"
             title="Pangkalan Data Wali Asuh"
             allow="autoplay; fullscreen"
           />
        </div>
      )}

      {viewMode === 'sarpras' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h3 className="text-lg font-black text-slate-900 font-display">Laporan Sarana & Prasarana</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Kelola dan Rekap Laporan Kerusakan</p>
               </div>
               <div className="flex items-center gap-2">
                 <select 
                   value={sarprasFilter}
                   onChange={(e) => setSarprasFilter(e.target.value as any)}
                   className="px-4 py-2.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-display"
                 >
                   <option value="minggu_ini">Minggu Ini</option>
                   <option value="bulan_ini">Bulan Ini</option>
                   <option value="semua">Semua Laporan</option>
                 </select>
                 <button
                   onClick={() => {
                     const filtered = sarprasReports.filter(r => {
                       const date = r.tgl_lapor?.toDate();
                       if (!date) return false;
                       if (sarprasFilter === 'minggu_ini') return isThisWeek(date);
                       if (sarprasFilter === 'bulan_ini') return isThisMonth(date);
                       return true;
                     });
                     generateSarprasSummaryPDF(filtered, sarprasFilter, { name: user.name, role: user.role });
                   }}
                   className="px-6 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                 >
                   <Printer className="w-3.5 h-3.5" />
                   Rekap Laporan
                 </button>
                 <button 
                   onClick={() => setIsAddingSarpras(!isAddingSarpras)}
                   className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                     isAddingSarpras ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                   }`}
                 >
                   {isAddingSarpras ? 'Batal' : 'Laporan Baru'}
                 </button>
               </div>
            </div>

            {isAddingSarpras && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Barang / Sarana</label>
                    <input
                      type="text"
                      value={newSarpras.item_name}
                      onChange={(e) => setNewSarpras({...newSarpras, item_name: e.target.value})}
                      placeholder="Contoh: AC Kamar, Pintu Kamar Mandi, dsb"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lokasi Detail</label>
                    <input
                      type="text"
                      value={newSarpras.location}
                      onChange={(e) => setNewSarpras({...newSarpras, location: e.target.value})}
                      placeholder="Contoh: Kamar 10, Lobby Lt.2, dsb"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Asrama</label>
                    <select
                      value={newSarpras.asrama}
                      onChange={(e) => setNewSarpras({...newSarpras, asrama: e.target.value})}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    >
                      <option value="">Pilih Asrama</option>
                      <option value="Asrama Putra">Asrama Putra</option>
                      <option value="Asrama Putri">Asrama Putri</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Deskripsi Kerusakan</label>
                    <textarea
                      value={newSarpras.damage_description}
                      onChange={(e) => setNewSarpras({...newSarpras, damage_description: e.target.value})}
                      placeholder="Jelaskan detail kerusakan yang terjadi..."
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm h-[115px]"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={handleSubmitSarpras}
                    disabled={submittingSarpras}
                    className="w-full py-5 bg-[#075e6e] text-white font-black rounded-2xl shadow-xl shadow-cyan-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submittingSarpras ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rotate-45" />}
                    KIRIM LAPORAN KERUSAKAN
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Riwayat Laporan Sarpras</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sarprasReports.map((report) => (
                  <div key={report.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4 relative group hover:bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-500">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className={`p-3 rounded-2xl ${
                          report.status === 'fixed' ? 'bg-emerald-50 text-emerald-600' :
                          report.status === 'on_progress' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? format(report.tgl_lapor.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                          </p>
                          <h4 className="font-bold text-slate-900">{report.item_name}</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{report.location} • {report.asrama}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateSarprasReportPDF(report)}
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                          title="Cetak Laporan"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          report.status === 'fixed' ? 'bg-emerald-100 text-emerald-700' :
                          report.status === 'on_progress' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 flex gap-3">
                       <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                       <p className="text-xs text-slate-600 leading-relaxed font-bold italic line-clamp-2">
                         "{report.damage_description}"
                       </p>
                    </div>
                  </div>
                ))}
              </div>
              {sarprasReports.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada laporan kerusakan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'memorandum' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 gap-4">
            {memos.map(memo => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.01, x: 4 }}
                onClick={() => setSelectedMemo(memo)}
                className="group flex items-center gap-5 p-5 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-[#075e6e] transition-all cursor-pointer"
              >
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center shrink-0 group-hover:bg-[#075e6e] group-hover:text-white transition-colors border border-slate-100">
                  <Mail className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate font-display italic">{memo.perihal}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari: {memo.pengirim_name}</span>
                    <span className="text-slate-200">•</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                      {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-[#075e6e] transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] italic">Belum ada memorandum masuk</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>

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
                  {(selectedPermit.tipe === 'sakit' || selectedPermit.tipe === 'umum' || selectedPermit.tipe === 'catatan') && (
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

      <AnimatePresence>
        {selectedMemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 bg-[#075e6e] text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tight uppercase">Memorandum Intern</h3>
                    <p className="text-[10px] font-bold text-cyan-100/60 tracking-widest">{selectedMemo.nomor_memo}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMemo(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pengirim</label>
                    <p className="font-black text-slate-900 text-lg">{selectedMemo.pengirim_name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</label>
                    <p className="font-bold text-slate-600">
                      {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'EEEE, dd MMM yyyy') : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Perihal</label>
                  <p className="text-xl font-black text-[#075e6e] font-display italic">
                    {selectedMemo.perihal}
                  </p>
                </div>

                <div className="space-y-3 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Isi Instruksi</label>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMemo.isi}
                  </p>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => setSelectedMemo(null)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                >
                  Selesai Membaca
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
