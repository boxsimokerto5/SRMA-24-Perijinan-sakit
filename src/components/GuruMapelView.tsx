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
  Image as LucideImage
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, Announcement, ProgressRecord } from '../types';
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
import { motion, AnimatePresence } from 'motion/react';

interface GuruMapelViewProps {
  user: AppUser;
  activeTab: string;
}

export default function GuruMapelView({ user, activeTab }: GuruMapelViewProps) {
  const [viewMode, setViewMode] = useState<'beranda' | 'catatan_perkembangan' | 'request_fasilitas' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'dinding' | 'sarpras_asrama'>('beranda');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
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
    dinding: 'Dinding Kelas'
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

            {/* Analytical cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Total Peserta Didik */}
              <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-650 opacity-70" />
                <div>
                  <div className="flex items-center justify-between mb-2 pl-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                      <span className="text-[8px] font-black text-amber-700 tracking-wider uppercase italic">DATABASE PESERTA DIDIK</span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Aktif</span>
                  </div>
                  <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Siswa Terintegrasi</h4>
                  <div className="pl-2 mb-4">
                    <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                      <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">TOTAL SISWA</span>
                      <span className="text-2xl font-black text-[#3e2723] leading-tight mt-1">{students.length} Peserta Didik</span>
                      <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Database Pusat</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between pl-2">
                  <span className="text-xs font-bold text-stone-500">Aman dan Sinkron</span>
                  <button
                    onClick={() => setViewMode('catatan_perkembangan')}
                    className="px-3 py-1.5 bg-[#3e2723] hover:bg-black text-white text-[8px] font-black rounded-lg tracking-widest uppercase italic flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <IdCard className="w-3 h-3 text-amber-200" /> Kelola Catatan
                  </button>
                </div>
              </div>

              {/* Card 2: Memorandum Inbox */}
              <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-70" />
                <div>
                  <div className="flex items-center justify-between mb-2 pl-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[8px] font-black text-indigo-700 tracking-wider uppercase italic">KOTAK MASUK</span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Intern</span>
                  </div>
                  <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Memorandum Instansi</h4>
                  <div className="pl-2 mb-4">
                    <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                      <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">MEMORANDUM BARU</span>
                      <span className="text-2xl font-black text-indigo-600 leading-tight mt-1">{memos.length} Pesan</span>
                      <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Resmi Kepala Sekolah</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between pl-2">
                  <span className="text-xs font-bold text-stone-500">Baca memo penting</span>
                  <button
                    onClick={() => setViewMode('memorandum')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[8px] font-black rounded-lg tracking-widest uppercase italic flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Mail className="w-3 h-3 text-indigo-200" /> Buka Kotak
                  </button>
                </div>
              </div>

              {/* Card 3: Teaching Status */}
              <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-70" />
                <div>
                  <div className="flex items-center justify-between mb-2 pl-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-700 tracking-wider uppercase italic">STATUS PENGAJAR</span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Online</span>
                  </div>
                  <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Sinergi Asrama &amp; Kelas</h4>
                  <div className="pl-2 mb-4">
                    <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                      <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">MAPEL DIAJAR</span>
                      <span className="text-2xl font-black text-emerald-600 leading-tight mt-1 truncate max-w-full block">{user.mapel || 'Guru Pengajar'}</span>
                      <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Tahun Ajaran Aktif</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between pl-2">
                  <span className="text-xs font-bold text-stone-500">Sesi terverifikasi</span>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[8px] font-black rounded-lg border border-emerald-150 uppercase tracking-wider">
                    ● AKTIF
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Cards Grid Section */}
            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic text-left pl-2">Akses Cepat Modul Pembelajaran</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    id: 'catatan_perkembangan',
                    title: 'Laporan Catatan Siswa',
                    desc: 'Input umpan balik, feedback akademik, serta evaluasi karakter dan prestasi peserta didik.',
                    icon: IdCard,
                    borderColor: 'group-hover:border-amber-600',
                    dotColor: 'bg-amber-500',
                    badge: 'ENTRY UPDATE'
                  },
                  {
                    id: 'dinding',
                    title: 'Dinding Akademik Kelas',
                    desc: 'Forum interaksi, mading digital, pengumuman tugas, dan forum diskusi antar pengajar peserta didik.',
                    icon: MessageSquare,
                    borderColor: 'group-hover:border-indigo-600',
                    dotColor: 'bg-indigo-500',
                    badge: 'COMMUNITY WALL'
                  },
                  {
                    id: 'agenda',
                    title: 'Agenda & Kegiatan',
                    desc: 'Jadwal pembelajaran harian, pekanan, ujian, rapat kurikulum, dan kalender kegiatan.',
                    icon: Calendar,
                    borderColor: 'group-hover:border-emerald-600',
                    dotColor: 'bg-emerald-500',
                    badge: 'CALENDAR'
                  },
                  {
                    id: 'mading',
                    title: 'Mading Sekolah',
                    desc: 'Kumpulan artikel mading peserta didik, karya ilmiah remaja, cerpen peserta didik, dan berita harian sekolah.',
                    icon: BookOpen,
                    borderColor: 'group-hover:border-[#8b5e3c]',
                    dotColor: 'bg-[#8b5e3c]',
                    badge: 'CAMPUS CORNER'
                  },
                  {
                    id: 'memorandum',
                    title: 'Memorandum Penting',
                    desc: 'Arsip memo intern dan surat instruksi penting dari Kepala Sekolah serta jajaran pengurus.',
                    icon: Mail,
                    borderColor: 'group-hover:border-rose-400',
                    dotColor: 'bg-rose-500',
                    badge: 'INTERNAL MEMO'
                  },
                  {
                    id: 'profil',
                    title: 'Profil & Identitas Pengajar',
                    desc: 'Detail informasi kepegawaian, daftar mapel yang diampu, serta pengaturan keamanan akun.',
                    icon: User,
                    borderColor: 'group-hover:border-neutral-500',
                    dotColor: 'bg-neutral-500',
                    badge: 'MY IDENTITY'
                  }
                ].map((action) => (
                  <motion.div
                    key={action.id}
                    layoutId={`action-card-${action.id}`}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    onClick={() => setViewMode(action.id as any)}
                    className="bg-white rounded-2xl p-5 border border-[#ebdccb] hover:border-[#a1887f] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 text-left cursor-pointer group relative overflow-hidden"
                  >
                    {/* Decorative edge bar like WaliAsrama */}
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ebdccb] group-hover:bg-[#3e2723] transition-colors" />
                    
                    <div className="space-y-3 pl-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${action.dotColor} animate-pulse`} />
                          <span className="text-[7.5px] font-black text-stone-400 uppercase tracking-widest">{action.badge}</span>
                        </div>
                        <action.icon className="w-5 h-5 text-stone-300 group-hover:text-[#3e2723] transition-colors" />
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-black text-[#3e2723] uppercase tracking-tight italic font-display group-hover:text-[#3e2723]/90">
                          {action.title}
                        </h4>
                        <p className="text-[10px] text-stone-500 leading-relaxed font-semibold">
                          {action.desc}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-end text-[8.5px] font-black text-[#8d6e63] uppercase tracking-widest pl-3">
                      <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Buka Modul <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
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
