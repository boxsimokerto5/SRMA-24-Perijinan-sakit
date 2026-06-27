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
  ClipboardCheck,
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
  Trash2,
  Radio,
  Image as LucideImage
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp, limit, deleteDoc } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, Announcement, ProgressRecord, UserRole, Ketidakhadiran, SarprasReport, parseFirestoreDate } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateMemorandumPDF, generateSummaryReportPDF, generateKetidakhadiranPDF, generateKetidakhadiranReportPDF, generateSarprasReportPDF, generateSarprasSummaryPDF } from '../pdfUtils';
import MadingSekolahView from './MadingSekolahView';
import ProfileView from './ProfileView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import JurnalKeperawatanView from './JurnalKeperawatanView';
import ProgressRecordsView from './ProgressRecordsView';
import { motion, AnimatePresence } from 'motion/react';

interface KepalaSekolahViewProps {
  user: AppUser;
  activeTab: string;
}

export default function KepalaSekolahView({ user, activeTab }: KepalaSekolahViewProps) {
  const [viewMode, setViewMode] = useState<'beranda' | 'statistik' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'announcements' | 'perizinan_global' | 'cek_ketidakhadiran' | 'jurnal_keperawatan' | 'sarpras' | 'catatan_perkembangan'>('beranda');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSiswa: 0,
    totalIzinBulanIni: 0,
    totalCatatan: 0,
    activeAnnouncements: 0
  });

  const [ketidakhadiranData, setKetidakhadiranData] = useState<Ketidakhadiran[]>([]);
  const [khTimeFilter, setKhTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [khPdfLoading, setKhPdfLoading] = useState<string | null>(null);
  const [khSearchTerm, setKhSearchTerm] = useState('');

  const [recentPermits, setRecentPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [imageBanner, setImageBanner] = useState<{ imageUrl: string; title?: string; linkUrl?: string; isActive: boolean; updatedAt?: any } | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [perizinanSearch, setPerizinanSearch] = useState('');
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);

  // Sarpras states
  const [sarprasReports, setSarprasReports] = useState<SarprasReport[]>([]);
  const [sarprasFilter, setSarprasFilter] = useState<'minggu_ini' | 'bulan_ini' | 'semua'>('semua');
  const [sarprasStatusFilter, setSarprasStatusFilter] = useState<'all' | 'pending' | 'on_progress' | 'fixed'>('all');
  const [sarprasSearch, setSarprasSearch] = useState('');
  
  // Memorandum Form State
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [memoSubject, setMemoSubject] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoRecipients, setMemoRecipients] = useState<UserRole[]>([]);
  const [isSubmittingMemo, setIsSubmittingMemo] = useState(false);
  const [memoSearch, setMemoSearch] = useState('');
  const [expandedMemos, setExpandedMemos] = useState<Record<string, boolean>>({});

  const toggleExpandMemo = (memoId: string) => {
    setExpandedMemos(prev => ({
      ...prev,
      [memoId]: !prev[memoId]
    }));
  };

  // Announcement management states
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnIsActive, setNewAnnIsActive] = useState(true);
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) {
      alert('Mohon lengkapi judul dan isi pengumuman.');
      return;
    }

    setIsSubmittingAnn(true);
    try {
      const docData: Omit<Announcement, 'id'> = {
        title: newAnnTitle,
        content: newAnnContent,
        createdAt: Timestamp.now(),
        authorName: user.name || 'Kepala Sekolah',
        authorUid: user.uid,
        isActive: newAnnIsActive
      };

      await addDoc(collection(db, 'announcements'), docData);

      // Notify all roles
      await notifyAllRoles(
        ['dokter', 'wali_asuh', 'wali_kelas', 'guru_mapel', 'wali_asrama'],
        'Pengumuman Pimpinan',
        `Pimpinan menerbitkan pengumuman baru: ${newAnnTitle}`
      );

      setNewAnnTitle('');
      setNewAnnContent('');
      setNewAnnIsActive(true);
      setShowAnnForm(false);
      alert('Pengumuman berhasil diterbitkan!');
    } catch (error) {
       console.error(error);
       handleFirestoreError(error, OperationType.WRITE, 'announcements');
    } finally {
       setIsSubmittingAnn(false);
    }
  };

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

  useEffect(() => {
    const unsubBanner = onSnapshot(doc(db, 'image_banners', 'active'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setImageBanner({
          imageUrl: data.imageUrl || '',
          title: data.title || '',
          linkUrl: data.linkUrl || '',
          isActive: data.isActive !== false,
          updatedAt: data.updatedAt
        });
      } else {
        setImageBanner(null);
      }
    }, (err) => {
      console.warn("Non-blocking image banner read:", err);
    });
    return () => unsubBanner();
  }, []);

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

    const unsubKh = onSnapshot(query(collection(db, 'ketidakhadiran'), orderBy('tgl_absen', 'desc')), (snap) => {
      setKetidakhadiranData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ketidakhadiran)));
    });

    const unsubSarpras = onSnapshot(query(collection(db, 'sarpras_reports'), orderBy('tgl_lapor', 'desc')), (snap) => {
      setSarprasReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SarprasReport)));
    });

    return () => {
      unsubStudents();
      unsubPermits();
      unsubMemos();
      unsubAnn();
      unsubKh();
      unsubSarpras();
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
    pangkalan_data: 'Arsip Data Peserta Didik',
    profil: 'Profil Pimpinan',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Strategis',
    announcements: 'Kelola Pengumuman',
    perizinan_global: 'Log Perizinan Global',
    cek_ketidakhadiran: 'Cek Ketidakhadiran',
    jurnal_keperawatan: 'Jurnal Keperawatan',
    sarpras: 'Inventaris & Sarpras',
    catatan_perkembangan: 'Catatan Perkembangan'
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

  const filteredKetidakhadiran = React.useMemo(() => {
    return ketidakhadiranData.filter(rec => {
      const matchesSearch = khSearchTerm ? (
        rec.keterangan_kegiatan.toLowerCase().includes(khSearchTerm.toLowerCase()) ||
        rec.daftar_siswa.some(s => s.toLowerCase().includes(khSearchTerm.toLowerCase())) ||
        rec.kelas.toLowerCase().includes(khSearchTerm.toLowerCase())
      ) : true;

      if (!matchesSearch) return false;

      const date = parseFirestoreDate(rec.tgl_absen);
      
      let matchesTime = true;
      if (khTimeFilter === 'hari_ini') matchesTime = date ? isToday(date) : false;
      else if (khTimeFilter === 'kemarin') matchesTime = date ? isYesterday(date) : false;
      else if (khTimeFilter === 'minggu_ini') matchesTime = date ? isThisWeek(date, { weekStartsOn: 1 }) : false;
      else if (khTimeFilter === 'bulan_ini') matchesTime = date ? isThisMonth(date) : false;

      return matchesTime;
    });
  }, [ketidakhadiranData, khTimeFilter, khSearchTerm]);

  const khStats = React.useMemo(() => {
    return {
      hariIni: ketidakhadiranData.filter(rec => {
        const date = parseFirestoreDate(rec.tgl_absen);
        return date ? isToday(date) : false;
      }).length,
      kemarin: ketidakhadiranData.filter(rec => {
        const date = parseFirestoreDate(rec.tgl_absen);
        return date ? isYesterday(date) : false;
      }).length,
      mingguIni: ketidakhadiranData.filter(rec => {
        const date = parseFirestoreDate(rec.tgl_absen);
        return date ? isThisWeek(date, { weekStartsOn: 1 }) : false;
      }).length,
      bulanIni: ketidakhadiranData.filter(rec => {
        const date = parseFirestoreDate(rec.tgl_absen);
        return date ? isThisMonth(date) : false;
      }).length,
    };
  }, [ketidakhadiranData]);

  const handlePrintSummaryPDF = async (periodType: 'Minggu Ini' | 'Bulan Ini') => {
    setLoading(true);
    try {
      const filtered = ketidakhadiranData.filter(rec => {
        const date = parseFirestoreDate(rec.tgl_absen);
        if (!date) return false;
        if (periodType === 'Minggu Ini') return isThisWeek(date, { weekStartsOn: 1 });
        if (periodType === 'Bulan Ini') return isThisMonth(date);
        return true;
      });

      await generateKetidakhadiranReportPDF(filtered, periodType, user.name, 'Kepala Sekolah');
      alert(`Berhasil membuat rekap PDF ${periodType}!`);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat rekap PDF!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950 text-white' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans antialiased selection:bg-[#3e2723] selection:text-white`}>
       <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 w-[280px] z-[70] shadow-2xl flex flex-col bg-slate-900 text-white border-r border-white/10`}
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6 font-sans">
                  <div className={`rounded-[2.5rem] p-5 mb-8 border border-white/5 relative overflow-hidden group bg-stone-950`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#3e2723]/10 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10 font-display text-left">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight uppercase italic text-amber-100">SRMA 24</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 italic text-amber-200/60`}>Principal Portal</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 text-left">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 italic text-stone-500`}>MENU PIMPINAN</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'beranda', label: 'Pusat Kendali', icon: LayoutDashboard },
                          { id: 'statistik', label: 'Monitor Analitik', icon: BarChart3 },
                          { id: 'pangkalan_data', label: 'Arsip Peserta Didik', icon: Database },
                          { id: 'perizinan_global', label: 'Log Perizinan', icon: ClipboardList },
                          { id: 'cek_ketidakhadiran', label: 'Cek Ketidakhadiran', icon: ClipboardCheck },
                          { id: 'jurnal_keperawatan', label: 'Jurnal Keperawatan', icon: Activity },
                          { id: 'sarpras', label: 'Inventaris & Sarpras', icon: Wrench },
                          { id: 'catatan_perkembangan', label: 'Catatan Perkembangan', icon: FileText },
                          { id: 'agenda', label: 'Agenda Strategis', icon: Calendar },
                          { id: 'announcements', label: 'Pengumuman', icon: Bell },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
                          { id: 'profil', label: 'Profil Saya', icon: User },
                          { id: 'walkie_talkie', label: 'Walkie Talkie', icon: Radio },
                          { id: 'developer_feedback', label: 'Lapor & Saran Dev', icon: MessageSquare }
                        ].map((item: any) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'walkie_talkie') {
                                window.dispatchEvent(new CustomEvent('open-walkie-talkie'));
                                setShowSidebar(false);
                                return;
                              }
                              if (item.id === 'developer_feedback') {
                                window.dispatchEvent(new CustomEvent('open-developer-feedback'));
                                setShowSidebar(false);
                                return;
                              }
                              setViewMode(item.id);
                              setShowSidebar(false);
                            }}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black transition-all duration-300 italic ${
                              viewMode === item.id 
                                ? 'bg-[#3e2723] text-white shadow-xl shadow-black/40 border-b-4 border-black' 
                                : 'bg-transparent text-stone-400 hover:bg-stone-800 hover:text-white'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-amber-200' : 'text-stone-600'}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-stone-950">
                <button
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-rose-600 border-b-4 border-rose-900 transition-all active:scale-95 shadow-lg shadow-rose-900/30 italic"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Sistem
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-stone-950/80 border-white/5' : 'bg-[#fcfaf6]/80 border-stone-200'} backdrop-blur-xl border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between relative font-sans">
          <div className="flex items-center gap-3 text-left">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-stone-900 text-amber-200 shadow-lg shadow-black/20' 
                  : 'bg-white text-[#3e2723] shadow-sm border border-stone-100'
              } active:scale-95`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className={`text-[11px] font-black uppercase tracking-widest font-display italic ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                {viewTitles[viewMode] || 'Dashboard'}
              </h1>
              <p className={`text-[8px] font-bold uppercase tracking-widest opacity-50 italic ${isDarkMode ? 'text-amber-100' : 'text-[#8b5e3c]'}`}>
                Principal Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
               onClick={() => setIsDarkMode(!isDarkMode)}
               className={`w-9 h-9 flex items-center justify-center rounded-xl ${isDarkMode ? 'bg-stone-800 text-amber-200' : 'bg-white text-[#3e2723]'} shadow-sm border border-stone-100 transition-all active:scale-90`}
             >
               <Activity className={`w-4 h-4 transition-transform duration-500 ${isDarkMode ? 'rotate-180' : 'rotate-0'}`} />
             </button>
          </div>
        </div>
      </header>

      {/* Dynamic Styling for the Announcement Marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Image Banner Section */}
      <div className="max-w-7xl mx-auto w-full px-4 mt-4">
        {imageBanner && imageBanner.isActive && imageBanner.imageUrl && (
          <div className="relative group/banner overflow-hidden rounded-[2rem] shadow-lg border border-slate-200/10 mb-4 bg-slate-100/5 dark:bg-slate-800/10 transition-all duration-300 hover:shadow-indigo-500/10">
            {/* Click to open Lightbox directly */}
            <div 
              onClick={() => setIsLightboxOpen(true)}
              className="cursor-zoom-in relative block w-full overflow-hidden"
            >
              <img 
                src={imageBanner.imageUrl} 
                alt={imageBanner.title || "Banner Gambar"} 
                className="w-full max-h-[360px] object-cover hover:scale-[1.015] transition-transform duration-700 rounded-[2rem]"
              />
              <div className="absolute inset-0 bg-black/[0.04] hover:bg-black/[0.08] transition duration-300" />
              
              {/* Tap to Zoom Indicator Overlay */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[8px] font-black uppercase tracking-wider text-slate-100 px-2.5 py-1.5 rounded-lg border border-white/5 opacity-0 group-hover/banner:opacity-100 transition duration-300 flex items-center gap-1.5 shadow-lg">
                <Search className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                Klik untuk Memperbesar
              </div>
            </div>
            
            {/* Title & Metadata overlay at the bottom with dark secure contrast gradient */}
            {(imageBanner.title || imageBanner.linkUrl) && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-4 md:p-5 pt-16 text-white rounded-b-[2rem] flex flex-col sm:flex-row sm:items-end justify-between gap-3 pointer-events-none">
                {imageBanner.title && (
                  <div className="max-w-full sm:max-w-[70%]">
                    <span className="text-[8px] font-mono tracking-widest text-amber-300 font-bold uppercase italic block mb-0.5">PENGUMUMAN PENTING</span>
                    <h3 className="text-xs sm:text-sm font-black tracking-wide uppercase italic line-clamp-2 leading-tight drop-shadow-md text-slate-100">{imageBanner.title}</h3>
                  </div>
                )}
                {imageBanner.linkUrl && (
                  <a 
                    href={imageBanner.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="pointer-events-auto bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-[9px] uppercase tracking-widest px-3.5 py-2 rounded-xl shadow-lg border border-indigo-500/20 transition flex items-center gap-1.5 ml-auto sm:ml-0 shrink-0"
                  >
                    Buka Tautan
                    <ChevronRight className="w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Modal Overlay */}
        <AnimatePresence>
          {isLightboxOpen && imageBanner && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLightboxOpen(false)}
              className="fixed inset-0 z-[999] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-xl cursor-zoom-out"
            >
              <motion.div
                initial={{ scale: 0.92, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 15 }}
                transition={{ type: 'spring', damping: 24, stiffness: 210 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center justify-center bg-slate-900/40 rounded-3xl overflow-hidden p-2 border border-white/5 shadow-2xl"
              >
                <img 
                  src={imageBanner.imageUrl} 
                  alt={imageBanner.title || "Full Banner Gambar"} 
                  className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl select-none"
                  referrerPolicy="no-referrer"
                />
                
                {/* Info Overlay at the bottom */}
                {(imageBanner.title || imageBanner.linkUrl) && (
                  <div className="absolute bottom-4 inset-x-4 bg-black/75 backdrop-blur-md px-5 py-4 text-white text-center rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-2">
                    {imageBanner.title && (
                      <h3 className="text-xs sm:text-sm font-black tracking-wide uppercase italic text-slate-100">{imageBanner.title}</h3>
                    )}
                    {imageBanner.linkUrl && (
                      <a 
                        href={imageBanner.linkUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow-lg border border-indigo-500/30 transition-all duration-350"
                      >
                        <LucideImage className="w-3.5 h-3.5" />
                        Kunjungi Tautan Referensi
                      </a>
                    )}
                  </div>
                )}

                {/* Close Button at top-right */}
                <button 
                  onClick={() => setIsLightboxOpen(false)}
                  className="absolute top-4 right-4 bg-black/60 text-white hover:bg-black/95 p-2.5 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Magnificent Unified Strategic Header Banner & Real-time Clock */}
      <div className="max-w-7xl mx-auto w-full px-4 mt-4">
        <div className="p-[1px] rounded-2xl bg-gradient-to-r from-[#d7ccc8]/40 via-[#8b5e3c]/40 to-[#d7ccc8]/40 shadow-sm">
          <div className="bg-gradient-to-br from-[#3e2723] to-[#5d4037] p-5 md:p-6 rounded-[15px] border border-[#5d4037]/60 relative overflow-hidden group text-white flex flex-col gap-4 text-left">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full -mb-32 -mr-32 blur-[60px]" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-6 h-0.5 bg-amber-200 rounded-full" />
                  <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/95 italic">Portal Pimpinan Utama</h4>
                </div>
                <h1 className="text-lg md:text-xl font-black font-display text-white leading-tight italic">
                  Selamat Datang, Bapak Kepala Sekolah
                </h1>
                <p className="text-[#ebdccb] font-bold uppercase text-[7.5px] tracking-[0.1em] italic opacity-90 mt-1">
                  Sistem Real-Time Pemantauan, Respon, dan Kerja Strategis Civitas SRMA 24 Kediri
                </p>
              </div>

              {/* Real-time Clock nested elegantly inside the banner */}
              <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/5 shadow-inner">
                  <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-ping shrink-0" />
                  <p className="text-[9.5px] font-mono font-black uppercase tracking-[0.15em] text-amber-200 leading-none">
                    {formatRealTime(currentTime)}
                  </p>
                </div>
                <div className="flex gap-4 text-[8px] font-bold text-stone-300 uppercase italic px-1">
                  <span>Siswa: <strong className="text-white">{stats.totalSiswa}</strong></span>
                  <span>Memo: <strong className="text-white">{memos.length}</strong></span>
                  <span>Pengumuman: <strong className="text-white">{stats.activeAnnouncements}</strong></span>
                </div>
              </div>
            </div>

            {/* Dynamic Sliding Announcement Ticker */}
            {announcements.filter(a => a.isActive).length > 0 ? (
              <div className="relative z-10 bg-white/10 border border-white/5 rounded-xl p-2 md:p-2.5 flex items-center gap-3 overflow-hidden shadow-inner">
                <div className="flex items-center gap-1 bg-[#8b5e3c] text-white px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider italic shrink-0 shadow-sm border border-[#a17855]/35">
                  <Bell className="w-3 h-3 text-amber-250 animate-bounce" />
                  <span>COMMUNIQUE</span>
                </div>
                <div className="flex-1 overflow-hidden relative h-4 flex items-center">
                  <div className="animate-marquee flex gap-16 text-[9.5px] font-black italic tracking-wider text-amber-100">
                    {announcements.filter(a => a.isActive).map((ann, i) => (
                      <span key={ann.id || i} className="flex items-center gap-2">
                        <span className="text-amber-300">★</span>
                        <strong>{ann.title}:</strong> {ann.content}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 bg-white/5 border border-white/5 rounded-xl p-2 flex items-center gap-2 text-[8px] font-bold italic tracking-wide text-stone-300">
                <Bell className="w-3.5 h-3.5 text-stone-300/45 shrink-0" />
                <span>Belum ada pengumuman pimpinan yang aktif saat ini.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className={`p-4 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}

        {viewMode === 'jurnal_keperawatan' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <JurnalKeperawatanView user={user} />
          </div>
        )}

        {viewMode === 'catatan_perkembangan' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <ProgressRecordsView user={user} />
          </div>
        )}

        {viewMode === 'sarpras' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 text-left">
            {/* Header style */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-md overflow-hidden border border-[#5d4037] relative">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0 -rotate-2">
                    <Wrench className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Sarpras & Inventaris</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                        PIMPINAN
                      </span>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-85">
                      MONITORING KERUSAKAN FASILITAS ASRAMA & KLINIK
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => {
                        const filtered = sarprasReports.filter(r => {
                          const date = r.tgl_lapor && typeof r.tgl_lapor.toDate === 'function' ? r.tgl_lapor.toDate() : null;
                          if (!date) return false;
                          return isThisWeek(date);
                        });
                        generateSarprasSummaryPDF(filtered, 'minggu_ini', { name: user.name, role: user.role });
                      }}
                      className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
                    >
                      <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider italic">MINGGU</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                    <button 
                      onClick={() => {
                        const filtered = sarprasReports.filter(r => {
                          const date = r.tgl_lapor && typeof r.tgl_lapor.toDate === 'function' ? r.tgl_lapor.toDate() : null;
                          if (!date) return false;
                          return isThisMonth(date);
                        });
                        generateSarprasSummaryPDF(filtered, 'bulan_ini', { name: user.name, role: user.role });
                      }}
                      className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
                    >
                      <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider italic">BULAN</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Filter Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Filter By Status */}
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
                {[
                  { id: 'all', label: 'Semua Laporan' },
                  { id: 'pending', label: 'Menunggu' },
                  { id: 'on_progress', label: 'Diproses' },
                  { id: 'fixed', label: 'Selesai' }
                ].map((f) => {
                  const count = f.id === 'all' 
                    ? sarprasReports.length 
                    : sarprasReports.filter(r => r.status === f.id).length;

                  return (
                    <button
                      key={f.id}
                      onClick={() => setSarprasStatusFilter(f.id as any)}
                      className={`px-3.5 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                        sarprasStatusFilter === f.id 
                          ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-[1.02]' 
                          : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100/70'
                      }`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Filter By Time & Search bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                <select
                  value={sarprasFilter}
                  onChange={(e) => setSarprasFilter(e.target.value as any)}
                  className="w-full sm:w-auto bg-stone-50 border border-stone-100 rounded-lg py-2 px-3 text-[8.5px] font-black uppercase tracking-wider text-[#3e2723] transition-all italic outlook-none"
                >
                  <option value="semua">Semua Waktu</option>
                  <option value="minggu_ini">Minggu Ini</option>
                  <option value="bulan_ini">Bulan Ini</option>
                </select>

                <div className="relative w-full sm:w-48 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                  <input
                    type="text"
                    value={sarprasSearch}
                    onChange={(e) => setSarprasSearch(e.target.value)}
                    placeholder="Cari Sarpras..."
                    className="w-full bg-stone-50 border border-stone-100 rounded-lg pl-8 pr-3 py-2 text-[8px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-[#3e2723] transition-all italic text-[#3e2723]"
                  />
                </div>
              </div>
            </div>

            {/* List reports cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {sarprasReports
                  .filter((report) => {
                    // Search query matches
                    const matchesSearch = sarprasSearch ? (
                      report.item_name?.toLowerCase().includes(sarprasSearch.toLowerCase()) ||
                      report.location?.toLowerCase().includes(sarprasSearch.toLowerCase()) ||
                      report.damage_description?.toLowerCase().includes(sarprasSearch.toLowerCase()) ||
                      report.author_name?.toLowerCase().includes(sarprasSearch.toLowerCase())
                    ) : true;
                    if (!matchesSearch) return false;

                    // Filter with status
                    if (sarprasStatusFilter !== 'all' && report.status !== sarprasStatusFilter) {
                      return false;
                    }

                    // Filter with time
                    const d = report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? report.tgl_lapor.toDate() : null;
                    if (!d) return true;
                    if (sarprasFilter === 'minggu_ini') return isThisWeek(d);
                    if (sarprasFilter === 'bulan_ini') return isThisMonth(d);
                    
                    return true;
                  })
                  .map((report, idx) => {
                    const rDate = report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? report.tgl_lapor.toDate() : null;
                    
                    return (
                      <motion.div
                        key={report.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ delay: idx * 0.02 }}
                        className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between"
                        id={`sarpras-card-${report.id}`}
                      >
                        <div className={`absolute top-0 right-0 w-1.5 h-full transition-all duration-300 ${
                          report.status === 'fixed' ? 'bg-emerald-500' :
                          report.status === 'on_progress' ? 'bg-blue-500' : 'bg-red-500'
                        }`} />
                        
                        <div className="flex flex-col gap-3 w-full">
                          <div className="flex justify-between items-start w-full">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                report.status === 'fixed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                report.status === 'on_progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                              }`}>
                                <Wrench className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-[7px] font-bold text-stone-300 uppercase tracking-wider italic">
                                  {rDate ? format(rDate, 'dd MMM yyyy • HH:mm', { locale: id }) : '-'}
                                </p>
                                <h4 className="text-xs font-black text-[#3e2723] uppercase italic leading-tight">{report.item_name}</h4>
                                <p className="text-[8px] font-bold text-[#8b5e3c] uppercase mt-0.5 italic">{report.asrama} <span className="text-stone-300">•</span> {report.location}</p>
                              </div>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-wider italic ${
                              report.status === 'fixed' ? 'bg-emerald-100 text-emerald-800' :
                              report.status === 'on_progress' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {report.status === 'fixed' ? 'Selesai' : report.status === 'on_progress' ? 'Diproses' : 'Menunggu'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-[#fcfaf6] rounded-lg border border-stone-50/85">
                            <p className="text-[10px] font-medium text-slate-700 italic">
                              "{report.damage_description}"
                            </p>
                          </div>

                          {/* Action update status direct by Principal */}
                          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 mt-auto">
                            <div className="flex items-center gap-1.5 text-[8px] text-stone-400 font-bold italic">
                              <span>Oleh: {report.author_name}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => generateSarprasReportPDF(report)}
                                className="p-1.5 hover:bg-stone-50 text-[#3e2723] border border-stone-200/80 rounded transition-all active:scale-95"
                                title="Cetak Detail"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              
                              <div className="flex items-center bg-stone-100/80 p-0.5 rounded border border-stone-200/40">
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'sarpras_reports', report.id!), { 
                                        status: 'pending',
                                        updatedAt: serverTimestamp(),
                                        last_updated_by: user.name
                                      });
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 text-[6.5px] font-black rounded uppercase tracking-wider transition-all ${
                                    report.status === 'pending'
                                      ? 'bg-rose-600 text-white'
                                      : 'text-stone-400 hover:text-rose-600'
                                  }`}
                                >
                                  Tunggu
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'sarpras_reports', report.id!), { 
                                        status: 'on_progress',
                                        updatedAt: serverTimestamp(),
                                        last_updated_by: user.name
                                      });
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 text-[6.5px] font-black rounded uppercase tracking-wider transition-all ${
                                    report.status === 'on_progress'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-stone-400 hover:text-blue-600'
                                  }`}
                                >
                                  Proses
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'sarpras_reports', report.id!), { 
                                        status: 'fixed',
                                        updatedAt: serverTimestamp(),
                                        last_updated_by: user.name
                                      });
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 text-[6.5px] font-black rounded uppercase tracking-wider transition-all ${
                                    report.status === 'fixed' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-emerald-600'
                                  }`}
                                >
                                  Selesai
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>

              {sarprasReports.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <ShieldCheck className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
                  <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic">Belum ada laporan kerusakan sarpras</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'beranda' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-[#ebdccb]/50 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-[11px] font-black uppercase tracking-wider text-[#3e2723] flex items-center gap-2 italic">
                         <Activity className="w-4 h-4 text-[#8b5e3c]" />
                         Log Aktivitas Terbaru
                       </h3>
                       <button onClick={() => setViewMode('perizinan_global')} className="text-[8.5px] font-black uppercase tracking-widest text-stone-400 hover:text-[#3e2723] transition-colors italic">Lihat Semua</button>
                    </div>
                    <div className="space-y-3">
                       {recentPermits.map(permit => (
                         <div key={permit.id} className="p-3 bg-[#fcfaf6] rounded-xl border border-[#ebdccb]/30 flex items-center justify-between group hover:bg-[#3e2723] hover:text-white transition-all duration-300">
                           <div className="flex items-center gap-3">
                             <div className="p-2 bg-[#d7ccc8]/30 text-[#3e2723] rounded-lg group-hover:scale-105 group-hover:bg-white/10 group-hover:text-amber-200 transition-all shrink-0">
                               {permit.tipe === 'sakit' ? <Activity className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                             </div>
                             <div className="text-left">
                               <h4 className="font-extrabold text-[11px] uppercase tracking-tight group-hover:text-white transition-colors">{permit.nama_siswa}</h4>
                               <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest group-hover:text-amber-200/70 transition-colors uppercase italic leading-none mt-1">{permit.kelas} • {permit.tipe}</p>
                             </div>
                           </div>
                           <div className="text-right">
                              <span className="px-3 py-1 bg-white border border-stone-200/50 text-[#3e2723] text-[7.5px] font-black rounded-lg uppercase tracking-wider group-hover:bg-white/10 group-hover:border-transparent group-hover:text-white uppercase italic leading-none">{permit.status}</span>
                           </div>
                         </div>
                       ))}
                       {recentPermits.length === 0 && (
                         <div className="text-center py-12 text-stone-300 font-bold uppercase tracking-widest text-[8.5px] italic">Belum ada aktivitas terbaru</div>
                       )}
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-[#ebdccb]/50 shadow-sm flex flex-col h-full italic">
                     <h3 className="text-[11px] font-black uppercase tracking-wider text-[#3e2723] mb-4 flex items-center gap-2 italic">
                       <Mail className="w-4 h-4 text-[#8b5e3c]" />
                       Pesan Memorandum
                     </h3>
                     <div className="space-y-2.5 flex-1">
                        {memos.slice(0, 5).map(memo => (
                          <div key={memo.id} onClick={() => setSelectedMemo(memo)} className="p-3 bg-[#fcfaf6] rounded-xl border border-[#ebdccb]/35 cursor-pointer hover:bg-[#3e2723] hover:text-white transition-all duration-300 group text-left">
                            <h4 className="font-extrabold text-[11px] uppercase tracking-tight line-clamp-1 italic text-[#3e2723] group-hover:text-white">{memo.perihal}</h4>
                            <p className="text-[7px] font-bold text-stone-400 mt-1 uppercase tracking-widest group-hover:text-amber-200/70 uppercase">DARI: {memo.pengirim_name}</p>
                          </div>
                        ))}
                         {memos.length === 0 && (
                          <div className="text-center py-8 text-stone-200">
                            <Mail className="w-8 h-8 mx-auto opacity-20" />
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="w-full mix-blend-normal space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            
            {/* Dynamic Header Block (Compact, aligned with Mading/Memorandum style) */}
            <div className="bg-[#3e2723] rounded-2xl p-4 md:p-5 text-white relative overflow-hidden shadow-md border border-[#5d4037]/60">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shadow-black/20 shrink-0">
                    <Mail className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Memorandum</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10">
                        OFFICIAL
                      </span>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-80 leading-snug">
                      Instruksi & Komunikasi Strategis Pimpinan
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowMemoForm(!showMemoForm)}
                  className={`group px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm italic border-b-2 shrink-0 ${
                    showMemoForm 
                    ? 'bg-[#5d4037] text-stone-300 border-[#2d1e1a] hover:bg-[#2d1e1a]' 
                    : 'bg-[#fcfaf6] text-[#3e2723] border-[#d7ccc8] hover:bg-white'
                  }`}
                >
                  {showMemoForm ? 'Batal' : (
                    <>
                      <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                      Terbitkan Memo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inline sliding post write form (Compact, aligned with Mading formulation) */}
            <AnimatePresence>
              {showMemoForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#fcfaf6] rounded-2xl p-5 shadow-lg border border-[#d7ccc8]/30">
                    <form onSubmit={handleCreateMemo} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-left">
                          <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] ml-0.5 italic">
                            Subjek / Perihal Memorandum
                          </label>
                          <div className="relative">
                            <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                            <input
                              type="text"
                              required
                              value={memoSubject}
                              onChange={(e) => setMemoSubject(e.target.value)}
                              placeholder="Input perihal perintah strategis..."
                              className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-[#3e2723] italic outline-none focus:ring-1 focus:ring-[#3e2723] shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 text-left">
                          <div className="flex items-center justify-between ml-0.5">
                            <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] italic">
                              Unit / Staff Tujuan
                            </label>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => setMemoRecipients([])}
                                className="text-[7px] font-black text-[#5d4037] hover:underline uppercase tracking-wider italic transition-colors"
                              >
                                Bersihkan
                              </button>
                              <button 
                                type="button"
                                onClick={selectAllRoles}
                                className="text-[7px] font-black text-[#5d4037] px-2 py-0.5 bg-[#d7ccc8]/60 rounded uppercase tracking-wider hover:bg-[#3e2723] hover:text-white transition-all italic border-b"
                              >
                                Semua Staff
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5 bg-[#fdfcf0]/80 p-2 rounded-xl border border-[#d7ccc8]/30 shadow-inner">
                            {[
                              { id: 'wali_asrama', label: 'Asrama', icon: Home },
                              { id: 'dokter', label: 'Dokter', icon: Activity },
                              { id: 'wali_asuh', label: 'Asuh', icon: User },
                              { id: 'guru_mapel', label: 'Mapel', icon: BookOpen },
                              { id: 'wali_kelas', label: 'Kelas', icon: IdCard }
                            ].map((role) => {
                              const isSelected = memoRecipients.includes(role.id as UserRole);
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={() => toggleRecipient(role.id as UserRole)}
                                  className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all border-b italic flex items-center gap-1.5 shrink-0 ${
                                    isSelected
                                    ? 'bg-[#3e2723] text-white border-black shadow-md'
                                    : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
                                  }`}
                                >
                                  <role.icon className={`w-3 h-3 ${isSelected ? 'text-amber-200' : 'text-stone-300'}`} />
                                  {role.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] ml-0.5 italic">
                          Narasi Instruksi
                        </label>
                        <textarea
                          required
                          value={memoContent}
                          onChange={(e) => setMemoContent(e.target.value)}
                          placeholder="Tuliskan detail instruksi atau informasi strategis di sini secara jelas..."
                          className="w-full bg-white border border-stone-200 rounded-xl p-3 min-h-[120px] text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#3e2723] shadow-inner placeholder:text-stone-300 italic"
                        />
                      </div>

                      <div className="flex justify-end pt-3 border-t border-stone-150">
                        <button
                          type="submit"
                          disabled={isSubmittingMemo}
                          className="w-full sm:w-auto bg-[#3e2723] text-white px-5 py-2 rounded-xl font-black uppercase tracking-[0.2em] shadow hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-[9px] italic border-b-2 border-stone-950 flex items-center justify-center gap-2"
                        >
                          {isSubmittingMemo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                              Memproses...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 text-amber-200 rotate-45" />
                              Sahkan & Kirim Memo
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Archives and Listing (Compact, aligned with Mading exactly) */}
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-sm shrink-0">
                    <History className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Arsip Memorandum</h3>
                    <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.15em] italic mt-1 leading-none">
                      Log Komunikasi Internal
                    </p>
                  </div>
                </div>
                
                <div className="relative w-full md:w-64 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                  <input
                    type="text"
                    value={memoSearch}
                    onChange={(e) => setMemoSearch(e.target.value)}
                    placeholder="Filter memo..."
                    className="w-full bg-white border border-stone-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-[#3e2723] transition-all italic text-[#3e2723] shadow-inner placeholder:text-stone-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMemos.map((memo, idx) => {
                  const isAdminUser = user.role === 'kepala_sekolah';
                  const memoDate = memo.tgl_memo?.toDate ? memo.tgl_memo.toDate() : new Date();

                  const isExpanded = expandedMemos[memo.id!] || false;
                  const shouldTruncate = memo.isi.length > 200;
                  const displayText = shouldTruncate && !isExpanded 
                    ? memo.isi.slice(0, 200) + '...' 
                    : memo.isi;

                  return (
                    <motion.div
                      layout
                      key={memo.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden text-left flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 w-1.5 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-500" />
                      
                      <div className="space-y-4 w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 md:gap-3">
                             <div className="w-8 h-8 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-xs">
                               {memo.pengirim_name?.charAt(0).toUpperCase() || 'M'}
                             </div>
                             <div className="text-left">
                               <p className="font-extrabold text-[#3e2723] text-[10px] leading-none italic">
                                 {memo.pengirim_name}
                               </p>
                               <p className="text-[6px] font-black text-[#5d4037] uppercase tracking-[0.1em] bg-stone-50 px-1.5 py-0.5 rounded italic mt-1 inline-block leading-none">
                                 Pimpinan
                               </p>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-[#ea580c] uppercase tracking-widest italic bg-orange-50 px-2 py-0.5 rounded">
                              {format(memoDate, 'dd MMM yyyy')}
                            </span>
                            {isAdminUser && (
                              <button
                                onClick={(e) => handleDeleteMemo(e, memo.id!)}
                                className="w-7 h-7 bg-stone-50 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all flex items-center justify-center border border-transparent hover:border-rose-100 shrink-0"
                                title="Hapus Memorandum"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-[7.5px] font-black text-stone-300 uppercase tracking-[0.15em] font-mono block">
                            #{memo.nomor_memo}
                          </span>
                          <h4 className="font-extrabold text-[#3e2723] text-xs leading-snug uppercase italic tracking-tight font-display hover:text-[#ea580c] transition-colors">
                            {memo.perihal}
                          </h4>
                        </div>

                        <div className="relative pl-3 border-l-2 border-[#3e2723]/10">
                          <p className="text-[#3e2723] text-[11px] italic leading-relaxed whitespace-pre-wrap">
                            "{displayText}"
                          </p>
                          {shouldTruncate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandMemo(memo.id!);
                              }}
                              className="text-[#5d4037] hover:text-[#3e2723] font-black text-[7px] uppercase tracking-widest italic mt-2 inline-flex items-center gap-1 bg-stone-50 hover:bg-stone-100 px-2 py-1 rounded transition-all select-none"
                            >
                              {isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}
                            </button>
                          )}
                        </div>

                        {/* Destination list inside memorandum styled beautifully */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[6px] font-black text-stone-400 uppercase tracking-widest block w-full mb-0.5 italic">Ditujukan Kepada:</span>
                          {memo.penerima.map((role) => (
                            <span key={role} className="px-2 py-0.5 bg-[#fcfaf6] text-[7px] font-black text-[#8b5e3c] uppercase tracking-wider rounded border border-[#ebdccb]/30">
                              {getRoleLabel(role)}
                            </span>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[7px] font-black uppercase text-stone-400 tracking-wider">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#3e2723]/40 shrink-0" />
                            <span>{format(memoDate, 'EEEE, d MMMM yyyy • HH:mm', { locale: id })} WIB</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateMemorandumPDF(memo);
                            }}
                            className="flex items-center gap-1 py-1 px-2.5 bg-[#ebdccb]/60 hover:bg-[#3e2723] hover:text-white text-[7px] font-black uppercase tracking-wider text-[#3e2723] rounded transition-all active:scale-95"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Cetak PDF</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {filteredMemos.length === 0 && (
                  <div className="lg:col-span-2 flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-stone-50 relative overflow-hidden">
                    <Mail className="w-12 h-12 text-stone-100 mb-3 opacity-50" />
                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] italic">Arsip memorandum tidak ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'perizinan_global' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 text-left">
            {/* Minimal Proportional Header */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 shadow-md text-white relative overflow-hidden border border-[#5d4037]">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Kendali Perizinan</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10 italic">GLOBAL AUDIT</span>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-85">Monitoring Surat Keterangan Sakit & Izin Umum Bimbel/Dormitory</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisWeek(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Minggu Ini', user.name, 'Kepala Sekolah');
                      }}
                      className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
                    >
                      <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider italic">MINGGU</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisMonth(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Bulan Ini', user.name, 'Kepala Sekolah');
                      }}
                      className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
                    >
                      <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider italic">BULAN</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Audit nama siswa atau no surat..."
                  className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[#3e2723] text-[9px] font-black uppercase tracking-widest italic placeholder:text-stone-300 shadow-inner"
                  value={perizinanSearch}
                  onChange={(e) => setPerizinanSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
                {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3.5 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                      timeFilter === filter 
                        ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-[1.02]' 
                        : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100/70'
                    }`}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      initial={{ opacity: 0, scale: 0.98, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      onClick={() => setSelectedPermit(permit)}
                      className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="absolute top-0 right-0 w-1 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#fcfaf6] flex items-center justify-center border border-stone-100 group-hover:bg-[#3e2723] transition-all duration-300 shrink-0">
                              <FileText className="w-4 h-4 text-[#3e2723]/60 group-hover:text-amber-200" />
                            </div>
                            <div className="text-left">
                              <p className="text-[7px] font-bold text-stone-300 uppercase tracking-widest italic leading-none">LOG #{permit.nomor_surat}</p>
                              <h4 className="text-xs font-black text-[#3e2723] uppercase italic leading-tight mt-1">{permit.nama_siswa}</h4>
                              <p className="text-[8px] font-bold text-[#8b5e3c] uppercase mt-0.5 italic">{permit.kelas}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#fcfaf6] p-2.5 rounded-lg border border-stone-50/85 relative">
                          <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mb-1 italic">Keperluan / Diagnosa:</p>
                          <p className="text-[9.5px] font-semibold text-slate-700 italic leading-normal">"{permit.diagnosa || permit.alasan || '-'}"</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-auto">
                          <div className="flex items-center gap-1.5 text-[8px] text-stone-400 font-bold italic">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {permit.tgl_surat ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy', { locale: id }) : '-'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                generatePermitPDF(permit);
                              }}
                              className="p-1 text-[#3e2723] border border-stone-200 hover:bg-[#3e2723] hover:text-white rounded transition-colors duration-200"
                              title="Cetak PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-wider italic border-b [transition:all_300ms_ease] ${
                              permit.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {(permit.status || 'PENDING').replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {permits.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <FileSearch className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
                  <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest italic leading-tight mb-2">Data Nihil</h3>
                  <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest leading-relaxed max-w-xs italic text-center">Sistem audit tidak menemukan rekaman data perizinan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'cek_ketidakhadiran' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 text-left">
            {/* Minimal Proportional Header */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 shadow-md text-white relative overflow-hidden border border-[#5d4037]">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Cek Ketidakhadiran</h1>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-85">
                      Monitoring & Audit Riwayat Ketidakhadiran Peserta Didik oleh Wali Asuh / Wali Asrama
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    onClick={() => handlePrintSummaryPDF('Minggu Ini')}
                    disabled={loading}
                    className="bg-[#4e342e] hover:bg-black/30 text-amber-200 text-[7.5px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg border border-amber-500/10 transition-all flex items-center justify-center gap-1.5 italic active:scale-95 disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>REKAP MINGGUAN</span>
                  </button>
                  <button
                    onClick={() => handlePrintSummaryPDF('Bulan Ini')}
                    disabled={loading}
                    className="bg-[#4e342e] hover:bg-black/30 text-amber-200 text-[7.5px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg border border-amber-500/10 transition-all flex items-center justify-center gap-1.5 italic active:scale-95 disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>REKAP BULANAN</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter and Search controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Category Time Filters */}
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
                {[
                  { id: 'hari_ini', label: `Hari Ini (${khStats.hariIni})` },
                  { id: 'kemarin', label: `Kemarin (${khStats.kemarin})` },
                  { id: 'minggu_ini', label: `Minggu Ini (${khStats.mingguIni})` },
                  { id: 'bulan_ini', label: `Bulan Ini (${khStats.bulanIni})` },
                  { id: 'semua', label: `Semua (${ketidakhadiranData.length})` }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setKhTimeFilter(cat.id as any)}
                    className={`px-3.5 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                      khTimeFilter === cat.id
                        ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-[1.02]' 
                        : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100/70'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search input field */}
              <div className="relative max-w-sm w-full md:w-48 group shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                <input
                  type="text"
                  placeholder="Cari kegiatan, kelas, atau nama..."
                  value={khSearchTerm}
                  onChange={(e) => setKhSearchTerm(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-100 rounded-lg pl-8 pr-3 py-2 text-[8px] outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[#3e2723] font-black uppercase tracking-widest italic placeholder:text-stone-300 shadow-inner"
                />
              </div>
            </div>

            {/* List / Grid of records */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left font-sans">
              {filteredKetidakhadiran.length > 0 ? (
                filteredKetidakhadiran.map((rec) => {
                  const recDate = parseFirestoreDate(rec.tgl_absen) || new Date();
                  const formattedDate = format(recDate, 'EEEE, d MMM yyyy • HH:mm', { locale: id });
                  return (
                    <div 
                      key={rec.id}
                      className="bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md p-4 transition-all duration-300 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#f5ebe0] text-[#3e2723] font-black flex items-center justify-center text-[10px] shadow-inner shrink-0 italic border border-[#ebdccb]/30">
                            {rec.kelas?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-xs text-[#3e2723] uppercase italic tracking-tight leading-none truncate">
                                {rec.keterangan_kegiatan}
                              </h4>
                              <span className="bg-[#5d4037] text-amber-200 text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                                {rec.kelas}
                              </span>
                            </div>
                            <p className="text-[7px] font-bold text-[#8d6e63]/85 uppercase mt-1 italic">
                              Oleh: {rec.author_name} ({rec.author_role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama'})
                            </p>
                          </div>
                        </div>
                        <span className="text-[7.5px] font-black text-stone-300 font-mono tracking-wider shrink-0 mt-0.5">
                          {rec.nomor_surat || ''}
                        </span>
                      </div>

                      <div className="bg-[#fcfaf6] p-2.5 rounded-lg border border-stone-50/85 space-y-2 text-left">
                        <div className="flex items-center gap-1 text-[7px] font-bold text-stone-400 uppercase tracking-widest">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Siswa Tidak Hadir ({rec.daftar_siswa.length})</span>
                        </div>
                        <p className="text-[9.5px] font-semibold text-slate-700 font-sans pl-1 break-words leading-normal italic">
                          {rec.daftar_siswa.join(', ')}
                        </p>
                      </div>

                      {rec.deskripsi && (
                        <div className="text-[9.5px] text-[#5d4037] pl-1 text-left">
                          <span className="font-bold text-[#3e2723] block mb-0.5 uppercase text-[7px] tracking-widest">Keterangan:</span>
                          <p className="leading-normal font-sans italic">"{rec.deskripsi}"</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                        <div className="flex items-center gap-1 text-[7.5px] font-bold text-stone-400 mt-auto">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formattedDate}</span>
                        </div>
                        <button
                          onClick={async () => {
                            setKhPdfLoading(rec.id!);
                            try {
                              await generateKetidakhadiranPDF(rec);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setKhPdfLoading(null);
                            }
                          }}
                          disabled={khPdfLoading === rec.id}
                          className="flex items-center gap-1 py-1 px-2.5 bg-[#ebdccb]/60 hover:bg-[#3e2723] hover:text-white text-[7px] font-black uppercase tracking-wider text-[#3e2723] rounded transition-all active:scale-95 disabled:opacity-50"
                        >
                          {khPdfLoading === rec.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Printer className="w-3 h-3 text-amber-200" />
                          )}
                          <span>Detail PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <ClipboardCheck className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
                  <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest italic leading-tight mb-2">Data Nihil</h3>
                  <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest leading-relaxed max-w-xs italic text-center">Tidak ada rekaman data ketidakhadiran pada kategori ini.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(viewMode === 'statistik' || viewMode === 'pangkalan_data') && (
          <div className="bg-white p-6 rounded-2xl border border-stone-100 text-center flex flex-col items-center justify-center space-y-4 py-12 min-h-[40vh] shadow-sm italic animate-in fade-in duration-500">
             <div className="p-4 bg-[#fcfaf6] rounded-full border border-[#d7ccc8]/30 animate-pulse">
                <FileSearch className="w-10 h-10 text-[#8b5e3c]" />
             </div>
             <div className="max-w-sm">
                <h2 className="text-sm font-black italic mb-2 text-[#3e2723]">Layanan Data Strategis</h2>
                <p className="text-stone-400 font-bold uppercase tracking-[0.15em] text-[8px] leading-relaxed italic">
                  Modul ini sedang disinkronisasikan untuk akurasi data pimpinan. Silakan gunakan dashboard utama untuk pemantauan operasional real-time.
                </p>
             </div>
             <button onClick={() => setViewMode('beranda')} className="px-5 py-2 bg-[#3e2723] text-white font-black rounded-xl uppercase tracking-wider text-[9px] shadow-sm hover:opacity-90 transition-all italic active:scale-95">
                Kembali ke Dashboard
             </button>
          </div>
        )}

        {viewMode === 'announcements' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
            {/* Header section with brown style */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-md overflow-hidden border border-[#5d4037] relative">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0 -rotate-2">
                    <Bell className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Kelola Pengumuman</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                        AKTIF
                      </span>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-85">
                      Diterbitkan ke dashboard Guru, Wali Asuh, Wali Kelas, Wali Asrama, dan Dokter
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAnnForm(!showAnnForm)}
                  className="px-3.5 py-2 rounded-lg font-black text-[8px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-amber-600 hover:bg-amber-700 text-white italic shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Buat Baru</span>
                </button>
              </div>
            </div>

            {/* Live New Announcement Form */}
            {showAnnForm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 rounded-2xl border border-stone-200/50 shadow-md space-y-4"
              >
                <h3 className="text-xs font-black uppercase tracking-wider text-[#3e2723] flex items-center gap-2 italic">
                  <Bell className="w-4 h-4 text-[#8b5e3c]" />
                  Tulis Pengumuman Baru
                </h3>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4 font-sans text-left pb-2">
                  <div>
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Judul Pengumuman</label>
                    <input
                      type="text"
                      required
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      placeholder="Masukkan judul singkat, padat, jelas..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[10px] font-semibold text-slate-700 italic placeholder:text-stone-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Isi Pengumuman</label>
                    <textarea
                      required
                      value={newAnnContent}
                      onChange={(e) => setNewAnnContent(e.target.value)}
                      placeholder="Deskripsikan pengumuman secara informatif..."
                      rows={3}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[10px] font-semibold text-slate-600 leading-normal italic resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 bg-stone-50 p-3 rounded-lg border border-stone-100/50 max-w-max">
                    <input
                      type="checkbox"
                      id="is_active_ann"
                      checked={newAnnIsActive}
                      onChange={(e) => setNewAnnIsActive(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#3e2723] focus:ring-[#3e2723] border-stone-300 rounded"
                    />
                    <label htmlFor="is_active_ann" className="text-[9px] font-black text-stone-500 uppercase tracking-wider cursor-pointer select-none italic">
                      Aktifkan Langsung di Banner Marquee
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAnn}
                      className="px-4 py-2 bg-[#3e2723] hover:bg-[#5d4037] text-amber-200 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50 italic"
                    >
                      {isSubmittingAnn ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Diterbitkan Pengumuman
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAnnForm(false)}
                      className="px-4 py-2 bg-stone-50 text-stone-400 rounded-lg font-black text-[9px] uppercase tracking-wider border border-stone-200 hover:bg-stone-100 transition-all italic"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* List of Announcements */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {announcements.length === 0 ? (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <Bell className="w-12 h-12 text-stone-100 mb-4 opacity-50 animate-bounce" />
                  <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest italic leading-none mb-2">Belum Ada Pengumuman</h3>
                  <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest leading-relaxed max-w-xs italic text-center">
                    Klik tombol "Buat Baru" untuk menyebarkan pengumuman atau instruksi pimpinan.
                  </p>
                </div>
              ) : (
                announcements.map((ann, idx) => {
                  const annDate = ann.createdAt && typeof ann.createdAt.toDate === 'function' ? ann.createdAt.toDate() : null;
                  return (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm relative group flex flex-col justify-between text-left"
                    >
                      <div className={`absolute top-0 right-0 w-1 h-full rounded-r-xl ${ann.isActive ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[7px] font-bold text-stone-400 uppercase tracking-wider italic">
                              {annDate ? format(annDate, 'dd MMMM yyyy HH:mm', { locale: id }) : '-'}
                            </span>
                            <h4 className="text-xs font-black text-[#3e2723] uppercase italic tracking-tight">{ann.title}</h4>
                          </div>
                          
                          <button
                            onClick={async () => {
                              try {
                                const newStatus = !ann.isActive;
                                await updateDoc(doc(db, 'announcements', ann.id!), { isActive: newStatus });
                              } catch (err) {
                                console.error('Error toggling announcement active status: ', err);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider italic active:scale-95 transition-all ${
                              ann.isActive 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {ann.isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </div>

                        <p className="text-[10px] text-slate-600 leading-normal italic bg-stone-50 p-2.5 rounded-lg border border-stone-100 shadow-inner">
                          "{ann.content}"
                        </p>
                      </div>

                      <div className="pt-2 border-t border-stone-100 mt-4 flex items-center justify-between">
                        <span className="text-[8px] font-bold text-stone-400 uppercase italic">
                          Oleh: {ann.authorName}
                        </span>

                        <button
                          onClick={async () => {
                            if (!window.confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) return;
                            try {
                              await deleteDoc(doc(db, 'announcements', ann.id!));
                            } catch (error) {
                              console.error(error);
                              alert('Gagal menghapus pengumuman!');
                            }
                          }}
                          className="p-1 px-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 border border-stone-200/50 active:scale-95 transition-all text-[8px] font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
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
               className="bg-white w-full max-w-xl rounded-2xl shadow-lg border border-stone-200/50 overflow-hidden relative"
             >
                <div className="p-4 border-b border-stone-100 bg-[#3e2723] flex items-center justify-between text-white italic">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-200" />
                    <h3 className="font-black uppercase tracking-widest text-[8px] italic">Arsip Memorandum Strategis</h3>
                  </div>
                  <button onClick={() => setSelectedMemo(null)} className="p-1 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5 text-amber-200" /></button>
                </div>
                
                <div className="p-5 space-y-4 bg-white">
                  {selectedMemo && (
                    <>
                      <div className="text-left font-sans">
                        <h2 className="text-sm font-black italic text-[#3e2723] leading-snug mb-3 uppercase tracking-tight">{selectedMemo.perihal}</h2>
                        <div className="p-3.5 bg-[#fcfaf6] rounded-lg border border-stone-100 text-[10px] leading-relaxed text-slate-700 whitespace-pre-wrap italic">
                          {selectedMemo.isi}
                        </div>
                        <div className="mt-3.5 flex flex-wrap gap-1">
                          <span className="text-[7px] font-bold text-stone-400 uppercase tracking-widest block w-full mb-0.5 italic">Ditujukan Kepada:</span>
                          {selectedMemo.penerima.map((role) => (
                            <span key={role} className="px-1.5 py-0.5 bg-stone-50 text-[7px] font-black text-[#8b5e3c] uppercase tracking-wider rounded border border-stone-250/20 italic">
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="pt-3 border-t border-[#f8f3ed] flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#3e2723] rounded-lg flex items-center justify-center font-black text-white text-[10px] italic border border-white/20">
                            {selectedMemo.pengirim_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[7px] font-black text-stone-400 uppercase tracking-widest mb-0.5 italic">Diterbitkan Oleh</p>
                            <p className="text-[9.5px] font-black text-[#3e2723] italic uppercase tracking-tight">{selectedMemo.pengirim_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[7px] font-black text-stone-400 uppercase tracking-widest mb-0.5 italic">Tanggal Dokumen</p>
                           <p className="text-[9.5px] font-black text-[#3e2723] italic uppercase tracking-tight">{format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy', { locale: id })}</p>
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
