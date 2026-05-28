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
  Sun,
  Moon
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, Announcement, ProgressRecord } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateSummaryReportPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import WallView from './WallView';
import ProgressRecordsView from './ProgressRecordsView';
import SarprasAsramaView from './SarprasAsramaView';
import { motion, AnimatePresence } from 'motion/react';

interface WaliKelasViewProps {
  user: AppUser;
  activeTab: string;
}

export default function WaliKelasView({ user, activeTab }: WaliKelasViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

  // Banner & Time states
  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  const banners = announcements.length > 0 
    ? announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        color: "from-rose-600 to-orange-600",
        icon: Bell,
        author: "Pimpinan"
      }))
    : [{
        id: 'def-1',
        title: "Wali Kelas Panel",
        content: "Pantau kesehatan dan perizinan siswa di kelas Anda secara langsung.",
        color: "from-slate-900 to-slate-950",
        icon: Info,
        author: "Sistem"
      }];

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const [viewMode, setViewMode] = useState<'perizinan' | 'catatan_perkembangan' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'dinding' | 'siswa' | 'sarpras_asrama'>('perizinan');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);

  useEffect(() => {
    // Watch permits for my class or that need my approval
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
      where('penerima', 'array-contains', 'wali_kelas'),
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

  const handleApproveByKelas = async (permitId: string) => {
    if (!confirm('Berikan persetujuan untuk izin ini?')) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'approved',
        wali_kelas_uid: user.uid,
        tgl_disetujui: serverTimestamp()
      });
      
      const permit = permits.find(p => p.id === permitId);
      if (permit) {
        notifyAllRoles(['wali_asuh'], 'Izin Disetujui Wali Kelas', `Izin ${permit.nama_siswa} telah disetujui oleh Wali Kelas ${user.name}.`);
      }
      
      alert('Persetujuan berhasil diberikan');
      setSelectedPermit(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setLoading(false);
    }
  };

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

  const viewTitles: Record<string, string> = {
    perizinan: 'Dashboard Wali Kelas',
    catatan_perkembangan: 'Catatan Perkembangan',
    memorandum: 'Memorandum Intern',
    pangkalan_data: 'Pangkalan Data Siswa',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Akademik',
    dinding: 'Dinding Kelas',
    siswa: 'Daftar Siswa'
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-stone-950 text-white' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans antialiased selection:bg-[#3e2723] selection:text-white`}>
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
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-8">
                  <div className={`rounded-[2.5rem] p-8 mb-10 border shadow-2xl relative overflow-hidden group ${isDarkMode ? 'bg-stone-950 border-white/5' : 'bg-[#fcfaf6] border-stone-200'}`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#3e2723]/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-16 h-16 bg-[#3e2723] rounded-3xl flex items-center justify-center shadow-xl shadow-black/20 -rotate-3 group-hover:rotate-0 transition-transform">
                        <GraduationCap className="w-8 h-8 text-amber-200" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-[15px] leading-tight tracking-tight uppercase italic font-display">Wali Kelas</span>
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 opacity-40 italic`}>SRMA 24 KEDIRI</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-6 px-4 italic opacity-30`}>Dashboard Nav</p>
                      <div className="space-y-2">
                        {[
                          { id: 'perizinan', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'siswa', label: 'Daftar Siswa', icon: Users },
                          { id: 'catatan_perkembangan', label: 'Catatan Siswa', icon: IdCard },
                          { id: 'sarpras_asrama', label: 'Sarpras Asrama', icon: Wrench },
                          { id: 'agenda', label: 'Agenda Akademik', icon: Calendar },
                          { id: 'dinding', label: 'Dinding Kelas', icon: MessageSquare },
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
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 italic border-b-4 ${
                              viewMode === item.id 
                                ? 'bg-[#3e2723] text-white border-black shadow-xl shadow-stone-900/20' 
                                : 'bg-transparent text-stone-400 hover:bg-stone-50 hover:text-[#3e2723] border-transparent'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-amber-200' : 'text-stone-300'}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-stone-100">
                <button 
                  onClick={() => auth.signOut()}
                  className={`w-full flex items-center gap-4 px-8 py-5 rounded-[1.5rem] font-black text-[11px] transition-all shadow-xl active:scale-95 bg-rose-600 text-white border-b-8 border-rose-900 italic uppercase tracking-wider mb-2`}
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out Session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-stone-950/80 border-white/5' : 'bg-[#fcfaf6]/80 border-stone-200'} backdrop-blur-xl border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-4 text-left">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-stone-900 text-amber-200 shadow-lg shadow-black/20' 
                  : 'bg-white text-[#3e2723] shadow-md border border-stone-100'
              } active:scale-95`}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className={`text-sm font-black uppercase tracking-widest font-display italic ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                {viewTitles[viewMode] || 'Dashboard'}
              </h1>
              <p className={`text-[9px] font-bold uppercase tracking-widest opacity-50 italic ${isDarkMode ? 'text-amber-100' : 'text-[#8b5e3c]'}`}>
                Digital Academic Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-12 h-12 flex items-center justify-center rounded-2xl ${isDarkMode ? 'bg-stone-800 text-amber-200 shadow-lg shadow-black/20' : 'bg-white text-stone-400 shadow-xl shadow-stone-200/50'} transition-all active:scale-95 border border-stone-100/50`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Top Banner */}
      <AnimatePresence mode="wait">
        {showBanner && banners.length > 0 && banners[bannerIndex] && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 pt-8">
              <div className={`relative overflow-hidden rounded-[2.5rem] bg-[#3e2723] p-8 text-white shadow-2xl group border-b-8 border-black`}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative z-10 flex items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      {React.createElement(banners[bannerIndex].icon, { className: "w-8 h-8 text-amber-200" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-4">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-amber-100 italic">{banners[bannerIndex].title}</h4>
                        <span className="px-3 py-1 bg-white/15 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10">
                          {banners[bannerIndex].author || 'System'}
                        </span>
                      </div>
                      <p className="text-lg font-bold leading-relaxed mt-2 italic text-white/90 font-display">"{banners[bannerIndex].content}"</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-2xl transition-all active:scale-90 border border-white/10 group/btn"
                  >
                    <X className="w-6 h-6 group-hover/btn:rotate-90 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto w-full px-6 mt-8">
        <div className="p-1 rounded-[1.5rem] bg-stone-100">
          <div className="flex items-center justify-center gap-4 py-4 px-8 rounded-[calc(1.5rem-1px)] bg-[#fcfaf6] border-2 border-stone-100 shadow-inner">
            <span className="w-2 h-2 bg-[#3e2723] rounded-full animate-ping opacity-30 px-1" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-3 text-stone-400 italic">
              OFFICIAL SYSTEM TIME: <span className="text-[#3e2723]">{formatRealTime(currentTime)}</span>
            </p>
            <span className="w-2 h-2 bg-[#3e2723] rounded-full animate-ping opacity-30 px-1" />
          </div>
        </div>
      </div>

      <main className={`p-6 ${viewMode === 'mading' || viewMode === 'dinding' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'dinding' && <WallView user={user} wallType="kelas" title="Dinding Kelas" />}
        {viewMode === 'catatan_perkembangan' && <ProgressRecordsView user={user} />}
        {viewMode === 'sarpras_asrama' && <SarprasAsramaView user={user} />}

        {viewMode === 'siswa' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                 <Search className="w-5 h-5 text-slate-400 ml-2" />
                 <input 
                   type="text" 
                   placeholder="Cari nama siswa..."
                   className="bg-transparent border-none outline-none text-sm font-medium w-full p-2"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase())).map(student => (
                <div key={student.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                    {student.nama_lengkap.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{student.nama_lengkap}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.kelas} • {student.asrama || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'perizinan' && (
          <div className="space-y-10">
            {/* Main Stats Card */}
            <div className="bg-[#3e2723] p-10 lg:p-14 rounded-[4rem] text-white shadow-3xl relative overflow-hidden group border-b-[12px] border-black">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              <div className="relative z-10 text-left">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-black font-display tracking-tight mb-4 italic">Dashboard Akademik</h1>
                    <div className="flex items-center gap-4 bg-white/10 px-5 py-2 rounded-2xl backdrop-blur-xl border border-white/10 w-fit">
                      <ShieldCheck className="w-5 h-5 text-amber-200 shadow-xl" />
                      <p className="text-[11px] font-black text-amber-100 uppercase tracking-[0.3em] italic">
                         Wali Kelas: {user.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-[#5d4037] p-1.5 rounded-[1.5rem] border border-[#3e2723] shadow-inner mb-6 lg:mb-0">
                      <button 
                        onClick={() => {
                          const filtered = permits.filter(p => isThisWeek(p.tgl_surat.toDate()));
                          generateSummaryReportPDF(filtered, 'Minggu Ini', user.name, 'Wali Kelas');
                        }}
                        className="px-5 py-3 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all flex items-center gap-2 group/btn"
                      >
                        <Printer className="w-4 h-4 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic tracking-tighter">Rekap Minggu</span>
                      </button>
                      <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                      <button 
                        onClick={() => {
                          const filtered = permits.filter(p => isThisMonth(p.tgl_surat.toDate()));
                          generateSummaryReportPDF(filtered, 'Bulan Ini', user.name, 'Wali Kelas');
                        }}
                        className="px-5 py-3 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all flex items-center gap-2 group/btn"
                      >
                        <Printer className="w-4 h-4 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic tracking-tighter">Rekap Bulan</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative group/stat hover:bg-[#3e2723] transition-all">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200 opacity-60 mb-3 italic">Butuh ACC</p>
                        <p className="text-5xl font-black font-display text-amber-200 italic shadow-amber-900/50">{permits.filter(p => p.status === 'pending_kelas').length}</p>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white opacity-60 mb-3 italic">Total Peserta Didik</p>
                        <p className="text-5xl font-black font-display text-white italic">{students.length}</p>
                      </div>
                       <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200 opacity-60 mb-3 italic">Izin Aktif</p>
                        <p className="text-5xl font-black font-display text-emerald-300 italic">{permits.filter(p => isToday(p.tgl_surat.toDate())).length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 lg:p-14 rounded-[4rem] shadow-xl border border-stone-100 space-y-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#fcfaf6] rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
               <div className="flex items-center justify-between relative z-10">
                <h3 className="text-2xl font-black text-[#3e2723] uppercase tracking-tight italic flex items-center gap-4 font-display">
                  <div className="p-3 bg-[#3e2723] rounded-2xl rotate-3">
                    <ClipboardList className="w-6 h-6 text-amber-200" />
                  </div>
                  Antrian Persetujuan Kelas
                </h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 relative z-10">
                {permits.filter(p => p.status === 'pending_kelas').map((permit, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={permit.id} 
                    className="bg-[#fcfaf6] p-8 rounded-[3rem] border border-stone-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-[#3e2723]/30 transition-all duration-500"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#3e2723] text-amber-200 rounded-[1.75rem] flex items-center justify-center font-black italic text-xl shadow-xl shadow-black/10 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        {permit.nama_siswa.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <h4 className="text-2xl font-black text-[#3e2723] uppercase tracking-tight italic font-display">{permit.nama_siswa}</h4>
                           <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${permit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                             {permit.tipe}
                           </span>
                        </div>
                        <p className="text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] italic group-hover:text-stone-500 transition-colors">{permit.kelas} • {permit.nomor_surat || 'NO REF'}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setSelectedPermit(permit)}
                        className="px-8 py-4 bg-white text-stone-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border-b-4 border-stone-100 hover:text-[#3e2723] hover:border-[#3e2723] transition-all font-display italic"
                      >
                        Detail Izin
                      </button>
                      <button 
                         onClick={() => handleApproveByKelas(permit.id!)}
                         className="px-10 py-4 bg-[#3e2723] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-stone-900/10 hover:bg-black active:scale-95 transition-all font-display italic border-b-4 border-black group/btn"
                      >
                        <span className="flex items-center gap-3">
                           Berikan ACC
                           <Check className="w-4 h-4 text-amber-200 group-hover/btn:scale-125 transition-transform" />
                        </span>
                      </button>
                    </div>
                  </motion.div>
                ))}
                
                {permits.filter(p => p.status === 'pending_kelas').length === 0 && (
                  <div className="text-center py-24 text-stone-200 font-black uppercase tracking-[0.3em] text-xs italic bg-white rounded-[3rem] border-4 border-dashed border-stone-50 space-y-6">
                    <ShieldCheck className="w-20 h-20 mx-auto opacity-10" />
                    <p>Semua laporan telah ditinjau</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8 pb-20">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white rounded-3xl shadow-xl shadow-stone-200/50 -rotate-3">
                  <History className="w-8 h-8 text-[#3e2723]" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[#3e2723] font-display uppercase tracking-tight italic leading-none">Riwayat Jejak Izin</h3>
                  <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] italic mt-3">Arsip Perizinan Unit Akademik</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {filteredPermits.map((permit, idx) => (
                   <motion.div
                    key={permit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white p-8 rounded-[3.5rem] border border-stone-50 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all cursor-pointer group flex items-center justify-between relative overflow-hidden"
                    onClick={() => setSelectedPermit(permit)}
                  >
                    <div className="absolute top-0 right-0 w-3 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-700" />
                    <div className="flex items-center gap-6">
                      <div className={`p-5 rounded-[1.75rem] transition-all duration-500 group-hover:-rotate-6 ${
                        permit.tipe === 'sakit' ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white' : 
                        permit.tipe === 'umum' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white' : 'bg-stone-50 text-stone-300'
                      }`}>
                        {permit.tipe === 'sakit' ? <Activity className="w-7 h-7" /> : 
                         permit.tipe === 'umum' ? <Calendar className="w-7 h-7" /> : <ClipboardList className="w-7 h-7" />}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-[#3e2723] uppercase tracking-tight italic font-display leading-tight">{permit.nama_siswa}</h4>
                        <div className="flex items-center gap-3 mt-2">
                           <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic">{permit.kelas}</span>
                           <span className="w-1 h-1 bg-stone-200 rounded-full" />
                           <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic">{permit.nomor_surat}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                       <span className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] italic border-b-2 shadow-sm ${
                        ['approved', 'acknowledged'].includes(permit.status) 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {permit.status}
                      </span>
                      <p className="text-[9px] font-black text-stone-200 uppercase tracking-widest italic">
                        {format(permit.tgl_surat.toDate(), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-[#3e2723] font-display italic px-2">Memorandum Intern</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memos.map((memo) => (
                <div 
                  key={memo.id}
                  onClick={() => setSelectedMemo(memo)}
                  className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">{memo.perihal}</h3>
                      <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                        {memo.nomor_memo} • {format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              ))}
              {memos.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Belum ada memorandum</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPermit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-indigo-100 text-indigo-600`}>
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">Detail Izin</h3>
                </div>
                <button onClick={() => setSelectedPermit(null)} className="p-2 text-slate-400"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</label>
                    <p className="font-black text-slate-900">{selectedPermit.nama_siswa}</p>
                  </div>
                   <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                    <p className="font-black text-slate-900">{selectedPermit.kelas}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alasan/Diagnosa</label>
                  <p className="text-sm font-bold text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {selectedPermit.diagnosa || selectedPermit.alasan || selectedPermit.isi_catatan}
                  </p>
                </div>
                <div className="pt-4 flex gap-3">
                   <button 
                    onClick={() => setSelectedPermit(null)}
                    className="flex-1 py-4 bg-slate-100 text-[#3e2723] font-black rounded-2xl uppercase tracking-widest text-[10px]"
                  >
                    Tutup
                  </button>
                  {selectedPermit.status === 'pending_kelas' && (
                    <button 
                      onClick={() => handleApproveByKelas(selectedPermit.id!)}
                      className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-900/10"
                    >
                      Approve Sekarang
                    </button>
                  )}
                   <button 
                    onClick={() => generatePermitPDF(selectedPermit)}
                    className="px-6 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-black text-slate-900">Detail Memorandum</h3>
                <button onClick={() => setSelectedMemo(null)} className="p-2 text-slate-400"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-4">
                <h4 className="font-black text-xl italic">{selectedMemo.perihal}</h4>
                <p className="text-sm text-slate-600 leading-relaxed italic">{selectedMemo.isi}</p>
                <div className="pt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Dari: {selectedMemo.pengirim_name}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
