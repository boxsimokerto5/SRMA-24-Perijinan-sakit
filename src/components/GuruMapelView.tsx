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
  FileText
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
import { motion, AnimatePresence } from 'motion/react';

interface GuruMapelViewProps {
  user: AppUser;
  activeTab: string;
}

export default function GuruMapelView({ user, activeTab }: GuruMapelViewProps) {
  const [viewMode, setViewMode] = useState<'beranda' | 'catatan_perkembangan' | 'request_fasilitas' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'agenda' | 'dinding'>('beranda');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

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
                 <div className={`rounded-[2.5rem] p-8 mb-10 border shadow-2xl relative overflow-hidden group ${isDarkMode ? 'bg-stone-950 border-white/5' : 'bg-[#fcfaf6] border-stone-200'}`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#3e2723]/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-16 h-16 bg-[#3e2723] rounded-3xl flex items-center justify-center shadow-xl shadow-black/20 -rotate-3 group-hover:rotate-0 transition-transform">
                        <GraduationCap className="w-8 h-8 text-amber-200" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-[15px] leading-tight tracking-tight uppercase italic font-display">Guru Mapel</span>
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 opacity-40 italic`}>SRMA 24 KEDIRI</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-6 px-4 italic opacity-30`}>Academic Portal Nav</p>
                      <div className="space-y-2">
                        {[
                          { id: 'beranda', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'catatan_perkembangan', label: 'Catatan Siswa', icon: IdCard },
                          { id: 'agenda', label: 'Agenda Akademik', icon: Calendar },
                          { id: 'dinding', label: 'Dinding Kelas', icon: MessageSquare },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
                          { id: 'profil', label: 'Profil Guru', icon: User }
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
            <div className="flex flex-col text-left">
              <h1 className={`text-xl font-black uppercase tracking-tight font-display italic ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                {viewTitles[viewMode] || 'Academic Portal'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 bg-[#3e2723] rounded-full animate-pulse opacity-30" />
                <p className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-40 italic ${isDarkMode ? 'text-amber-200/50' : 'text-[#3e2723]'}`}>Teaching & Assessment Hub</p>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-4 bg-[#3e2723]/5 px-6 py-2 rounded-2xl border border-[#3e2723]/10">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3e2723]/60 italic">
              {formatRealTime(currentTime)}
            </p>
          </div>
        </div>
      </header>

      <main className={`p-6 ${viewMode === 'mading' || viewMode === 'dinding' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24 mt-10`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'dinding' && <WallView user={user} wallType="kelas" title="Dinding Kelas" />}
        {viewMode === 'catatan_perkembangan' && <ProgressRecordsView user={user} />}

        {viewMode === 'beranda' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="bg-[#3e2723] p-10 lg:p-14 rounded-[4rem] text-white shadow-3xl relative overflow-hidden group border-b-[12px] border-black">
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
               <div className="relative z-10">
                 <h2 className="text-4xl lg:text-5xl font-black font-display tracking-tight mb-4 italic leading-tight uppercase">Dashboard<br />Akademik Santri</h2>
                 <div className="flex items-center gap-4 bg-white/10 px-6 py-2.5 rounded-[1.5rem] backdrop-blur-xl border border-white/15 w-fit mb-10">
                    <ShieldCheck className="w-5 h-5 text-amber-200" />
                    <p className="text-[11px] font-black text-amber-100 uppercase tracking-[0.3em] italic">
                       {user.name} • {user.mapel || 'Guru Pengajar'}
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative hover:bg-white/10 transition-colors">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200/60 mb-3 italic">Teaching Record</p>
                     <p className="text-4xl font-black italic text-white leading-none">AKTIF</p>
                   </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setViewMode('catatan_perkembangan')}>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-3 italic">Entry Log</p>
                     <p className="text-4xl font-black italic text-white leading-none">KELOLA</p>
                   </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 text-center relative hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setViewMode('memorandum')}>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 opacity-60 mb-3 italic">Pesan Masuk</p>
                     <p className="text-5xl font-black italic text-indigo-300 leading-none">{memos.length}</p>
                   </div>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <button 
                onClick={() => setViewMode('catatan_perkembangan')}
                className="bg-white p-10 rounded-[3.5rem] border border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all text-left flex items-center justify-between group overflow-hidden border-b-8 border-stone-200"
              >
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-[#3e2723] text-amber-200 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/20 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <IdCard className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-[#3e2723] uppercase tracking-tight italic font-display leading-tight">Catat<br />Perkembangan</h3>
                    <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] mt-3 italic">Berikan feedback akademik</p>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-[1.5rem] bg-stone-50 flex items-center justify-center text-stone-200 group-hover:bg-[#3e2723] group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-xl">
                  <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                </div>
              </button>

              <button 
                onClick={() => setViewMode('dinding')}
                className="bg-white p-10 rounded-[3.5rem] border border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all text-left flex items-center justify-between group overflow-hidden border-b-8 border-stone-200"
              >
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-[#3e2723] text-indigo-300 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <MessageSquare className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-[#3e2723] uppercase tracking-tight italic font-display leading-tight">Dinding<br />Akademik Kelas</h3>
                    <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] mt-3 italic">Diskusi & Interaksi Kelas</p>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-[1.5rem] bg-stone-50 flex items-center justify-center text-stone-200 group-hover:bg-[#3e2723] group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-xl">
                  <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                </div>
              </button>
            </div>
          </div>
        )}

        {viewMode === 'request_fasilitas' && (
           <div className="space-y-6 animate-in fade-in duration-700">
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
                <p className="text-[10px] font-bold text-stone-400 max-w-xs uppercase leading-relaxed tracking-widest italic">
                  Fitur peminjaman Laptop/HP sedang dioptimalkan untuk integrasi inventaris. Silakan gunakan Log Catatan Siswa untuk pelaporan sementara.
                </p>
             </div>
           </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="space-y-6 animate-in fade-in duration-700">
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
                <div className="p-10 space-y-6 bg-white">
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
