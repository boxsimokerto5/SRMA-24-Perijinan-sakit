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
  Smartphone,
  History,
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
  AlertTriangle,
  Info,
  Bell,
  BarChart3,
  X,
  FileText,
  PieChart,
  Target,
  FileSearch,
  Settings,
  Trash2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp, limit, deleteDoc } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, Announcement, ProgressRecord, UserRole } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateMemorandumPDF, generateSummaryReportPDF } from '../pdfUtils';
import MadingSekolahView from './MadingSekolahView';
import ProfileView from './ProfileView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import { motion, AnimatePresence } from 'motion/react';

interface KepalaSekolahViewProps {
  user: AppUser;
  activeTab: string;
}

export default function KepalaSekolahView({ user, activeTab }: KepalaSekolahViewProps) {
  const [viewMode, setViewMode] = useState<'beranda' | 'statistik' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'announcements' | 'perizinan_global'>('beranda');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSiswa: 0,
    totalIzinBulanIni: 0,
    totalCatatan: 0,
    activeAnnouncements: 0
  });

  const [recentPermits, setRecentPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [perizinanSearch, setPerizinanSearch] = useState('');
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  
  // Memorandum Form State
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [memoSubject, setMemoSubject] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoRecipients, setMemoRecipients] = useState<UserRole[]>([]);
  const [isSubmittingMemo, setIsSubmittingMemo] = useState(false);
  const [memoSearch, setMemoSearch] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'siswa'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa)));
      setStats(prev => ({ ...prev, totalSiswa: snap.size }));
    });

    const unsubPermits = onSnapshot(query(collection(db, 'izin_sakit'), orderBy('tgl_surat', 'desc')), (snap) => {
      setPermits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit)));
      setRecentPermits(snap.docs.slice(0, 10).map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit)));
    });

    const unsubMemos = onSnapshot(query(collection(db, 'memorandums'), orderBy('tgl_memo', 'desc')), (snap) => {
      setMemos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum)));
    });

    const unsubAnn = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
      setStats(prev => ({ ...prev, activeAnnouncements: snap.size }));
    });

    return () => {
      unsubStudents();
      unsubPermits();
      unsubMemos();
      unsubAnn();
    };
  }, []);

  const formatRealTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date).replace(/\./g, ':');
  };

  const viewTitles: Record<string, string> = {
    beranda: 'Pusat Kendali SRMA 24',
    statistik: 'Monitoring Statistik',
    memorandum: 'Kelola Memorandum',
    pangkalan_data: 'Arsip Data Santri',
    profil: 'Profil Pimpinan',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Strategis',
    announcements: 'Kelola Pengumuman',
    perizinan_global: 'Log Perizinan Global'
  };

  const handleCreateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoSubject || !memoContent || memoRecipients.length === 0) {
      alert('Mohon lengkapi semua field dan pilih minimal satu penerima.');
      return;
    }

    setIsSubmittingMemo(true);
    try {
      const newMemo: Omit<Memorandum, 'id'> = {
        nomor_memo: `MEMO/${format(new Date(), 'yyyy/MM/dd')}/${Math.floor(Math.random() * 1000)}`,
        perihal: memoSubject,
        isi: memoContent,
        tgl_memo: Timestamp.now(),
        penerima: memoRecipients,
        pengirim_name: user.name,
        pengirim_uid: user.uid
      };

      await addDoc(collection(db, 'memorandums'), newMemo);
      
      // Notify recipients
      await notifyAllRoles(
        memoRecipients,
        'Memorandum Baru',
        `Pimpinan menerbitkan memorandum baru: ${memoSubject}`
      );

      setMemoSubject('');
      setMemoContent('');
      setMemoRecipients([]);
      setShowMemoForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'memorandums');
    } finally {
      setIsSubmittingMemo(false);
    }
  };

  const handleDeleteMemo = async (e: React.MouseEvent, memoId: string) => {
    e.stopPropagation();
    if (!window.confirm('Apakah Anda yakin ingin menghapus memorandum ini?')) return;
    
    try {
      await deleteDoc(doc(db, 'memorandums', memoId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'memorandums');
    }
  };

  const toggleRecipient = (role: UserRole) => {
    if (memoRecipients.includes(role)) {
      setMemoRecipients(prev => prev.filter(r => r !== role));
    } else {
      setMemoRecipients(prev => [...prev, role]);
    }
  };

  const selectAllRoles = () => {
    const allRoles: UserRole[] = ['dokter', 'wali_asuh', 'wali_kelas', 'guru_mapel', 'wali_asrama'];
    setMemoRecipients(allRoles);
  };

  const filteredMemos = memos.filter(m => 
    m.perihal.toLowerCase().includes(memoSearch.toLowerCase()) ||
    m.isi.toLowerCase().includes(memoSearch.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950 text-amber-50' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans antialiased selection:bg-[#3e2723] selection:text-white`}>
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
              className={`fixed inset-y-0 left-0 w-[320px] z-[70] shadow-2xl flex flex-col ${isDarkMode ? 'bg-stone-900 border-white/5' : 'bg-white border-stone-100'}`}
            >
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className={`rounded-[3rem] p-8 mb-10 border shadow-2xl relative overflow-hidden group ${isDarkMode ? 'bg-stone-950 border-white/5' : 'bg-[#fcfaf6] border-stone-200'}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#3e2723]/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-transform" />
                  <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                    <div className="w-20 h-20 bg-[#3e2723] rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-black/20 -rotate-3 transition-transform group-hover:rotate-0">
                      <GraduationCap className="w-10 h-10 text-amber-200" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight italic uppercase leading-none font-display">Kepala Sekolah</h2>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mt-3 opacity-60 italic">SRMA 24 KEDIRI</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'beranda', label: 'Pusat Kendali', icon: LayoutDashboard },
                    { id: 'statistik', label: 'Monitor Analitik', icon: BarChart3 },
                    { id: 'pangkalan_data', label: 'Arsip Santri', icon: Database },
                    { id: 'perizinan_global', label: 'Log Perizinan', icon: ClipboardList },
                    { id: 'agenda', label: 'Agenda Strategis', icon: Calendar },
                    { id: 'announcements', label: 'Pengumuman', icon: Bell },
                    { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                    { id: 'memorandum', label: 'Memorandum', icon: Mail },
                    { id: 'profil', label: 'Profil Saya', icon: User }
                  ].map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setViewMode(item.id);
                        setShowSidebar(false);
                      }}
                      className={`w-full flex items-center gap-5 px-6 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all italic border-b-4 ${
                        viewMode === item.id 
                          ? 'bg-[#3e2723] text-white border-black shadow-xl' 
                          : 'text-stone-400 hover:text-[#3e2723] hover:bg-stone-50 border-transparent'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-amber-200' : 'text-stone-300'}`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

               <div className="p-8 border-t border-stone-100">
                <button
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-5 px-6 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest text-white bg-rose-600 border-b-4 border-rose-900 transition-all active:scale-95 shadow-lg shadow-rose-200 italic"
                >
                  <LogOut className="w-5 h-5" />
                  Logout Sistem
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-[#3e2723]/80 border-white/5' : 'bg-[#fcfaf6]/80 border-stone-200'} backdrop-blur-xl border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-4 rounded-[1.25rem] transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-stone-900 text-amber-200 shadow-lg shadow-black/20' 
                  : 'bg-white text-[#3e2723] shadow-xl shadow-stone-200/50'
              } active:scale-95 border border-stone-100/50`}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className={`text-xl font-black uppercase tracking-tight font-display italic ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                {viewTitles[viewMode] || 'Dashboard'}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-left">
                <span className="w-1.5 h-1.5 bg-[#3e2723] rounded-full animate-pulse opacity-30" />
                <p className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-40 italic ${isDarkMode ? 'text-amber-200/50' : 'text-[#3e2723]'}`}>Management Portal Strategis</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 bg-[#3e2723]/5 px-6 py-2 rounded-2xl border border-[#3e2723]/10">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3e2723]/60 italic">
              {formatRealTime(currentTime)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-10 pb-32 mt-10">
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}

        {viewMode === 'beranda' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-gradient-to-br from-[#3e2723] to-[#5d4037] p-12 rounded-[3.5rem] border border-white/5 shadow-3xl relative overflow-hidden group text-white">
               <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full -mb-48 -mr-48 blur-[100px] group-hover:scale-125 transition-transform" />
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                 <div>
                    <div className="flex items-center gap-3 mb-6">
                      <span className="w-12 h-1 bg-amber-200 rounded-full" />
                      <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-amber-200">Overview Strategis</h4>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black font-display text-white leading-tight mb-4 italic">Selamat Datang,<br/>Bapak Kepala Sekolah</h1>
                    <p className="text-[#d7ccc8] font-bold max-w-lg leading-relaxed uppercase text-[10px] tracking-[0.2em] italic">Sistem real-time terintegrasi untuk pemantauan kesehatan dan perizinan civitas SRMA 24 Kediri.</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-8 bg-white/10 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                       <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/60 mb-2">Total Santri</p>
                       <p className="text-5xl font-black text-white italic">{stats.totalSiswa}</p>
                    </div>
                    <div className="p-8 bg-white/10 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                       <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/60 mb-2">Pengumuman</p>
                       <p className="text-5xl font-black text-white italic">{stats.activeAnnouncements}</p>
                    </div>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-[#d7ccc8]/30 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-sm font-black uppercase tracking-widest text-[#3e2723] flex items-center gap-3 italic">
                         <Activity className="w-5 h-5 text-[#8b5e3c]" />
                         Log Aktivitas Terbaru
                       </h3>
                       <button onClick={() => setViewMode('perizinan_global')} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-[#3e2723] transition-colors italic">Lihat Semua</button>
                    </div>
                    <div className="space-y-4">
                       {recentPermits.map(permit => (
                         <div key={permit.id} className="p-6 bg-[#f8f3ed] rounded-3xl border border-[#d7ccc8]/30 flex items-center justify-between group hover:bg-[#3e2723] hover:text-white transition-all duration-300">
                           <div className="flex items-center gap-5">
                             <div className="p-3 bg-white/50 text-[#3e2723] rounded-2xl group-hover:scale-110 group-hover:bg-white/10 group-hover:text-amber-200 transition-all">
                               {permit.tipe === 'sakit' ? <Activity className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                             </div>
                             <div>
                               <h4 className="font-black uppercase tracking-tight group-hover:text-white transition-colors">{permit.nama_siswa}</h4>
                               <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest group-hover:text-amber-200/60 transition-colors uppercase italic">{permit.kelas} • {permit.tipe}</p>
                             </div>
                           </div>
                           <div className="text-right">
                              <span className="px-4 py-1.5 bg-white/50 text-[#3e2723] text-[9px] font-black rounded-full uppercase tracking-widest group-hover:bg-white/10 group-hover:text-white uppercase italic">{permit.status}</span>
                           </div>
                         </div>
                       ))}
                       {recentPermits.length === 0 && (
                         <div className="text-center py-20 text-stone-300 font-bold uppercase tracking-widest text-[10px] italic">Belum ada aktivitas terbaru</div>
                       )}
                    </div>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-[#d7ccc8]/30 shadow-sm flex flex-col h-full italic">
                     <h3 className="text-sm font-black uppercase tracking-widest text-[#3e2723] mb-8 flex items-center gap-3 italic">
                       <Mail className="w-5 h-5 text-[#8b5e3c]" />
                       Pesan Memorandum
                     </h3>
                     <div className="space-y-4 flex-1">
                        {memos.slice(0, 5).map(memo => (
                          <div key={memo.id} onClick={() => setSelectedMemo(memo)} className="p-5 bg-[#f8f3ed] rounded-2xl border border-[#d7ccc8]/30 cursor-pointer hover:bg-[#3e2723] hover:text-white transition-all duration-300 group">
                            <h4 className="font-black text-[12px] uppercase tracking-tight line-clamp-1 italic group-hover:text-white">{memo.perihal}</h4>
                            <p className="text-[9px] font-bold text-stone-400 mt-2 uppercase tracking-widest group-hover:text-amber-200/60 uppercase">DARI: {memo.pengirim_name}</p>
                          </div>
                        ))}
                         {memos.length === 0 && (
                          <div className="text-center py-10 text-stone-200">
                            <Mail className="w-10 h-10 mx-auto opacity-20" />
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Dashboard Style matching Catatan Kejadian */}
            <div className="bg-[#3e2723] rounded-[3rem] p-8 lg:p-10 text-white relative overflow-hidden shadow-2xl border border-[#5d4037]">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-[#d7ccc8] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/40 rotate-3 transition-transform hover:rotate-0">
                    <Mail className="w-10 h-10 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-4xl font-black font-display tracking-tight leading-none italic uppercase">Memorandum</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10">
                        OFFICIAL
                      </span>
                    </div>
                    <p className="text-stone-400 text-[10px] font-black mt-3 uppercase tracking-[0.2em] italic opacity-80">
                      Instruksi & Komunikasi Strategis Pimpinan
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowMemoForm(!showMemoForm)}
                  className={`group px-8 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl italic border-b-4 ${
                    showMemoForm 
                    ? 'bg-[#5d4037] text-stone-300 border-[#2d1e1a] hover:bg-[#2d1e1a]' 
                    : 'bg-[#fcfaf6] text-[#3e2723] border-[#d7ccc8] hover:bg-white'
                  }`}
                >
                  {showMemoForm ? 'Batal' : (
                    <>
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                      Terbitkan Memo
                    </>
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showMemoForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#fcfaf6] rounded-[3.5rem] p-10 lg:p-14 shadow-2xl border border-[#d7ccc8]/30">
                    <form onSubmit={handleCreateMemo} className="space-y-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 ml-1 italic text-left">Subjek / Perihal Memorandum</label>
                          <div className="relative">
                            <FileText className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300" />
                            <input
                              type="text"
                              required
                              value={memoSubject}
                              onChange={(e) => setMemoSubject(e.target.value)}
                              placeholder="Input perihal perintah strategis..."
                              className="w-full bg-white border-2 border-stone-50 rounded-[1.5rem] pl-20 pr-8 py-5 focus:border-[#3e2723] focus:ring-8 focus:ring-[#3e2723]/5 outline-none transition-all font-black text-[#3e2723] text-sm italic placeholder:text-stone-200 shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center justify-between ml-1">
                            <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] italic text-left">Unit / Staff Tujuan</label>
                            <div className="flex gap-4">
                              <button 
                                type="button"
                                onClick={() => setMemoRecipients([])}
                                className="text-[9px] font-black text-stone-400 uppercase tracking-widest hover:text-rose-500 italic transition-colors"
                              >
                                Bersihkan
                              </button>
                              <button 
                                type="button"
                                onClick={selectAllRoles}
                                className="text-[9px] font-black text-[#5d4037] px-4 py-1.5 bg-[#d7ccc8] rounded-full uppercase tracking-widest hover:bg-[#3e2723] hover:text-white transition-all italic border-b-2 border-black/20"
                              >
                                Pilih Semua Staff
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#fdfcf0] p-6 rounded-[2rem] border border-[#d7ccc8]/30 shadow-inner">
                            {[
                              { id: 'wali_asrama', label: 'Wali Asrama', icon: Home },
                              { id: 'dokter', label: 'Dokter UJS', icon: Activity },
                              { id: 'wali_asuh', label: 'Wali Asuh', icon: User },
                              { id: 'guru_mapel', label: 'Guru Mapel', icon: BookOpen },
                              { id: 'wali_kelas', label: 'Wali Kelas', icon: IdCard }
                            ].map((role) => (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => toggleRecipient(role.id as UserRole)}
                                className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border-b-4 italic flex flex-col items-center gap-2 ${
                                  memoRecipients.includes(role.id as UserRole)
                                  ? 'bg-[#3e2723] text-white border-black shadow-xl scale-105'
                                  : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
                                }`}
                              >
                                <role.icon className={`w-5 h-5 ${memoRecipients.includes(role.id as UserRole) ? 'text-amber-200' : 'text-stone-200'}`} />
                                {role.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 ml-1 italic text-left">Narasi Instruksi</label>
                        <textarea
                          required
                          value={memoContent}
                          onChange={(e) => setMemoContent(e.target.value)}
                          placeholder="Tuliskan detail instruksi atau informasi strategis di sini secara jelas..."
                          className="w-full bg-white border-2 border-stone-50 rounded-[2.5rem] px-8 py-8 focus:border-[#3e2723] outline-none transition-all font-medium text-stone-700 min-h-[320px] text-lg italic shadow-inner placeholder:text-stone-200"
                        />
                      </div>

                      <div className="flex justify-end pt-6 border-t border-stone-100">
                        <button
                          type="submit"
                          disabled={isSubmittingMemo}
                          className="w-full md:w-auto bg-[#3e2723] text-white px-16 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-sm italic border-b-8 border-stone-900 flex items-center justify-center gap-4"
                        >
                          {isSubmittingMemo ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin text-amber-200" />
                              Memproses...
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 text-amber-200 rotate-45" />
                              Sahkan & Kirim Pesan Strategis
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List Section Dashboard Style */}
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center border border-stone-100 shadow-xl shadow-stone-200/50 -rotate-3 transition-transform hover:rotate-0">
                    <History className="w-8 h-8 text-[#3e2723]" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Arsip Memorandum</h3>
                    <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] italic mt-3 underline decoration-amber-200 decoration-4 underline-offset-4">Log Komunikasi Internal</p>
                  </div>
                </div>
                
                <div className="relative w-full md:w-96 group">
                  <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                  <input
                    type="text"
                    value={memoSearch}
                    onChange={(e) => setMemoSearch(e.target.value)}
                    placeholder="Filter memo..."
                    className="w-full bg-white border-2 border-stone-50 rounded-[1.5rem] pl-20 pr-8 py-5 text-sm font-black uppercase tracking-widest focus:outline-none focus:border-[#3e2723] transition-all italic text-[#3e2723] shadow-inner placeholder:text-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filteredMemos.map((memo, idx) => (
                  <motion.div
                    layout
                    key={memo.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedMemo(memo)}
                    className="bg-white p-10 rounded-[3rem] border border-stone-50 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all group cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-3 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-700" />
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-stone-50 rounded-xl">
                              <Mail className="w-4 h-4 text-[#3e2723]/30 group-hover:text-[#3e2723] transition-colors" />
                           </div>
                           <span className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] italic group-hover:text-stone-400">{memo.nomor_memo}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-[#ea580c] uppercase tracking-widest italic bg-orange-50 px-3 py-1 rounded-lg">
                            {format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}
                          </span>
                          <button
                            onClick={(e) => handleDeleteMemo(e, memo.id!)}
                            className="w-10 h-10 bg-stone-50 text-stone-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center border border-transparent hover:border-rose-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-black text-[#3e2723] tracking-tight uppercase italic group-hover:text-[#ea580c] transition-colors line-clamp-2 leading-tight font-display">{memo.perihal}</h3>
                      
                      <div className="relative pl-8 border-l-4 border-stone-50">
                        <p className="text-stone-500 text-sm italic line-clamp-2 leading-relaxed">
                          "{memo.isi}"
                        </p>
                      </div>

                      <div className="pt-6 border-t border-stone-50 flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {memo.penerima.slice(0, 3).map((role) => (
                            <span key={role} className="px-4 py-2 bg-stone-50 text-[9px] font-black text-stone-400 uppercase tracking-widest rounded-xl italic">
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                          {memo.penerima.length > 3 && <span className="text-[9px] font-black text-stone-300 uppercase">+{memo.penerima.length - 3} Units</span>}
                        </div>
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-[#3e2723] transition-colors group-hover:shadow-lg">
                           <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {filteredMemos.length === 0 && (
                  <div className="lg:col-span-2 flex flex-col items-center justify-center py-40 bg-white rounded-[4rem] border-4 border-dashed border-stone-50 relative overflow-hidden">
                    <Mail className="w-20 h-20 text-stone-100 mb-6 opacity-50" />
                    <p className="text-sm font-black text-stone-300 uppercase tracking-[0.3em] italic">No active directives found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'perizinan_global' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Minimal High-Contrast Header */}
            <div className="bg-[#3e2723] rounded-[3rem] p-8 lg:p-10 shadow-3xl text-white relative overflow-hidden border border-[#5d4037]">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-[#d7ccc8] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/40 rotate-3 group-hover:rotate-0 transition-transform">
                    <ClipboardList className="w-10 h-10 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-4xl font-black font-display tracking-tight leading-none italic uppercase">Kendali Perizinan</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10">GLOBAL AUDIT</span>
                    </div>
                    <p className="text-stone-400 text-[10px] font-black mt-3 uppercase tracking-[0.2em] italic opacity-80">Monitoring Surat Keterangan Sakit & Izin Umum</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex bg-[#5d4037] p-1.5 rounded-[1.5rem] border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisWeek(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Minggu Ini', user.name, 'Kepala Sekolah');
                      }}
                      className="px-5 py-3 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all flex items-center gap-2 group/btn"
                    >
                      <Printer className="w-4 h-4 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic tracking-tighter">Minggu</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisMonth(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Bulan Ini', user.name, 'Kepala Sekolah');
                      }}
                      className="px-5 py-3 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all flex items-center gap-2 group/btn"
                    >
                      <Printer className="w-4 h-4 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic tracking-tighter">Bulan</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-stone-100 flex flex-col md:flex-row gap-8 items-center border-b-[12px]">
              <div className="relative w-full group">
                <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Audit nama siswa atau no surat..."
                  className="w-full pl-24 pr-8 py-6 bg-[#fcfaf6] border-2 border-stone-50 rounded-[2rem] focus:border-[#3e2723] focus:ring-8 focus:ring-[#3e2723]/5 outline-none transition-all font-black text-[#3e2723] text-sm italic placeholder:text-stone-200 shadow-inner"
                  value={perizinanSearch}
                  onChange={(e) => setPerizinanSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar w-full md:w-auto">
                {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all italic border-b-4 ${
                      timeFilter === filter 
                        ? 'bg-[#3e2723] text-amber-200 border-black shadow-xl scale-105' 
                        : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
                    }`}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <AnimatePresence mode="popLayout">
                {permits
                  .filter(p => {
                    const matchesSearch = p.nama_siswa?.toLowerCase().includes(perizinanSearch.toLowerCase()) || 
                                        p.nomor_surat?.toLowerCase().includes(perizinanSearch.toLowerCase());
                    if (!matchesSearch) return false;

                    const date = p.tgl_surat?.toDate();
                    if (!date) return true;

                    if (timeFilter === 'hari_ini') return isToday(date);
                    if (timeFilter === 'kemarin') return isYesterday(date);
                    if (timeFilter === 'minggu_ini') return isThisWeek(date);
                    if (timeFilter === 'bulan_ini') return isThisMonth(date);
                    return true;
                  })
                  .map((permit) => (
                    <motion.div
                      key={permit.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setSelectedPermit(permit)}
                      className="bg-white p-10 rounded-[3.5rem] border border-stone-50 shadow-sm hover:shadow-2xl transition-all group relative border-b-[12px] border-stone-100 overflow-hidden cursor-pointer"
                    >
                      <div className="absolute top-0 right-0 w-3 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-700" />
                      
                      <div className="flex flex-col h-full gap-8">
                        <div className="flex justify-between items-start pt-2">
                           <div className="flex gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-[#fcfaf6] flex items-center justify-center border-2 border-stone-50 group-hover:bg-[#3e2723] transition-colors duration-500">
                                <FileText className="w-7 h-7 text-[#3e2723]/30 group-hover:text-amber-200" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic mb-1">LOG #{permit.nomor_surat}</p>
                                <h4 className="text-2xl font-black text-[#3e2723] uppercase italic tracking-tight font-display">{permit.nama_siswa}</h4>
                                <p className="text-[11px] font-bold text-stone-400 mt-2 uppercase tracking-widest italic">{permit.kelas}</p>
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#fcfaf6] p-8 rounded-[2.5rem] border border-stone-50 relative group-hover:border-[#3e2723]/10 transition-colors">
                          <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] mb-4 italic leading-none">Keperluan / Diagnosa:</p>
                          <p className="text-lg font-black text-[#5d4037] italic leading-relaxed whitespace-pre-wrap">"{permit.diagnosa || permit.alasan || '-'}"</p>
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-stone-50 mt-auto">
                           <div className="flex items-center gap-3">
                              <Clock className="w-4 h-4 text-stone-200" />
                              <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic">
                                {permit.tgl_surat ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy', { locale: id }) : '-'}
                              </span>
                           </div>
                           
                           <div className="flex items-center gap-3">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 generatePermitPDF(permit);
                               }}
                               className="p-4 bg-stone-50 text-stone-300 hover:text-[#3e2723] hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-xl border border-transparent hover:border-stone-100"
                               title="Cetak PDF"
                             >
                               <Printer className="w-5 h-5" />
                             </button>
                             <div className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic border-b-4 ${
                               permit.status === 'approved' ? 'bg-emerald-600 text-white border-emerald-800' : 'bg-amber-600 text-white border-amber-800'
                             }`}>
                               {(permit.status || 'PENDING').replace('_', ' ')}
                             </div>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {permits.length === 0 && (
                <div className="col-span-full py-40 bg-white rounded-[4rem] border-4 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-10">
                  <FileSearch className="w-20 h-20 text-stone-100 mb-8 opacity-50" />
                  <h3 className="text-3xl font-black text-stone-200 uppercase tracking-widest italic font-display leading-tight mb-4 text-center">Data Nihil</h3>
                  <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.3em] italic max-w-sm leading-relaxed text-center">Sistem audit tidak menemukan adanya rekaman data perizinan pada kategori ini.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(viewMode === 'statistik' || viewMode === 'pangkalan_data' || viewMode === 'announcements') && (
          <div className="bg-white p-20 rounded-[4rem] border border-[#d7ccc8]/30 text-center flex flex-col items-center justify-center space-y-8 py-40 min-h-[60vh] shadow-xl italic animate-in fade-in duration-700">
             <div className="p-10 bg-[#f8f3ed] rounded-full border border-[#d7ccc8]/50 animate-pulse">
                <FileSearch className="w-20 h-20 text-[#8b5e3c]" />
             </div>
             <div className="max-w-md">
                <h2 className="text-3xl font-black italic mb-4 text-[#3e2723]">Layanan Data Strategis</h2>
                <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px] leading-relaxed italic">
                  Modul ini sedang disinkronisasikan untuk akurasi data pimpinan. Silakan gunakan dashboard utama untuk pemantauan operasional real-time.
                </p>
             </div>
             <button onClick={() => setViewMode('beranda')} className="px-10 py-5 bg-[#3e2723] text-white font-black rounded-3xl uppercase tracking-widest text-xs shadow-2xl shadow-black/20 hover:opacity-90 transition-all uppercase italic">
                Kembali ke Dashboard
             </button>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedMemo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-3xl border border-[#d7ccc8]/30 overflow-hidden relative"
             >
                <div className="p-8 border-b border-[#f8f3ed] bg-[#3e2723] flex items-center justify-between text-white italic">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-amber-200" />
                    <h3 className="font-black uppercase tracking-widest text-[10px] italic">Arsip Memorandum Strategis</h3>
                  </div>
                  <button onClick={() => setSelectedMemo(null)} className="p-2 text-amber-200 hover:bg-white/10 rounded-full transition-all"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="p-12 space-y-10 bg-white">
                  {selectedMemo && (
                    <>
                      <div>
                        <h2 className="text-3xl font-black italic text-[#3e2723] leading-tight mb-6">{selectedMemo.perihal}</h2>
                        <div className="p-10 bg-[#f8f3ed] rounded-[2.5rem] border border-[#d7ccc8]/30 text-[#5d4037] mt-8 leading-relaxed italic text-base whitespace-pre-wrap">
                          {selectedMemo.isi}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2">
                          <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block w-full mb-1 italic">Ditujukan Kepada:</span>
                          {selectedMemo.penerima.map((role) => (
                            <span key={role} className="px-3 py-1 bg-white text-[8px] font-black text-[#8b5e3c] uppercase tracking-widest rounded-lg border border-[#d7ccc8]/30">
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="pt-10 border-t border-[#f8f3ed] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#3e2723] rounded-2xl flex items-center justify-center font-black text-white italic border border-white/20">
                            {selectedMemo.pengirim_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Diterbitkan Oleh</p>
                            <p className="text-sm font-black text-[#3e2723] italic uppercase tracking-tight">{selectedMemo.pengirim_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Tanggal Dokumen</p>
                           <p className="text-sm font-black text-[#3e2723] italic uppercase tracking-tight">{format(selectedMemo.tgl_memo.toDate(), 'dd MMMM yyyy', { locale: id })}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
