import React, { useState, useEffect, useRef } from 'react';
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
  ChevronLeft, 
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
  Quote,
  Sparkles,
  Sun,
  Moon,
  Image as LucideImage
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp, or, deleteDoc } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, Announcement, ProgressRecord, Agenda, JadwalMengajar } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import WallView from './WallView';
import ProgressRecordsView from './ProgressRecordsView';
import SarprasAsramaView from './SarprasAsramaView';
import { JadwalMengajarView } from './JadwalMengajarView';
import { AbsenHarianView } from './AbsenHarianView';
import StudentCounselingView from './StudentCounselingView';
import { motion, AnimatePresence } from 'motion/react';

interface GuruMapelViewProps {
  user: AppUser;
  activeTab: string;
}

export default function GuruMapelView({ user, activeTab }: GuruMapelViewProps) {
  const [viewMode, setViewMode] = useState<'beranda' | 'catatan_perkembangan' | 'request_fasilitas' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'dinding' | 'sarpras_asrama' | 'jadwal_mengajar' | 'absen_harian' | 'student_counseling'>('beranda');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Calendar & Agenda States
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [schedules, setSchedules] = useState<JadwalMengajar[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [imageBanner, setImageBanner] = useState<{ imageUrl: string; title?: string; linkUrl?: string; isActive: boolean; updatedAt?: any } | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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

  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
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
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'guru_mapel'),
      orderBy('tgl_memo', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !user.uid) return;
    const q = query(
      collection(db, 'jadwal_mengajar'),
      where('guru_uid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JadwalMengajar));
      setSchedules(data);
    }, (error) => {
      console.error("Error loading teaching schedules:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !user.role || !user.uid) return;

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
      setAgendas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agenda)));
    }, (err) => {
      console.error("Error loading agendas for calendar in GuruMapelView:", err);
    });
    return () => unsubscribe();
  }, [user]);

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

  const banners = announcements.length > 0 
    ? announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        color: "from-[#5d4037] to-[#8b5e3c]",
        icon: Bell,
        author: ann.authorName || "Kepala Sekolah"
      }))
    : [
        {
          id: 'def-1',
          title: "Informasi Akademik",
          content: "Pastikan untuk mencatat perkembangan setiap peserta didik secara berkala guna melengkapi laporan bulanan asrama.",
          color: "from-slate-900 to-slate-950",
          icon: Info,
          author: "Kurikulum"
        },
        {
          id: 'def-2',
          title: "Sistem Terpadu",
          content: "Platform ini terintegrasi langsung dengan database Wali Asrama dan Wali Kelas demi pemantauan peserta didik yang sinergis.",
          color: "from-[#8b5e3c] to-[#c0b298]",
          icon: ShieldCheck,
          author: "Sistem"
        }
      ];

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const viewTitles: Record<string, string> = {
    beranda: 'Dashboard Guru Mapel',
    catatan_perkembangan: 'Catatan Siswa',
    request_fasilitas: 'Pinjam Laptop/HP',
    memorandum: 'Memorandum Intern',
    pangkalan_data: 'Data Siswa',
    profil: 'Profil Guru',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Akademik',
    dinding: 'Dinding Kelas',
    jadwal_mengajar: 'Jadwal Mengajar Guru',
    absen_harian: 'Absensi Harian Siswa'
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950 text-[#fdfcf0]' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans antialiased selection:bg-[#3e2723] selection:text-white`}>
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
              className="fixed inset-y-0 left-0 w-[280px] z-[70] shadow-2xl flex flex-col bg-slate-900 text-white border-r border-white/10"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  <div className="rounded-[2.5rem] p-5 mb-8 border border-white/5 relative overflow-hidden group bg-stone-950">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#3e2723]/10 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10 font-display text-left">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight uppercase italic text-amber-100">SRMA 24</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5 italic text-amber-200/60">Teacher Portal</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 text-left">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 italic text-stone-500">MENU GURU MAPEL</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'beranda', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'absen_harian', label: 'Absen Harian', icon: ClipboardList },
                          { id: 'catatan_perkembangan', label: 'Catatan Siswa', icon: IdCard },
                          { id: 'sarpras_asrama', label: 'Sarpras Asrama', icon: Wrench },
                          { id: 'jadwal_mengajar', label: 'Jadwal Mengajar', icon: Clock },
                          { id: 'agenda', label: 'Agenda Akademik', icon: Calendar },
                          { id: 'dinding', label: 'Dinding Kelas', icon: MessageSquare },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
                          { id: 'student_counseling', label: 'Layanan Konseling', icon: BookOpen },
                          { id: 'profil', label: 'Profil Saya', icon: User }
                        ].map((item: any) => (
                          <button
                            key={item.id}
                            onClick={() => {
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
              
              <div className="p-6 border-t border-white/5">
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl font-black text-xs transition-shadow active:scale-95 bg-rose-600 text-white shadow-lg shadow-rose-900/10 hover:bg-rose-700 italic uppercase tracking-wider font-display"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out Session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-stone-950/80 border-white/5' : 'bg-[#fcfaf6]/80 border-stone-200'} backdrop-blur-xl border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between relative">
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
                {viewTitles[viewMode] || 'Academic Portal'}
              </h1>
              <p className={`text-[8px] font-bold uppercase tracking-widest opacity-50 italic ${isDarkMode ? 'text-amber-100' : 'text-[#8b5e3c]'}`}>
                Teacher Portal
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

      {/* Announcements Banner Carousel */}
      <AnimatePresence mode="wait">
        {showBanner && banners.length > 0 && banners[bannerIndex] && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 pt-4">
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${banners[bannerIndex].color.includes('rose') ? 'from-[#5d4037] to-[#8b5e3c]' : 'from-[#8b5e3c] to-[#c0b298]'} p-4 text-white shadow-lg shadow-black/10`}>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
                      {React.createElement(banners[bannerIndex].icon, { className: "w-5 h-5 text-amber-200" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80 italic">{banners[bannerIndex].title}</h4>
                        <span className="px-1.5 py-0.5 bg-white/20 rounded text-[8px] font-black uppercase tracking-tighter border border-white/10">
                          {banners[bannerIndex].author || 'Sistem'}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-tight mt-0.5 line-clamp-2">{banners[bannerIndex].content}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Decorative circles */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Banner Section */}
      <div className="max-w-7xl mx-auto w-full px-4 pt-3">
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

      {/* Shrunken Real-time Clock Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 mt-2">
        <div className="p-[1px] rounded-lg bg-gradient-to-r from-[#d7ccc8]/30 via-[#8b5e3c]/30 to-[#d7ccc8]/30">
          <div className="flex items-center justify-center gap-1.5 py-1 px-4 rounded-[calc(0.5rem-1px)] bg-white/80 backdrop-blur-sm">
            <span className="w-1 h-1 bg-[#8b5e3c] rounded-full animate-ping" />
            <p className="text-[7px] font-black uppercase tracking-[0.2em] flex items-center gap-1 text-[#5d4037] italic">
              {formatRealTime(currentTime)}
            </p>
            <span className="w-1 h-1 bg-[#8b5e3c] rounded-full animate-ping" />
          </div>
        </div>
      </div>

      <main className={`p-4 ${viewMode === 'mading' || viewMode === 'dinding' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'dinding' && <WallView user={user} wallType="kelas" title="Dinding Kelas" />}
        {viewMode === 'catatan_perkembangan' && <ProgressRecordsView user={user} />}
        {viewMode === 'sarpras_asrama' && <SarprasAsramaView user={user} />}
        {viewMode === 'jadwal_mengajar' && <JadwalMengajarView user={user} schedules={schedules} />}
        {viewMode === 'absen_harian' && <AbsenHarianView user={user} students={students} />}
        {viewMode === 'student_counseling' && <StudentCounselingView user={user} students={students} />}

        {viewMode === 'beranda' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 text-left">
            {/* Shrunk Widescreen Header style */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
                    <GraduationCap className="w-6 h-6 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Dashboard Akademik</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                        TEACHER PORTAL
                      </span>
                    </div>
                    <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-85">
                      SELAMAT DATANG, {user.name} • MAPEL: {user.mapel || 'Sistem'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Educational wisdom quote system */}
            {(() => {
              const quotesMorning = [
                { text: "Tugas pertama dan utama pendidik bukanlah mentransfer materi, melainkan menghidupkan rasa ingin tahu dan keteladanan karakter dalam jiwa setiap murid.", author: "Ki Hajar Dewantara" },
                { text: "Setiap pagi membawa berkah pengajaran baru. Ikhlaskan niat mengajar demi membentuk peradaban generasi masa depan yang bertakwa.", author: "KH. Ahmad Dahlan" },
                { text: "Mengajar adalah menanam benih kebaikan di hati anak-anak. Rawatlah dengan kelembutan senyum Anda sejak fajar menyapa.", author: "Buya Hamka" },
                { text: "Murid tidak peduli seberapa banyak teori yang Anda ketahui, sampai mereka tahu seberapa besar Anda peduli pada pertumbuhan mereka.", author: "Sir William Osler" },
                { text: "Guru yang biasa-biasa saja sekadar memberi tahu. Guru yang baik menjelaskan. Guru yang ulung mendemonstrasikan. Pendidik sejati menginspirasi.", author: "William Arthur Ward" },
                { text: "Mulailah hari pengabdian ini dengan doa tulus. Di pundak Anda tersimpan amanah dari para orang tua murid untuk mengantar mereka ke gerbang kesalehan.", author: "KH. Hasyim Asy'ari" },
                { text: "Cara terbaik meramalkan masa depan adalah dengan mendidiknya secara bijaksana di ruang-ruang kelas hari ini.", author: "Abraham Lincoln" },
                { text: "Jangan pernah lelah mengajar. Ilmu yang Anda bagikan mengalir abadi sebagai rida surga yang tak bertepi.", author: "KH. Maimun Zubair" },
                { text: "Pendidik yang agung mengajar dari hati, bukan sekadar dari tumpukan buku panduan kurikulum.", author: "Anonim" },
                { text: "Mendidik pikiran tanpa mendidik hati adalah cara terbaik menghasilkan kepandaian yang hampa moral.", author: "Aristoteles" },
                { text: "Seulas senyuman ramah guru di pagi hari mampu menepis mendung kecemasan di benak anak didik yang sedang rindu bimbingan.", author: "Ki Hadjar Dewantara" },
                { text: "Pengetahuan adalah cahaya; jadilah penyulut api rasa ingin tahu yang abadi di setiap sanubari murid Anda.", author: "Al-Ghazali" },
                { text: "Guru adalah arsitek jiwa manusia. Bangunlah fondasi karakter yang tegap, kokoh, dan berakhlakul karimah.", author: "Joseph Stalin" },
                { text: "Setiap santri dan siswa adalah permata unik. Tugas kita sebagai pendidik adalah menggosoknya dengan penuh kesabaran agar bersinar terang.", author: "Gurusinga" },
                { text: "Kebesaran seorang guru bukan pada apa yang dia capai sendiri, melainkan pada ribuan mimpi besar murid yang berhasil dia hidupkan.", author: "Tokoh Pendidikan Indonesia" }
              ];

              const quotesAfternoon = [
                { text: "Ketika lelah mengajar menghampiri di senja hari, ingatlah setiap keringat dedikasi akan menjadi saksi jariah pendidik di akhirat kelak.", author: "KH. Hasan Abdullah Sahal" },
                { text: "Evaluasi terbaik petang ini bukanlah nilai ujian kelas, melainkan seberapa nyaman murid-murid belajar dengan rida dari kepiawaian asuhan Anda.", author: "Buya Hamka" },
                { text: "Menjadi guru berarti rida membagi waktu dan energi demi kejayaan generasi. Istirahatkan raga malam ini dengan rasa syukur mendalam.", author: "KH. Ahmad Dahlan" },
                { text: "Pendidik yang ikhlas selalu menyertakan nama murid-muridnya dalam bait doa tahajud di penghujung malam sunyi.", author: "KH. Maimun Zubair" },
                { text: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan Anda dapat mengubah dunia.", author: "Nelson Mandela" },
                { text: "Lelah fisik mengajar hari ini adalah tanda jaminan bahwa Anda telah mentransfer kebermanfaatan ilmu bagi tabungan abadi Anda.", author: "KH. Hasyim Asy'ari" },
                { text: "Setiap teguran asih di sore hari yang disampaikan penuh kesabaran, akan membekas indah kebaikan sepanjang hayat siswa.", author: "Ki Hajar Dewantara" },
                { text: "Mengajar bukan profesi pengisi waktu, melainkan jalan hidup penuh pengorbanan untuk mencerdaskan kehidupan rohani anak didik.", author: "Dr. Soetomo" },
                { text: "Biarlah letih mengajar petang ini melebur dosa masa lalu dan mendatangkan limpahan rida rona kedamaian di rumah Anda.", author: "Buya Yahya" },
                { text: "Ketika asrama sunyi beristirahat, ketahuilah bahwa kebaikan-kebaikan yang Anda ajarkan siang tadi sedang berakar kokoh menjadi kepribadian santri.", author: "K.H. Achmad Mustofa Bisri" },
                { text: "Nilai utama guru sejati tercermin dari sabar yang tiada terbatas di kala mendidik karakter yang paling menantang sekalipun.", author: "KH. Anwar Zahid" },
                { text: "Tidur malam yang tenang adalah upah dari pendidik yang seharian melunasi ikhtiar mendampingi anak-anak didik belajar penuh kasih.", author: "Ki Hadjar Dewantara" },
                { text: "Satu teladan nyata dari perilaku guru di sore hari jauh lebih bermakna daripada seribu petuah lisan di siang hari.", author: "KH. Sahal Mahfudh" },
                { text: "Mengajar santri di kala senja melatih kematangan jiwa pendidik untuk terus berkilau dalam keteduhan keikhlasan murni.", author: "Al-Ghazali" },
                { text: "Pendidik sejati selalu menutup hari dengan syukur dan doa agar ilmu yang diberikan hari ini tidak menjadi beban melainkan berkah hidup bagi anak asuh.", author: "Prof. Dr. HM. Quraish Shihab" }
              ];

              const currentHour = currentTime.getHours();
              const currentDay = currentTime.getDate();

              // Morning: 06:00:00 to 14:59:59
              // Afternoon/Night: 15:00:00 to 05:59:59
              const isMorningRange = currentHour >= 6 && currentHour < 15;
              const quotesList = isMorningRange ? quotesMorning : quotesAfternoon;
              const quoteIndex = (currentDay - 1) % quotesList.length;
              const selectedQuote = quotesList[quoteIndex];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="bg-gradient-to-br from-amber-50/60 via-white to-amber-100/10 p-6 sm:p-8 rounded-3xl border border-amber-200/50 shadow-sm text-left relative overflow-hidden group select-none mt-6"
                >
                  <div className="absolute -top-3 -right-3 text-[#3e2723]/5 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
                    <Quote className="w-28 h-28 rotate-180" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col justify-between h-full gap-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/30 text-amber-700">
                          {isMorningRange ? (
                            <Sun className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '45s' }} />
                          ) : (
                            <Moon className="w-4 h-4 text-indigo-500 animate-pulse" />
                          )}
                        </div>
                        <div>
                          <span className="text-[10.5px] font-black uppercase tracking-widest text-[#3e2723]">
                            {isMorningRange ? 'Kalam Hikmah Pendidik Pagi' : 'Renungan Pedagogi Sore Guru'}
                          </span>
                          <span className="text-[8px] block font-semibold text-stone-500 uppercase tracking-wider mt-0.5 leading-none">
                            Update Otomatis • Pukul 06.00 & 15.00 WIB
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[8.5px] font-black uppercase bg-amber-500/10 text-amber-800 px-3 py-1 rounded-full tracking-wider border border-amber-500/15 shadow-sm shrink-0">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                        <span>Inspirasi Mendidik</span>
                      </div>
                    </div>

                    <div className="pl-4 border-l-2 border-[#5d4037]/40">
                      <p className="text-sm sm:text-base font-medium italic text-stone-700 leading-relaxed font-serif tracking-wide">
                        "{selectedQuote.text}"
                      </p>
                      <span className="text-xs font-black uppercase tracking-widest text-[#3e2723] block mt-3 font-mono">
                        — {selectedQuote.author}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Slideable Premium Quick Access Menu */}
            {(() => {
              const quickMenus = [
                {
                  id: 'absen_harian',
                  title: 'Absen Harian Kelas',
                  desc: 'Catat absensi, buat rekap pelajaran santri, dan kelola histori ketidakhadiran harian kelas binaan.',
                  icon: ClipboardList,
                  dotColor: 'bg-rose-500',
                  badge: 'CLASS ATTENDANCE',
                  bgColor: 'from-rose-50 to-pink-50/40 dark:from-stone-900/60 dark:to-stone-900/40',
                  borderColor: 'border-rose-200/50 dark:border-rose-500/10',
                  textColor: 'text-rose-900 dark:text-rose-300'
                },
                {
                  id: 'jadwal_mengajar',
                  title: 'Jadwal Mengajar',
                  desc: 'Atur jam, hari, dan kelas mengajar Anda, serta susun jadwal harian yang informatik dan menarik.',
                  icon: Clock,
                  dotColor: 'bg-amber-600',
                  badge: 'TEACHING SCHEDULE',
                  bgColor: 'from-amber-50 to-orange-50 dark:from-stone-900/60 dark:to-stone-900/40',
                  borderColor: 'border-amber-200/50 dark:border-amber-500/10',
                  textColor: 'text-[#3e2723] dark:text-amber-300'
                },
                {
                  id: 'catatan_perkembangan',
                  title: 'Laporan Catatan Siswa',
                  desc: 'Input umpan balik, feedback akademik, serta evaluasi karakter dan prestasi peserta didik.',
                  icon: IdCard,
                  dotColor: 'bg-amber-500',
                  badge: 'ENTRY UPDATE',
                  bgColor: 'from-amber-50/50 to-amber-100/10 dark:from-amber-950/20 dark:to-stone-900/40',
                  borderColor: 'border-amber-200/50 dark:border-amber-500/10',
                  textColor: 'text-amber-800 dark:text-amber-300'
                },
                {
                  id: 'sarpras_asrama',
                  title: 'Sarpras Asrama',
                  desc: 'Laporkan kerusakan sarana prasarana asrama santri untuk penanganan inventaris terpadu.',
                  icon: Wrench,
                  dotColor: 'bg-emerald-500',
                  badge: 'SARPRAS REPORT',
                  bgColor: 'from-emerald-50/50 to-emerald-100/10 dark:from-emerald-950/20 dark:to-stone-900/40',
                  borderColor: 'border-emerald-200/50 dark:border-emerald-500/10',
                  textColor: 'text-emerald-800 dark:text-emerald-300'
                },
                {
                  id: 'agenda',
                  title: 'Agenda Akademik',
                  desc: 'Jadwal pembelajaran harian, pekanan, ujian, rapat kurikulum, dan kalender kegiatan.',
                  icon: Calendar,
                  dotColor: 'bg-sky-500',
                  badge: 'ACADEMIC CALENDAR',
                  bgColor: 'from-sky-50/50 to-sky-100/10 dark:from-sky-950/20 dark:to-stone-900/40',
                  borderColor: 'border-sky-200/50 dark:border-sky-500/10',
                  textColor: 'text-sky-800 dark:text-sky-300'
                },
                {
                  id: 'dinding',
                  title: 'Dinding Kelas',
                  desc: 'Forum interaksi, mading digital, pengumuman tugas, dan forum diskusi antar pengajar.',
                  icon: MessageSquare,
                  dotColor: 'bg-indigo-500',
                  badge: 'COMMUNITY DISCUSSION',
                  bgColor: 'from-indigo-50/50 to-indigo-100/10 dark:from-indigo-950/20 dark:to-stone-900/40',
                  borderColor: 'border-indigo-200/50 dark:border-indigo-500/10',
                  textColor: 'text-indigo-800 dark:text-indigo-300'
                },
                {
                  id: 'mading',
                  title: 'Mading Sekolah',
                  desc: 'Kumpulan artikel mading santri, karya ilmiah remaja, cerpen harian, dan berita sekolah.',
                  icon: BookOpen,
                  dotColor: 'bg-purple-500',
                  badge: 'CAMPUS CORNER',
                  bgColor: 'from-purple-50/50 to-purple-100/10 dark:from-purple-950/20 dark:to-stone-900/40',
                  borderColor: 'border-purple-200/50 dark:border-purple-500/10',
                  textColor: 'text-purple-800 dark:text-purple-300'
                },
                {
                  id: 'memorandum',
                  title: 'Memorandum',
                  desc: 'Arsip surat instruksi resmi, memo intern penting dari Kepala Sekolah dan pengurus.',
                  icon: Mail,
                  dotColor: 'bg-[#8d6e63]',
                  badge: 'OFFICIAL MEMO',
                  bgColor: 'from-rose-50/50 to-rose-100/10 dark:from-rose-950/10 dark:to-stone-900/40',
                  borderColor: 'border-rose-200/50 dark:border-rose-500/10',
                  textColor: 'text-rose-800 dark:text-rose-300'
                },
                {
                  id: 'profil',
                  title: 'Profil Saya',
                  desc: 'Detail data kepegawaian pribadi, mata pelajaran yang diampu, serta pengaturan keamanan.',
                  icon: User,
                  dotColor: 'bg-stone-500',
                  badge: 'MY PROFILE',
                  bgColor: 'from-stone-100/50 to-stone-200/10 dark:from-stone-800/40 dark:to-stone-900/40',
                  borderColor: 'border-stone-300/40 dark:border-stone-700/40',
                  textColor: 'text-stone-700 dark:text-stone-300'
                }
              ];

              const handleScrollLeft = () => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: -340, behavior: 'smooth' });
                }
              };

              const handleScrollRight = () => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: 340, behavior: 'smooth' });
                }
              };

              return (
                <div className="space-y-4 pt-4 text-left">
                   <div className="flex items-center justify-between px-2">
                     <div className="flex flex-col">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] italic text-[#8d6e63] dark:text-amber-200/70">
                         Akses Cepat Modul Pembelajaran
                       </p>
                       <span className="text-[8px] font-semibold text-stone-400 uppercase tracking-wider block mt-0.5 animate-pulse">
                         Geser kartu atau gunakan tombol kontrol untuk navigasi
                       </span>
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         onClick={handleScrollLeft}
                         className="w-8 h-8 rounded-full border border-[#ebdccb] bg-white hover:bg-[#ebdccb]/10 dark:bg-stone-900 dark:border-white/10 dark:hover:bg-stone-850 shadow-sm flex items-center justify-center text-[#3e2723] dark:text-white transition-all active:scale-95 duration-200"
                         title="Geser Kiri"
                       >
                         <ChevronLeft className="w-4 h-4" />
                       </button>
                       <button
                         onClick={handleScrollRight}
                         className="w-8 h-8 rounded-full border border-[#ebdccb] bg-white hover:bg-[#ebdccb]/10 dark:bg-stone-900 dark:border-white/10 dark:hover:bg-stone-850 shadow-sm flex items-center justify-center text-[#3e2723] dark:text-white transition-all active:scale-95 duration-200"
                         title="Geser Rujukan"
                       >
                         <ChevronRight className="w-4 h-4" />
                       </button>
                     </div>
                   </div>

                   <div 
                     ref={scrollContainerRef}
                     style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                     className="flex gap-5 overflow-x-auto pb-4 pt-1 px-2 scroll-smooth snap-x snap-mandatory no-scrollbar"
                   >
                     <style dangerouslySetInnerHTML={{__html: `
                       .no-scrollbar::-webkit-scrollbar {
                         display: none;
                       }
                     `}} />

                     {quickMenus.map((action) => (
                       <motion.div
                         key={action.id}
                         whileHover={{ y: -6, transition: { duration: 0.2 } }}
                         onClick={() => setViewMode(action.id as any)}
                         className={`min-w-[280px] sm:min-w-[320px] max-w-[320px] bg-gradient-to-br ${action.bgColor} rounded-3xl p-5 border ${action.borderColor} shadow-sm hover:shadow-md transition-all duration-350 flex flex-col justify-between space-y-4 cursor-pointer group relative overflow-hidden snap-start select-none`}
                       >
                         <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ebdccb] group-hover:bg-[#3e2723] dark:group-hover:bg-amber-400 transition-colors" />

                         <div className="space-y-3 pl-3">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className={`w-2 h-2 rounded-full ${action.dotColor} animate-pulse`} />
                               <span className="text-[7.5px] font-black text-stone-400 uppercase tracking-widest leading-none">{action.badge}</span>
                             </div>
                             <div className="p-1.5 rounded-xl bg-white/70 dark:bg-stone-950/60 shadow-sm text-stone-400 group-hover:text-[#3e2723] dark:group-hover:text-white transition-colors">
                               <action.icon className="w-4 h-4 animate-pulse" />
                             </div>
                           </div>

                           <div className="space-y-1">
                             <h4 className={`text-xs sm:text-sm font-black uppercase tracking-tight italic font-display ${action.textColor}`}>
                               {action.title}
                             </h4>
                             <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed font-semibold">
                               {action.desc}
                             </p>
                           </div>
                         </div>

                         <div className="pt-3 border-t border-stone-200/50 dark:border-stone-800/50 flex items-center justify-end text-[8.5px] font-black text-[#8d6e63] dark:text-amber-400/95 uppercase tracking-widest pl-3">
                           <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                             Buka Modul <ChevronRight className="w-3.5 h-3.5 animate-pulse" />
                           </span>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                </div>
              );
            })()}

            {/* Real-time Interactive Purple Calendar */}
            {(() => {
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();

              // Sunday = 0, Monday = 1, etc.
              const firstDayOfMonth = new Date(year, month, 1);
              const startDayIndex = firstDayOfMonth.getDay();
              const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
              const prevMonthDays = new Date(year, month, 0).getDate();

              const daysGrid: { day: number; isCurrentMonth: boolean; date: Date }[] = [];
              
              // Fill previous month overlapping days
              for (let i = startDayIndex - 1; i >= 0; i--) {
                const d = prevMonthDays - i;
                const prevMonthDate = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d);
                daysGrid.push({ day: d, isCurrentMonth: false, date: prevMonthDate });
              }

              // Fill current month days
              for (let d = 1; d <= totalDaysInMonth; d++) {
                const currDate = new Date(year, month, d);
                daysGrid.push({ day: d, isCurrentMonth: true, date: currDate });
              }

              // Fill next month overlapping days to make perfect multiples of 7
              const remainingCells = 42 - daysGrid.length;
              for (let d = 1; d <= remainingCells; d++) {
                const nextMonthDate = new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d);
                daysGrid.push({ day: d, isCurrentMonth: false, date: nextMonthDate });
              }

              const getAgendasForDate = (checkDate: Date) => {
                return agendas.filter(agenda => {
                  const agendaDate = agenda.date?.toDate ? agenda.date.toDate() : (agenda.date instanceof Date ? agenda.date : null);
                  if (!agendaDate) return false;
                  return (
                    agendaDate.getDate() === checkDate.getDate() &&
                    agendaDate.getMonth() === checkDate.getMonth() &&
                    agendaDate.getFullYear() === checkDate.getFullYear()
                  );
                });
              };

              const namaBulanIndo = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
              ];

              const selectedDateAgendas = getAgendasForDate(selectedCalendarDate);

              return (
                <div className="bg-white rounded-3xl border border-purple-100 dark:border-stone-850 shadow-sm overflow-hidden text-left mt-6 animate-in fade-in duration-500">
                  {/* Calendar Header with Ticking Clock */}
                  <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-850 text-white p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-300" />
                        <h3 className="font-black text-lg font-display italic tracking-tight text-white leading-none">
                          Kalender Agenda & Kegiatan Asrama
                        </h3>
                      </div>
                      <p className="text-[10px] font-bold text-purple-200 mt-1 uppercase tracking-widest">
                        SRMA 24 Kediri · Real-time Sync
                      </p>
                    </div>

                    {/* Clock display */}
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-2xl select-none min-w-[130px] justify-center text-white">
                      <Clock className="w-4 h-4 text-purple-300 animate-pulse shrink-0" />
                      <div className="flex flex-col text-center">
                        <span className="font-mono text-xs font-black tracking-widest leading-none">
                          {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[8px] font-bold text-purple-200 tracking-wider text-center mt-0.5 leading-none">
                          {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation and Month Header */}
                  <div className="p-4 sm:p-5 flex items-center justify-between border-b border-purple-50">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-purple-950 uppercase tracking-wider">
                        {namaBulanIndo[month]} {year}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                        className="p-1.5 sm:p-2 hover:bg-purple-50 text-purple-700 rounded-xl border border-purple-100 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
                          setSelectedCalendarDate(today);
                        }}
                        className="px-3 py-1.5 text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-100 hover:bg-purple-100/50 transition-all rounded-lg uppercase tracking-wider cursor-pointer"
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                        className="p-1.5 sm:p-2 hover:bg-purple-50 text-purple-700 rounded-xl border border-purple-100 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Container */}
                  <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-purple-50/10">
                    {/* Weekday Titles */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((dayName, idx) => (
                        <div
                          key={idx}
                          className={`text-[9px] font-black uppercase tracking-widest py-1 ${
                            idx === 0 ? 'text-rose-500' : 'text-purple-800/60'
                          }`}
                        >
                          {dayName}
                        </div>
                      ))}
                    </div>

                    {/* Day Cells Grid */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {daysGrid.map(({ day, isCurrentMonth, date: cellDate }, index) => {
                        const isCellToday = isToday(cellDate);
                        const isCellSelected =
                          selectedCalendarDate.getDate() === cellDate.getDate() &&
                          selectedCalendarDate.getMonth() === cellDate.getMonth() &&
                          selectedCalendarDate.getFullYear() === cellDate.getFullYear();
                        
                        const cellAgendas = getAgendasForDate(cellDate);
                        const hasAgendas = cellAgendas.length > 0;

                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setSelectedCalendarDate(cellDate)}
                            className={`aspect-square sm:p-1 relative flex flex-col items-center justify-between rounded-xl transition-all border outline-none group cursor-pointer ${
                              isCellSelected
                                ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 border-purple-750 text-white shadow-md shadow-purple-200/50'
                                : isCellToday
                                ? 'bg-purple-50 border-purple-150 text-purple-800 hover:bg-purple-100 shadow-[0_0_8px_rgba(168,85,247,0.15)] ring-2 ring-purple-500/25'
                                : isCurrentMonth
                                ? 'bg-white border-purple-50/50 text-stone-800 hover:bg-purple-50/40 hover:border-purple-100'
                                : 'bg-stone-50/20 border-transparent text-stone-300'
                            }`}
                          >
                            {/* Day Number */}
                            <span className={`text-[10px] sm:text-xs font-black ${isCellSelected ? 'text-white' : ''}`}>
                              {day}
                            </span>

                            {/* Small Indicators for Agendas */}
                            <div className="flex gap-0.5 justify-center mt-1 h-1.5 w-full">
                              {hasAgendas && (
                                <span className={`w-1 h-1 rounded-full ${isCellSelected ? 'bg-white' : 'bg-purple-500'} shadow-[0_0_5px_rgba(168,85,247,0.4)]`} />
                              )}
                              {isCellToday && !isCellSelected && (
                                <span className="w-1 h-1 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(168,85,247,0.4)]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Date Actions & Agendas */}
                  <div className="p-4 sm:p-5 bg-purple-50/20 border-t border-purple-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                          Agenda Sekolah & Kelas
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-purple-950 italic leading-tight">
                        {selectedCalendarDate.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewMode('agenda')}
                      className="px-4 py-2 bg-purple-50 hover:bg-purple-100/60 border border-purple-200 text-purple-700 font-black rounded-xl shadow-sm transition-all text-[9.5px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 cursor-pointer ml-auto md:ml-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Kelola Agenda
                    </button>
                  </div>

                  {/* Agendas List for Selected Date */}
                  <div className="px-4 pb-5 sm:px-5 sm:pb-6 pt-1 max-h-[160px] overflow-y-auto bg-stone-50/30 text-left">
                    {selectedDateAgendas.length === 0 ? (
                      <div className="py-4 text-center text-stone-400 text-[10px] font-semibold italic flex items-center justify-center gap-1 rounded-2xl bg-white border border-stone-100">
                        <Info className="w-3.5 h-3.5 text-stone-300" />
                        Tidak ada agenda khusus terjadwal pada hari ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDateAgendas.map((agenda, index) => (
                          <div 
                            key={agenda.id || index} 
                            className="bg-white p-3.5 rounded-2xl border border-purple-150 shadow-xs hover:border-purple-200 transition-all text-left relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                            <div className="pl-2">
                              <h5 className="font-black text-purple-950 text-xs uppercase italic tracking-tight">{agenda.title}</h5>
                              <p className="text-[10px] text-stone-600 mt-1 leading-relaxed">{agenda.description}</p>
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[8px] font-bold text-stone-400 uppercase tracking-widest">
                                <span>Oleh: {agenda.author_name}</span>
                                <span>•</span>
                                <span>Role: {agenda.author_role.replace('_', ' ')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {viewMode === 'request_fasilitas' && (
           <div className="space-y-6 animate-in fade-in duration-700 text-left">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black text-[#3e2723] font-display italic">Fasilitas Pinjam Pakai</h2>
                <div className="w-10 h-10 bg-[#3e2723] rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Wrench className="w-5 h-5 text-amber-200" />
                </div>
             </div>
             <div className="bg-white p-10 rounded-[3rem] border border-[#d7ccc8]/30 shadow-sm flex flex-col items-center justify-center text-center py-20">
                <div className="p-6 bg-[#f8f3ed] rounded-full mb-6">
                  <AlertTriangle className="w-12 h-12 text-[#8b5e3c]" />
                </div>
                <h3 className="font-black text-[#3e2723] uppercase tracking-tight mb-2 italic">Modul Dalam Sinkronisasi</h3>
                <p className="text-[10px] font-bold text-stone-400 max-w-xs uppercase leading-relaxed tracking-widest italic animate-pulse">
                  Fitur peminjaman Laptop/HP sedang dioptimalkan untuk integrasi inventaris. Silakan gunakan Log Catatan Siswa untuk pelaporan sementara.
                </p>
             </div>
           </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="space-y-6 animate-in fade-in duration-700 text-left">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black text-[#3e2723] font-display italic">Memorandum Intern</h2>
                <div className="w-10 h-10 bg-[#3e2723] rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Mail className="w-5 h-5 text-amber-200" />
                </div>
              </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {memos.map(memo => (
                 <div 
                   key={memo.id} 
                   onClick={() => setSelectedMemo(memo)}
                   className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/30 shadow-sm border-l-8 border-l-[#8b5e3c] flex items-center justify-between cursor-pointer group hover:shadow-md transition-all"
                 >
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-[#f8f3ed] text-[#3e2723] rounded-2xl group-hover:bg-[#3e2723] group-hover:text-white transition-all">
                       <Mail className="w-5 h-5" />
                     </div>
                     <div>
                       <h4 className="font-black text-[#3e2723] uppercase tracking-tight italic leading-tight">{memo.perihal}</h4>
                       <p className="text-[9px] font-black text-stone-400 mt-1 tracking-widest uppercase italic">
                         DARI: {memo.pengirim_name} • {format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}
                       </p>
                     </div>
                   </div>
                   <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-[#3e2723] transition-colors" />
                 </div>
               ))}
               {memos.length === 0 && (
                 <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-[#d7ccc8]">
                   <Mail className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                   <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] italic">Belum ada memorandum baru</p>
                 </div>
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
               className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-[#f8f3ed] bg-[#3e2723] flex items-center justify-between text-white italic">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-amber-200" />
                    <h3 className="font-black uppercase tracking-widest text-[10px] italic">Detail Memorandum Intern</h3>
                  </div>
                  <button onClick={() => setSelectedMemo(null)} className="p-2 text-amber-200 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-10 space-y-6 bg-white text-left">
                  {selectedMemo && (
                    <>
                      <div>
                        <h2 className="text-2xl font-black italic text-[#3e2723] leading-tight mb-4">{selectedMemo.perihal}</h2>
                        <div className="p-6 bg-[#f8f3ed] rounded-[2rem] border border-[#d7ccc8]/30 italic text-sm text-[#5d4037] leading-relaxed">
                          {selectedMemo.isi}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-6 border-t border-[#f8f3ed]">
                        <div className="w-10 h-10 bg-[#3e2723] text-white rounded-xl flex items-center justify-center font-black">
                          {selectedMemo.pengirim_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">Pengirim Resmi</p>
                          <p className="text-sm font-black text-[#3e2723] uppercase tracking-tight italic">{selectedMemo.pengirim_name}</p>
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
