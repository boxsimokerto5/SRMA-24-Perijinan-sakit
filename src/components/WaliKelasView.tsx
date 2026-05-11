import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, Memorandum, normalizeKelas, AppNotification, Announcement, Siswa } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2, Plus, MapPin, ClipboardList, CheckCircle2, MessageSquare, Send, Mail, ShieldCheck, Clock, BarChart3, Search, ChevronRight, Activity, Menu, IdCard, Bell, Tablet, LayoutDashboard, GraduationCap, LogOut, Database, BookOpen, Laptop, Smartphone, Users } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import { motion, AnimatePresence } from 'motion/react';
import { getDocs } from 'firebase/firestore';
import { LaptopRequest, HPRequest } from '../types';
import ProgressRecordsView from './ProgressRecordsView';

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
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [viewMode, setViewMode] = useState<'home' | 'perizinan' | 'kartu_siswa' | 'memos' | 'pangkalan_data' | 'profil' | 'mading' | 'pinjam_laptop' | 'pinjam_hp' | 'catatan_perkembangan' | 'agenda'>('home');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [hpRequests, setHpRequests] = useState<HPRequest[]>([]);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);
  const [hpPdfLoading, setHpPdfLoading] = useState<string | null>(null);

  const stats = {
    total: permits.length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    pending: permits.filter(p => p.status === 'pending_kelas').length,
    catatan: permits.filter(p => p.tipe === 'catatan').length,
    memos: memos.length
  };

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

  useEffect(() => {
    if (activeTab === 'profil') setViewMode('profil');
    else if (activeTab === 'dashboard') setViewMode('home');
    else if (activeTab === 'riwayat') setViewMode('perizinan');
  }, [activeTab]);

  const banners = announcements.length > 0 ? announcements.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content,
    color: "from-indigo-600 to-violet-600",
    icon: Bell,
    author: a.authorName
  })) : [
    {
      id: 'def-1',
      title: "Informasi Kesehatan",
      content: "Jaga kebersihan diri dan lingkungan asrama untuk mencegah penyebaran penyakit.",
      color: "from-indigo-600 to-violet-600",
      icon: CheckCircle2
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientRoles', 'array-contains', 'wali_kelas'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    }, (err) => {
      console.error('Notifications Error:', err);
    });
    return () => unsubscribe();
  }, []);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [autoOpenAddCatatan, setAutoOpenAddCatatan] = useState(false);

  const filteredPermits = permits.filter(p => {
    const permitDate = p.tgl_surat?.toDate();
    if (!permitDate) return false;

    // Time Filter Logic
    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(permitDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(permitDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(permitDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(permitDate);

    const matchesSearch = 
      p.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomor_surat.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesDate && matchesTime;
  });

  // Find current teacher's class
  const myClass = WALI_KELAS_LIST.find(wk => wk.name === user.name)?.kelas || 'Semua';

  const filteredStudents = students.filter(s => {
    const name = s.nama_lengkap || '';
    const nik = s.nik || '';
    const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                         nik.includes(studentSearchTerm);
    const matchesClass = myClass === 'Semua' || s.kelas === myClass;
    return matchesSearch && matchesClass;
  });

  React.useEffect(() => {
    const q = query(collection(db, 'siswa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as Siswa;
        return { 
            id: doc.id, 
            ...rawData,
            kelas: normalizeKelas(rawData.kelas)
          } as Siswa;
        })
        .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
        
      setStudents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'siswa');
    });
    return () => unsubscribe();
  }, []);

  const handleNamaSiswaChange = (value: string) => {
    // Shared handled by ProgressRecordsView
  };

  const selectStudent = (student: Siswa) => {
    // Shared handled by ProgressRecordsView
  };

  // Close suggestions on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Logic handled by child components or not needed
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('status', 'in', ['pending_kelas', 'approved', 'pending_ack', 'acknowledged']),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as IzinSakit;
        return { 
          id: doc.id, 
          ...rawData,
          kelas: normalizeKelas(rawData.kelas)
        } as IzinSakit;
      });
      // Filter by wali kelas name if user has one (or just show all for demo)
      setPermits(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'izin_sakit');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'wali_kelas'),
      orderBy('tgl_memo', 'desc')
    );
    const unsubscribeMemos = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'memorandums');
    });

    // Fetch Laptop Requests
    const qLaptop = query(
      collection(db, 'laptop_requests'),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribeLaptop = onSnapshot(qLaptop, (snapshot) => {
      setLaptopRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest)));
    });

    // Fetch HP Requests
    const qHP = query(
      collection(db, 'hp_requests'),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribeHP = onSnapshot(qHP, (snapshot) => {
      setHpRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HPRequest)));
    });

    return () => {
      unsubscribeMemos();
      unsubscribeLaptop();
      unsubscribeHP();
    };
  }, []);

  const handleLaptopPDF = async (request: LaptopRequest) => {
    setLaptopPdfLoading(request.id!);
    try {
      await generateLaptopRequestPDF(request);
    } catch (error) {
      console.error("PDF Error:", error);
    } finally {
      setLaptopPdfLoading(null);
    }
  };

  const handleHPPDF = async (request: HPRequest) => {
    setHpPdfLoading(request.id!);
    try {
      await generateHPRequestPDF(request);
    } catch (error) {
      console.error("PDF Error:", error);
    } finally {
      setHpPdfLoading(null);
    }
  };

  const handleApprove = async (permitId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'approved',
        wali_kelas_uid: user.uid,
      });

      // Notify relevant roles
      notifyAllRoles(['dokter', 'wali_asuh', 'kepala_sekolah'], 'Izin Disetujui', `Izin sakit siswa telah disetujui oleh Wali Kelas ${user.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setLoading(false);
    }
  };

  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const handleGeneratePDF = async (permit: IzinSakit) => {
    setPdfLoading(permit.id!);
    try {
      await generatePermitPDF(permit);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setPdfLoading(null);
    }
  };

  const handleSubmitCatatan = async (e: React.FormEvent) => {
    // Shared handled by ProgressRecordsView
  };

  const viewTitles: Record<string, string> = {
    home: 'Dashboard',
    perizinan: 'Perizinan',
    kartu_siswa: 'Kartu Siswa',
    memos: 'Memorandum',
    pangkalan_data: 'Pangkalan Data Wali Asuh',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    pinjam_laptop: 'Peminjaman Laptop',
    pinjam_hp: 'Peminjaman HP',
    catatan_perkembangan: 'Catatan Perkembangan',
    settings: 'Pengaturan'
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

  const features = [
    'Input Perizinan Siswa (Sakit/Umum)',
    'Input Surat Memorandum Siswa',
    'Review Riwayat Perizinan Siswa',
    'Print Surat Izin & Memorandum Terpadu',
    'Cetak Kartu Siswa Real-time',
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
                          { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'agenda', label: 'Agenda Kegiatan', icon: Calendar },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'catatan_perkembangan', label: 'Catatan Perkembangan', icon: ClipboardList },
                          { id: 'kartu_siswa', label: 'Kartu Siswa', icon: IdCard },
                          { id: 'perizinan', label: 'Riwayat Izin', icon: ClipboardList },
                          { id: 'pinjam_laptop', label: 'Pinjam Laptop', icon: Laptop },
                          { id: 'pinjam_hp', label: 'Pinjam HP', icon: Smartphone },
                          { id: 'pangkalan_data', label: 'Pangkalan Data', icon: Database },
                          { id: 'memos', label: 'Memorandum', icon: Mail },
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

              {/* Bottom Logout Section */}
              <div className="p-6 border-t border-white/10">
                <p className="text-[10px] font-black text-cyan-100/40 uppercase tracking-[0.2em] mb-4 px-2">AKUN & SISTEM</p>
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-4 px-6 py-4 bg-[#085a6a] text-white rounded-2xl font-black text-sm hover:bg-[#0a6d7d] transition-all shadow-lg border border-white/5 active:scale-95"
                >
                  <LogOut className="w-5 h-5 text-cyan-300" />
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'} backdrop-blur-xl border-b ${isDarkMode ? 'border-slate-800' : 'border-indigo-100/60'} shadow-[0_4px_20px_rgb(0,0,0,0.03)]`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl transition-all active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#075e6e]">
              {viewTitles[viewMode] || 'SRMA 24'}
            </h1>
          </div>
        </div>
      </header>

      <div className={`p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24 space-y-8`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'catatan_perkembangan' && <ProgressRecordsView user={user} autoOpenAdd={autoOpenAddCatatan} onCloseAdd={() => setAutoOpenAddCatatan(false)} />}

        {viewMode === 'pinjam_laptop' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 font-display italic tracking-tight">Permohonan Laptop</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Monitoring Peminjaman Inventaris</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {laptopRequests.map(req => (
                <motion.div
                  key={req.id}
                  layout
                  whileHover={{ y: -4 }}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 font-display italic">Pinjam Laptop - {req.kelas}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.nomor_surat}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      req.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {req.status}
                    </div>
                  </div>

                  <div className="py-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daftar Siswa</p>
                    <p className="text-sm font-bold text-slate-600 leading-relaxed truncate">
                      {req.daftar_siswa.join(', ')}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                    </div>
                    <button
                      onClick={() => handleLaptopPDF(req)}
                      disabled={laptopPdfLoading === req.id}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                    >
                      {laptopPdfLoading === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5 text-cyan-300" />
                      )}
                      Cetak PDF
                    </button>
                  </div>
                </motion.div>
              ))}
              {laptopRequests.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Laptop className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada permohonan</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'pinjam_hp' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 font-display italic tracking-tight">Permohonan HP</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Monitoring Peminjaman HP</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hpRequests.map(req => (
                <motion.div
                  key={req.id}
                  layout
                  whileHover={{ y: -4 }}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 font-display italic">Pinjam HP - {req.kelas}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.nomor_surat}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      req.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {req.status}
                    </div>
                  </div>

                  <div className="py-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daftar Siswa</p>
                    <p className="text-sm font-bold text-slate-600 leading-relaxed truncate">
                      {req.daftar_siswa.join(', ')}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                    </div>
                    <button
                      onClick={() => handleHPPDF(req)}
                      disabled={hpPdfLoading === req.id}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                    >
                      {hpPdfLoading === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5 text-cyan-300" />
                      )}
                      Cetak PDF
                    </button>
                  </div>
                </motion.div>
              ))}
              {hpRequests.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada permohonan</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {viewMode === 'memos' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 px-1">
              <Mail className="w-6 h-6 text-indigo-600" />
              <div>
                <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight uppercase">Memorandum Intern</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Komunikasi Resmi Kepala Sekolah</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {memos.map(memo => (
                <motion.div 
                  key={memo.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedMemo(memo)}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col gap-4 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full -mr-12 -mt-12 group-hover:bg-orange-500 transition-colors duration-500" />
                  
                  <div className="flex items-center gap-4 relative">
                    <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 font-display group-hover:text-orange-700 transition-colors">{memo.perihal}</h4>
                      <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{format(memo.tgl_memo.toDate(), 'dd MMMM yyyy')}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                    <p className="text-xs font-bold text-slate-500">Dari: {memo.pengirim_name}</p>
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-white group-hover:bg-orange-500 transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada memorandum</p>
              </div>
            )}
          </div>
        )}
        
        {viewMode === 'kartu_siswa' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-6">
              <div className="px-1">
                <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Data Siswa</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Daftar Lengkap Siswa Kelas {myClass}</p>
              </div>

              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIK siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                    onClick={() => setSelectedStudent(student)}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col gap-4 group cursor-pointer hover:border-indigo-300 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-600 transition-colors duration-500" />
                    
                    <div className="flex items-center gap-4 relative">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner group-hover:scale-110 transition-all duration-500">
                        {student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black text-slate-900 truncate font-display group-hover:text-indigo-600 transition-colors">{student.nama_lengkap || 'Tanpa Nama'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NIK: {student.nik}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between relative">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Orang Tua</p>
                        <p className="text-xs font-bold text-slate-600">{student.ayah || '-'}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-all shadow-sm">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {filteredStudents.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Siswa tidak ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {(viewMode === 'home' || viewMode === 'perizinan') && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Announcement Banner */}
            {announcements.length > 0 && showBanner && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="relative overflow-hidden bg-indigo-50 border border-indigo-100 rounded-[2rem] p-4 group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                    <Bell className="w-6 h-6 animate-swing" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-1 italic flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3" /> Pengumuman Resmi
                    </p>
                    <div className="overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={bannerIndex}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="flex flex-col"
                        >
                          <p className="text-sm font-black text-slate-800 leading-tight">
                            {banners[bannerIndex % banners.length]?.title}
                          </p>
                          <p className="text-xs font-medium text-slate-600 line-clamp-1">
                            {banners[bannerIndex % banners.length]?.content}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="p-2 hover:bg-white rounded-xl transition-all text-indigo-300 hover:text-indigo-600 hover:shadow-sm"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
              </motion.div>
            )}

            {viewMode === 'home' && (
              <div className="bg-[#075e6e] p-8 rounded-[3rem] text-white shadow-2xl mb-8 relative overflow-hidden group border-b-8 border-[#054a57]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-400/10 rounded-full -ml-16 -mb-16 blur-2xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                  <div className="shrink-0 p-1 bg-white/10 rounded-[2.5rem] backdrop-blur-sm border border-white/20">
                    <Logo size="lg" showText={false} className="shadow-2xl" />
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                      <div className="h-0.5 w-6 bg-cyan-400 rounded-full" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300 italic">Selamat Datang</p>
                    </div>
                    <h1 className="text-4xl font-black font-display tracking-tight mb-3 italic leading-tight">
                      {user.name.split(' ')[0]}, <br />
                      <span className="text-cyan-300">Pantau Kesehatan Siswa.</span>
                    </h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                      <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/20">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">{getRoleLabel(user.role || 'wali_kelas')}</span>
                      </div>
                      <div className="bg-cyan-900/50 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-cyan-400/20">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-black text-white font-mono">{formatRealTime(currentTime).split(',')[1]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Perizinan */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl text-white group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.total}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Total<br />Perizinan</p>
                </div>
              </motion.div>

              {/* Card 2: Izin Selesai */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-[2.5rem] shadow-xl text-white group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.selesai}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Izin<br />Selesai</p>
                </div>
              </motion.div>

              {/* Card 3: Perlu Persetujuan */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-700 p-6 rounded-[2.5rem] shadow-xl text-white group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.pending}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Perlu<br />Persetujuan</p>
                </div>
              </motion.div>

              {/* Card 4: Memorandum */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-[2.5rem] shadow-xl text-white group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.memos}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Mail className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Memo<br />Kepala Sekolah</p>
                </div>
              </motion.div>
            </div>

            {/* Memorandum Section */}
            {memos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Memorandum Intern</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {memos.map(memo => (
                    <motion.div 
                      key={memo.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedMemo(memo)}
                      className="bg-cyan-50/50 p-5 rounded-[2rem] border border-cyan-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-100 text-cyan-600 rounded-2xl group-hover:scale-110 transition-transform">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 font-display group-hover:text-cyan-700 transition-colors">{memo.perihal}</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-cyan-400 group-hover:text-cyan-600 transition-all">
                        <Plus className="w-4 h-4" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Riwayat Terakhir Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Riwayat Perizinan</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Monitoring Kesehatan Siswa</p>
              </div>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStartDate('');
                  setEndDate('');
                  setTimeFilter('hari_ini');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Reset Filter
              </button>
            </div>

            {/* Filters & Search */}
            <div className="space-y-6">
              {/* Horizontal Time Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {[ 
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: 'kemarin', label: 'Kemarin' },
                  { id: 'minggu_ini', label: 'Minggu Ini' },
                  { id: 'bulan_ini', label: 'Bulan Ini' },
                  { id: 'semua', label: 'Semua' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setTimeFilter(cat.id as any)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      timeFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input
                      type="text"
                      placeholder="Cari nama siswa atau nomor surat..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* List Perizinan - Modern Cards */}
            <div className="grid grid-cols-1 gap-4">
              {filteredPermits.map((permit) => (
                <motion.div 
                  key={permit.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedPermit(permit)}
                  className={`group flex items-center gap-5 p-5 bg-white rounded-[2.5rem] shadow-sm border-l-8 hover:border-indigo-200 transition-all cursor-pointer ${
                    permit.tipe === 'sakit' ? 'border-emerald-500' :
                    permit.tipe === 'umum' ? 'border-blue-500' :
                    'border-amber-500'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500 ${
                    permit.tipe === 'sakit' ? 'bg-emerald-50 text-emerald-600' :
                    permit.tipe === 'umum' ? 'bg-blue-50 text-blue-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    <User className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-900 truncate font-display">{permit.nama_siswa}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        permit.tipe === 'sakit' ? 'bg-emerald-100 text-emerald-700' : 
                        permit.tipe === 'umum' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {permit.tipe === 'sakit' ? 'Input Dokter' : permit.tipe === 'umum' ? 'Izin Wali Asuh' : 'Input Wali Kelas'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas {permit.kelas}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-600">
                        {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM, HH:mm') : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                    {permit.status === 'pending_kelas' && (
                      <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                </motion.div>
              ))}

              {filteredPermits.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada data perizinan</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'pangkalan_data' && (
          <div className="h-[calc(100vh-220px)] w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/60 animate-in fade-in zoom-in-95 duration-500">
             <iframe 
               src="https://app.box.com/s/3ogn8xtw84he8uxb1yfnvum9mgwpc7db"
               className="w-full h-full border-none"
               title="Pangkalan Data Wali Asuh"
               allow="autoplay; fullscreen"
             />
          </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className={`p-8 flex items-center justify-between text-white relative overflow-hidden ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-gradient-to-r from-pink-500 to-rose-600' : 'bg-gradient-to-r from-indigo-600 to-blue-700'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-4xl font-black border border-white/30 shadow-2xl animate-in fade-in zoom-in duration-500">
                  {selectedStudent.nama_lengkap ? selectedStudent.nama_lengkap.charAt(0) : '?'}
                </div>
                <div>
                  <h3 className="text-3xl font-black font-display tracking-tight uppercase">{selectedStudent.nama_lengkap}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20">
                      Kelas {selectedStudent.kelas}
                    </span>
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20">
                      NIY: {selectedStudent.niy || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="p-3 hover:bg-white rounded-full transition-all text-white hover:text-slate-600 shadow-sm"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Data Pribadi */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 rounded-full ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-500' : 'bg-blue-500'}`} />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Data Personal</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">NIK</label>
                      <p className="text-sm font-mono font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all font-display">{selectedStudent.nik || '-'}</p>
                    </div>
                    
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tempat, Tanggal Lahir</label>
                      <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">{selectedStudent.ttl || `${selectedStudent.tempat_lahir}, ${selectedStudent.tanggal_lahir}` || '-'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Jenis Kelamin</label>
                        <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.jenis_kelamin || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Agama</label>
                        <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.agama || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Keluarga & Alamat */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 rounded-full ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-500' : 'bg-blue-500'}`} />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Keluarga & Alamat</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ayah</label>
                        <p className="text-sm font-black text-slate-700 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 group-hover:border-indigo-200 transition-all font-display">{selectedStudent.ayah || '-'}</p>
                      </div>
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ibu</label>
                        <p className="text-sm font-black text-slate-700 bg-rose-50/30 p-4 rounded-2xl border border-rose-100 group-hover:border-rose-200 transition-all font-display">{selectedStudent.ibu || '-'}</p>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alamat Lengkap</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">{selectedStudent.alamat || 'Alamat tidak tersedia'}</p>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/50">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Kec: {selectedStudent.kecamatan || '-'}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">NIY Wali: {selectedStudent.niy_waliklas || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-full py-5 bg-white border border-slate-200 text-slate-600 font-black rounded-3xl hover:bg-slate-100 hover:shadow-lg transition-all uppercase tracking-widest text-xs"
              >
                Tutup Profil Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redundant catatan form removed */}

      {/* Floating Action Button (FAB) */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setViewMode('catatan_perkembangan');
          setAutoOpenAddCatatan(true);
        }}
        className="fixed bottom-24 right-6 bg-indigo-950 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 z-30 transition-all"
      >
        <Plus className="w-6 h-6" />
        <span className="text-xs font-black uppercase tracking-widest">Buat Catatan Baru</span>
      </motion.button>
      
      {/* Modal Detail Perizinan */}
      {selectedPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Perizinan</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{selectedPermit.nomor_surat}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPermit(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Siswa</label>
                  <p className="font-black text-slate-900 font-display">{selectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900 font-display">{selectedPermit.kelas}</p>
                </div>
              </div>

              {selectedPermit.tipe === 'catatan' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Catatan</label>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedPermit.isi_catatan}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnosa Medis</label>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedPermit.diagnosa}</p>
                  </div>
                </div>
              )}

              {selectedPermit.tipe !== 'catatan' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Izin</label>
                    <p className="text-sm font-black text-slate-900">{selectedPermit.jumlah_hari} Hari</p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {selectedPermit.tgl_mulai && typeof selectedPermit.tgl_mulai.toDate === 'function' ? format(selectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {selectedPermit.tgl_selesai && typeof selectedPermit.tgl_selesai.toDate === 'function' ? format(selectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-50 text-emerald-600' :
                        selectedPermit.status === 'pending_kelas' ? 'bg-amber-50 text-amber-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        {(selectedPermit.status || '').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                    selectedPermit.tindakan.map((t, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.peran}: {t.oleh}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.waktu && typeof t.waktu.toDate === 'function' ? format(t.waktu.toDate(), 'HH:mm, dd MMM') : '-'}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{t.pesan}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Belum ada catatan tindakan</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              {selectedPermit.status === 'pending_kelas' && (
                <button
                  onClick={() => {
                    setConfirmApproveId(selectedPermit.id!);
                    setSelectedPermit(null);
                  }}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Setujui Izin
                </button>
              )}
              {selectedPermit && (
                <button
                  onClick={() => {
                    handleGeneratePDF(selectedPermit);
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  {pdfLoading === selectedPermit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4" /> Cetak PDF</>}
                </button>
              )}
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Persetujuan */}
      {confirmApproveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 font-display">Konfirmasi Setujui</h3>
              <p className="text-slate-500 text-sm font-medium">
                Apakah Anda yakin ingin menyetujui perizinan sakit siswa ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setConfirmApproveId(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleApprove(confirmApproveId);
                  setConfirmApproveId(null);
                }}
                disabled={loading}
                className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Setujui'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Memo */}
      {selectedMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Memorandum Intern</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{selectedMemo.nomor_memo}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMemo(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari</label>
                  <p className="font-black text-slate-900 flex items-center gap-1.5 font-display">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> {selectedMemo.pengirim_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                  <p className="font-black text-slate-900 font-display">
                    {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal</label>
                <p className="text-xl font-black text-slate-900 leading-tight font-display">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedMemo.isi}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedMemo(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generateMemorandumPDF(selectedMemo);
                  setSelectedMemo(null);
                }}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          >
            {/* Left Header Panel */}
            <div className="bg-[#075e6e] p-8 text-white flex flex-col items-center justify-center gap-6 md:w-1/3">
              <div className="w-32 h-32 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-4xl font-black border border-white/20 shadow-inner backdrop-blur-lg">
                {selectedStudent.nama_lengkap ? selectedStudent.nama_lengkap.charAt(0) : '?'}
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black font-display italic leading-tight mb-2">{selectedStudent.nama_lengkap}</h3>
                <div className="px-4 py-2 bg-cyan-400 text-[#075e6e] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] inline-block shadow-lg">
                  KELAS {selectedStudent.kelas}
                </div>
              </div>
              <div className="w-full h-px bg-white/10" />
              <div className="text-center space-y-1">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">NISN / NIK</p>
                <p className="text-xs font-mono font-black">{selectedStudent.nisn || '-'} / {selectedStudent.nik}</p>
              </div>
            </div>

            {/* Right Scrollable Content Panel */}
            <div className="flex-1 min-h-0 flex flex-col bg-slate-50 relative">
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-all text-[#075e6e] shadow-sm z-10"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1 min-h-0">
                {/* Personal Data Section */}
                <div>
                  <h4 className="text-[10px] font-black text-[#075e6e] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic text-left">
                    <User className="w-3 h-3" /> Data Pribadi Siswa
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                    <div className="space-y-1 group">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-[#075e6e] transition-colors">Tempat, Tgl Lahir</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.tempat_lahir}, {selectedStudent.tanggal_lahir}</p>
                    </div>
                    <div className="space-y-1 group">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-[#075e6e] transition-colors">Jenis Kelamin / Agama</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.jenis_kelamin} / {selectedStudent.agama}</p>
                    </div>
                    <div className="space-y-1 group">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-[#075e6e] transition-colors">Anak Ke / Saudara</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.anak_ke} dari {selectedStudent.saudara} Bersaudara</p>
                    </div>
                    <div className="space-y-1 group">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-[#075e6e] transition-colors">Asrama</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.asrama || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Family Section */}
                <div className="pt-6 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-[#075e6e] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic text-left">
                    <Users className="w-3 h-3" /> Data Orang Tua
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                    <div className="space-y-1 group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ayah Kandung</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.ayah || '-'}</p>
                    </div>
                    <div className="space-y-1 group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ibu Kandung</p>
                      <p className="text-sm font-black text-slate-900 italic font-display">{selectedStudent.ibu || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="pt-6 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-[#075e6e] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic text-left">
                    <MapPin className="w-3 h-3" /> Alamat Domisili
                  </h4>
                  <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-cyan-50 rounded-2xl text-[#075e6e] h-fit">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic">{selectedStudent.alamat || 'Alamat tidak tersedia'}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                          <div className="bg-slate-50 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-wider border border-slate-100 italic">Distrik: {selectedStudent.kecamatan || '-'}</div>
                          <div className="bg-slate-50 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-wider border border-slate-100 italic">Desa: {selectedStudent.kelurahan || '-'}</div>
                          <div className="bg-slate-50 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-wider border border-slate-100 italic">RT/RW: {selectedStudent.rt || '00'}/{selectedStudent.rw || '00'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button Panel */}
              <div className="p-6 bg-white border-t border-slate-100 text-right">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="px-8 py-3 bg-[#075e6e] text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-[#085a6a] transition-all shadow-xl shadow-black/10 active:scale-95"
                >
                  Selesai Meninjau
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
