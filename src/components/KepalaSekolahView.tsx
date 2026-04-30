import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc, doc, where, getDocs, writeBatch } from 'firebase/firestore';
import { IzinSakit, AppUser, Memorandum, UserRole, normalizeKelas, Announcement, PinjamHP, Siswa, LaptopRequest, HPRequest, AppNotification } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Home, 
  User, 
  MapPin, 
  Plus, 
  Printer,
  Loader2,
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  Activity,
  Send,
  Mail,
  ShieldCheck,
  Bell,
  ChevronRight,
  Laptop,
  Calendar,
  Tablet, Smartphone, Check, Menu, GraduationCap, IdCard, LayoutDashboard, LogOut, BookOpen
} from 'lucide-react';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

interface KepalaSekolahViewProps {
  user: AppUser;
  activeTab: string;
}

export default function KepalaSekolahView({ user, activeTab }: KepalaSekolahViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  
  // Announcement States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  const [viewMode, setViewMode] = useState<'perizinan' | 'memorandum' | 'pengumuman' | 'pinjam_laptop' | 'permohonan_hp' | 'kartu_siswa' | 'statistik' | 'profil' | 'mading'>('statistik');

  useEffect(() => {
    if (activeTab === 'profil') setViewMode('profil');
    else if (activeTab === 'statistik') setViewMode('statistik');
    else if (activeTab === 'perizinan') setViewMode('perizinan');
  }, [activeTab]);

  const [laptopTimeFilter, setLaptopTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');
  const [hpTimeFilter, setHpTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Banner & Time states
  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
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
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientRoles', 'array-contains', 'kepala_sekolah'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    }, (err) => {
      console.error('Notifications Error:', err);
    });
    return () => unsubscribe();
  }, []);

  const viewTitles: Record<string, string> = {
    statistik: 'Statistik & Dashboard',
    perizinan: 'Perizinan Siswa',
    memorandum: 'Memorandum',
    pengumuman: 'Pengumuman',
    pinjam_laptop: 'Peminjaman Laptop',
    permohonan_hp: 'Peminjaman HP',
    kartu_siswa: 'Kartu Siswa',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    settings: 'Pengaturan'
  };
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);
  const [hpRequests, setHpRequests] = useState<HPRequest[]>([]);
  const [hpRequestPdfLoading, setHpRequestPdfLoading] = useState<string | null>(null);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [newMemo, setNewMemo] = useState({
    perihal: '',
    isi: '',
    penerima: [] as UserRole[]
  });
  const [memoLoading, setMemoLoading] = useState(false);
  const [newTindakan, setNewTindakan] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportRange, setReportRange] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini'>('hari_ini');
  const [reportLoading, setReportLoading] = useState(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState<any>(null);

  // Student Cards States
  const [students, setStudents] = useState<Siswa[]>([]);
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).filter(Boolean).sort()];

  // History Data
  const combinedHistory = React.useMemo(() => {
    // Transform permits into history items
    const permitHistory = permits.map(p => ({
      id: p.id,
      title: p.nama_siswa,
      subtitle: p.kelas,
      type: p.tipe === 'sakit' ? 'Dokter' : (p.tipe === 'catatan' ? 'Wali Kelas' : 'Wali Asuh'),
      category: p.tipe,
      date: p.tgl_surat?.toDate(),
      details: p.diagnosa || p.alasan || p.isi_catatan,
      status: p.status,
      raw: p,
      origin: 'izin_sakit'
    }));

    return [...permitHistory].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [permits]);

  const filteredHistory = combinedHistory.filter(item => {
    const itemDate = item.date;
    if (!itemDate) return false;

    // Time Filter Logic
    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(itemDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(itemDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(itemDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(itemDate);

    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.details && item.details.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch && matchesTime;
  });

  useEffect(() => {
    setLoading(true);
    const qPermits = query(collection(db, 'izin_sakit'), orderBy('tgl_surat', 'desc'));
    const unsubscribePermits = onSnapshot(qPermits, (snapshot) => {
      setPermits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit)));
      setLoading(false);
    });

    const qMemos = query(collection(db, 'memorandums'), orderBy('tgl_memo', 'desc'));
    const unsubscribeMemos = onSnapshot(qMemos, (snapshot) => {
      setMemos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum)));
    });

    const qAnnouncements = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    const qSiswa = query(collection(db, 'siswa'), orderBy('nama_lengkap', 'asc'));
    const unsubscribeSiswa = onSnapshot(qSiswa, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() as Siswa,
        kelas: normalizeKelas((doc.data() as any).kelas)
      })));
    });

    const qLaptop = query(collection(db, 'laptop_requests'), orderBy('tgl_request', 'desc'));
    const unsubscribeLaptop = onSnapshot(qLaptop, (snapshot) => {
      setLaptopRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest)));
    });

    const qHP = query(collection(db, 'hp_requests'), orderBy('tgl_request', 'desc'));
    const unsubscribeHP = onSnapshot(qHP, (snapshot) => {
      setHpRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HPRequest)));
    });

    return () => {
      unsubscribePermits();
      unsubscribeMemos();
      unsubscribeAnnouncements();
      unsubscribeSiswa();
      unsubscribeLaptop();
      unsubscribeHP();
    };
  }, []);

  const handleAddTindakan = async (permitId: string) => {
    if (!newTindakan.trim()) return;
    setActionLoading(true);
    try {
      const { updateDoc, doc, arrayUnion } = await import('firebase/firestore');
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        tindakan: arrayUnion({
          waktu: Timestamp.now(),
          oleh: user.name,
          peran: 'Kepala Sekolah',
          pesan: newTindakan
        })
      });

      // Notify others
      notifyAllRoles(['dokter', 'wali_asuh', 'wali_kelas'], 'Update Riwayat Tindakan', `Kepala Sekolah ${user.name} menambahkan catatan tindakan baru.`);

      setNewTindakan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateFullReport = async () => {
    setReportLoading(true);
    try {
      const { generateSummaryReportPDF } = await import('../pdfUtils');
      
      const filteredForReport = permits.filter(p => {
        const permitDate = p.tgl_surat?.toDate();
        if (!permitDate) return false;
        
        if (reportRange === 'hari_ini') return isToday(permitDate);
        if (reportRange === 'kemarin') return isYesterday(permitDate);
        if (reportRange === 'minggu_ini') return isThisWeek(permitDate, { weekStartsOn: 1 });
        if (reportRange === 'bulan_ini') return isThisMonth(permitDate);
        return true;
      });

      const rangeLabel = {
        hari_ini: 'Hari Ini',
        kemarin: 'Kemarin',
        minggu_ini: 'Minggu Ini',
        bulan_ini: 'Bulan Ini'
      }[reportRange];

      await generateSummaryReportPDF(filteredForReport, rangeLabel!, user.name);
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat laporan');
    } finally {
      setReportLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    setAnnouncementLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        createdAt: Timestamp.now(),
        authorName: user.name,
        authorUid: user.uid,
        isActive: true
      });

      // Broadcast Notification
      notifyAllRoles(['dokter', 'wali_asuh', 'wali_kelas'], 'Pengumuman Baru', `Ada pengumuman baru dari Kepala Sekolah: ${newAnnouncement.title}`, 'view:home');

      setNewAnnouncement({ title: '', content: '' });
      setShowAnnouncementModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'announcements');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleDeleteMemorandum = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'memorandums', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `memorandums/${id}`);
    }
  };

  useEffect(() => {
    const autoCleanup = async () => {
      if (!auth.currentUser?.emailVerified) {
        console.log('Auto-cleanup skipped: Email not verified');
        return;
      }
      try {
        const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7));
        const conf = [
          { col: 'izin_sakit', field: 'tgl_surat' },
          { col: 'memorandums', field: 'tgl_memo' },
          { col: 'announcements', field: 'createdAt' },
        ];

        for (const item of conf) {
          try {
            const q = query(collection(db, item.col), where(item.field, '<', sevenDaysAgo));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
              const docs = snap.docs;
              const chunkSize = 250; // Use conservative batch size
              
              for (let i = 0; i < docs.length; i += chunkSize) {
                const chunk = docs.slice(i, i + chunkSize);
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
              
              console.log(`Auto-cleaned ${snap.size} old records from ${item.col} successfully.`);
            }
          } catch (colErr) {
            console.error(`Auto-cleanup failed for collection ${item.col}:`, colErr);
            // Don't throw, continue to next collection
          }
        }
      } catch (e) {
        console.error('Auto-cleanup failed:', e);
      }
    };
    autoCleanup();
  }, []);

  const handleSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemo.penerima.length === 0) {
      alert('Pilih minimal satu penerima');
      return;
    }
    
    setMemoLoading(true);
    try {
      const memoData: Omit<Memorandum, 'id'> = {
        nomor_memo: `MEMO-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
        perihal: newMemo.perihal,
        isi: newMemo.isi,
        tgl_memo: Timestamp.now(),
        penerima: newMemo.penerima,
        pengirim_name: user.name,
        pengirim_uid: user.uid
      };
      
      await addDoc(collection(db, 'memorandums'), memoData);

      // Notify targeted roles
      notifyAllRoles(newMemo.penerima, 'Memorandum Baru', `Kepala Sekolah mengirimkan memorandum: ${newMemo.perihal}`, 'view:memos');

      setShowMemoModal(false);
      setNewMemo({ perihal: '', isi: '', penerima: [] });
    } catch (error) {
      console.error('Error sending memo:', error);
    } finally {
      setMemoLoading(false);
    }
  };

  const togglePenerima = (role: UserRole) => {
    setNewMemo(prev => ({
      ...prev,
      penerima: prev.penerima.includes(role)
        ? prev.penerima.filter(r => r !== role)
        : [...prev.penerima, role]
    }));
  };

  const selectAllPenerima = () => {
    if (newMemo.penerima.length === 3) {
      setNewMemo(prev => ({ ...prev, penerima: [] }));
    } else {
      setNewMemo(prev => ({ ...prev, penerima: ['dokter', 'wali_asuh', 'wali_kelas'] }));
    }
  };

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
    setHpRequestPdfLoading(request.id!);
    try {
      await generateHPRequestPDF(request);
    } catch (error) {
      console.error("PDF Error:", error);
    } finally {
      setHpRequestPdfLoading(null);
    }
  };

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
    const matchesType = filterType === 'all' || p.tipe === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'selesai' ? (p.status === 'approved' || p.status === 'acknowledged') : p.status === filterStatus);
    
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesType && matchesStatus && matchesDate && matchesTime;
  });

  const stats = {
    total: permits.length,
    sakit: permits.filter(p => p.tipe === 'sakit').length,
    umum: permits.filter(p => p.tipe === 'umum').length,
    catatan: permits.filter(p => p.tipe === 'catatan').length,
    pending: permits.filter(p => p.status.startsWith('pending')).length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length
  };

  const sakitStats = React.useMemo(() => {
    const sakitPermits = permits.filter(p => p.tipe === 'sakit');
    return {
      hariIni: sakitPermits.filter(p => p.tgl_surat && isToday(p.tgl_surat.toDate())).length,
      kemarin: sakitPermits.filter(p => p.tgl_surat && isYesterday(p.tgl_surat.toDate())).length,
      mingguIni: sakitPermits.filter(p => p.tgl_surat && isThisWeek(p.tgl_surat.toDate(), { weekStartsOn: 1 })).length,
      bulanIni: sakitPermits.filter(p => p.tgl_surat && isThisMonth(p.tgl_surat.toDate())).length,
    };
  }, [permits]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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

  const renderStatistik = () => {
    const features = [
      'Statistik & Dashboard Perizinan Real-time',
      'Review & Print Surat Izin Siswa (Sakit/Umum)',
      'Review & Print Surat Memorandum',
      'Membuat Pengumuman Resmi Sekolah',
      'Review & Print Peminjaman Laptop & HP',
      'Cetak Kartu Siswa (E-KTM)',
      'Berbagi Catatan di Mading Sekolah'
    ];
    
    // Prepare data for charts
    const diagnosisData = Object.entries(
      permits
        .filter(p => p.tipe === 'sakit' && p.diagnosa)
        .reduce((acc, p) => {
          const d = p.diagnosa || 'Lainnya';
          acc[d] = (acc[d] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const monthlyTrend = Object.entries(
      permits.reduce((acc, p) => {
        const date = p.tgl_surat?.toDate();
        if (date) {
          const month = format(date, 'MMM yyyy');
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([name, value]) => ({ name, value }))
      .slice(-6);

    const COLORS = ['#8b5e3c', '#5d4037', '#c0b298', '#d7ccc8', '#a1887f'];

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Announcement Banner */}
        {announcements.length > 0 && showBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="relative overflow-hidden bg-amber-50 border border-amber-200 rounded-[2rem] p-4 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-0.5 italic">Pengumuman Terbaru</p>
                <div className="overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={bannerIndex}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="text-sm font-bold text-amber-900 leading-relaxed"
                    >
                      {announcements[bannerIndex % announcements.length]?.title}: {announcements[bannerIndex % announcements.length]?.content}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <button 
                onClick={() => setShowBanner(false)}
                className="p-2 hover:bg-amber-200/50 rounded-xl transition-colors text-amber-400 hover:text-amber-600"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </motion.div>
        )}

        <div className="bg-[#5d4037] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group border-b-4 border-[#3e2723]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black font-display tracking-tight mb-2 italic">Hallo, {user.name || user.email}</h1>
            <p className="text-lg font-bold text-amber-100/70 flex items-center gap-2 mb-6 uppercase tracking-widest text-xs">
              <ShieldCheck className="w-4 h-4" />
              {getRoleLabel(user.role || 'kepala_sekolah')}
            </p>
            
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-50/70 mb-4 flex items-center gap-2">
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
                    className="flex items-center gap-3 text-sm font-semibold text-white/90"
                  >
                    <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#5d4037] font-display">Statistik Perizinan</h2>
            <p className="text-sm font-bold text-[#8b5e3c]/60 uppercase tracking-widest mt-1">Analisis data kesehatan siswa secara real-time.</p>
          </div>
          <div className="p-3 bg-[#fdfcf0] text-[#5d4037] rounded-full shadow-lg border border-[#d7ccc8]">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Izin Sakit</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.sakit}</h3>
              </div>
            </div>
            <div className="w-full bg-[#f8f3ed] h-2 rounded-full overflow-hidden">
              <div className="bg-rose-400 h-full" style={{ width: `${(stats.sakit / stats.total) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-[#e0d6c0]/20 text-[#5d4037] rounded-2xl">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Izin Umum</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.umum}</h3>
              </div>
            </div>
            <div className="w-full bg-[#f8f3ed] h-2 rounded-full overflow-hidden">
              <div className="bg-[#5d4037]/40 h-full" style={{ width: `${(stats.umum / stats.total) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tingkat Kesembuhan</p>
                <h3 className="text-2xl font-black text-slate-900">{Math.round((stats.selesai / stats.total) * 100) || 0}%</h3>
              </div>
            </div>
            <div className="w-full bg-[#f8f3ed] h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full" style={{ width: `${(stats.selesai / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-[#d7ccc8]/40">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-[#5d4037] uppercase tracking-widest text-xs italic">Tren Bulanan</h3>
              <TrendingUp className="w-5 h-5 text-[#8b5e3c]" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8f3ed" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#8b5e3c' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#8b5e3c' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff' }}
                    labelStyle={{ fontWeight: 900, color: '#5d4037' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8b5e3c" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#8b5e3c', strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-[#d7ccc8]/40">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-[#5d4037] uppercase tracking-widest text-xs italic">Diagnosa Utama</h3>
              <Activity className="w-5 h-5 text-rose-400" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8f3ed" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#5d4037' }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff' }}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                    {diagnosisData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-[#5d4037] p-8 rounded-[3rem] text-white overflow-hidden relative shadow-2xl border-b-4 border-[#3e2723]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/5 rounded-[2rem] backdrop-blur-md border border-white/10 shadow-inner">
                <Users className="w-8 h-8 text-amber-200" />
              </div>
              <div>
                <h4 className="text-xl font-black font-display italic">Ringkasan Kehadiran</h4>
                <p className="text-amber-100/40 text-xs font-bold uppercase tracking-[0.2em]">Total {stats.total} perizinan tersinkronisasi</p>
              </div>
            </div>
            <button 
              onClick={() => setShowReportModal(true)}
              className="px-10 py-5 bg-[#fdfcf0] text-[#3e2723] font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20 uppercase tracking-widest text-xs border-b-2 border-amber-200/50"
            >
              Unduh Laporan PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#2d1e1a]' : 'bg-[#f8f3ed]'}`}>
      {/* Sidebar Navigation */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#5d4037] text-white z-[70] shadow-2xl flex flex-col border-r-4 border-[#3e2723]"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  <div className="bg-[#3e2723]/40 rounded-3xl p-5 mb-8 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight uppercase">SRMA 24</span>
                        <span className="text-[9px] font-bold text-amber-200/50 uppercase tracking-widest mt-0.5">SEKOLAH RAKYAT</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <p className="text-[10px] font-black text-amber-100/30 uppercase tracking-[0.2em] mb-4 px-2">UTAMA</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'statistik', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'perizinan', label: 'Perizinan Siswa', icon: ClipboardList },
                          { id: 'kartu_siswa', label: 'Kartu Siswa', icon: IdCard },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
                          { id: 'pengumuman', label: 'Pengumuman', icon: Bell },
                          { id: 'pinjam_laptop', label: 'Pinjam Laptop', icon: Laptop },
                          { id: 'permohonan_hp', label: 'Permohonan HP', icon: Smartphone },
                          { id: 'profil', label: 'Profil Saya', icon: User }
                        ].map((item: any) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setViewMode(item.id);
                              setShowSidebar(false);
                            }}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black transition-all duration-300 ${
                              viewMode === item.id 
                                ? 'bg-[#fdfcf0] text-[#5d4037] shadow-xl shadow-black/20 translate-x-1' 
                                : 'bg-transparent text-amber-100/60 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-[#5d4037]' : 'text-amber-100/30'}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Logout Section */}
              <div className="p-6 bg-[#3e2723]/30 border-t border-white/5">
                <p className="text-[10px] font-black text-amber-100/20 uppercase tracking-[0.2em] mb-4 px-2">TOKO & AKUN</p>
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-4 px-6 py-4 bg-[#5d4037] text-white rounded-2xl font-black text-sm hover:bg-[#3e2723] transition-all shadow-lg border border-white/5 active:scale-95"
                >
                  <LogOut className="w-5 h-5 text-rose-400" />
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-[#2d1e1a]/90' : 'bg-[#f8f3ed]/90'} backdrop-blur-xl border-b ${isDarkMode ? 'border-white/5' : 'border-[#d7ccc8]/40'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-4 bg-[#5d4037] text-white rounded-2xl shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black uppercase tracking-tighter text-[#5d4037] font-display">
                {viewTitles[viewMode] || 'SRMA 24'}
              </h1>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-amber-400/50 rounded-full" />
                <p className="text-[9px] font-black text-amber-800/40 uppercase tracking-widest leading-none">Kepala Sekolah</p>
              </div>
            </div>
          </div>

           <div className="flex items-center gap-2">
             <button
                onClick={() => setViewMode('profil')}
                className="p-2 border-2 border-[#d7ccc8] rounded-2xl hover:bg-white transition-all shadow-sm group"
              >
                <User className="w-6 h-6 text-[#5d4037] group-hover:scale-110 transition-transform" />
             </button>
             <button
               onClick={() => auth.signOut()}
               className="p-2 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all"
               title="Keluar"
             >
               <LogOut className="w-6 h-6" />
             </button>
           </div>
        </div>
      </header>

      <div className={`p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24 space-y-8`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        
        {viewMode === 'statistik' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             {renderStatistik()}
          </div>
        )}

        {viewMode === 'perizinan' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('sakit'); setTimeFilter('hari_ini'); }}
                className="relative overflow-hidden bg-[#5d4037] p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer border-b-4 border-[#3e2723]"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{sakitStats.hariIni}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Activity className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80 italic">Sakit<br />Hari Ini</p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('sakit'); setTimeFilter('kemarin'); }}
                className="relative overflow-hidden bg-[#5d4037] p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer border-b-4 border-[#3e2723]"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{sakitStats.kemarin}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Clock className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80 italic">Sakit<br />Kemarin</p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('sakit'); setTimeFilter('minggu_ini'); }}
                className="relative overflow-hidden bg-[#5d4037] p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer border-b-4 border-[#3e2723]"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{sakitStats.mingguIni}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Calendar className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80 italic">Sakit<br />Minggu Ini</p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('sakit'); setTimeFilter('bulan_ini'); }}
                className="relative overflow-hidden bg-[#5d4037] p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer border-b-4 border-[#3e2723]"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{sakitStats.bulanIni}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <BarChart3 className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80 italic">Sakit<br />Bulan Ini</p>
                </div>
              </motion.div>
            </div>

            {/* Riwayat Aktivitas Header */}
            <div className="flex items-center justify-between mt-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Riwayat Aktivitas</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Konsolidasi Data Seluruh Staf</p>
              </div>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setTimeFilter('hari_ini');
                }}
                className="text-[10px] font-black text-[#5d4037] hover:text-black transition-colors uppercase tracking-widest bg-[#f8f3ed] px-3 py-1.5 rounded-full border border-[#d7ccc8]/40"
              >
                Reset
              </button>
            </div>

          <div className="space-y-6">
            {/* Horizontal Time Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[ 
                { id: 'hari_ini', label: 'Hari Ini' },
                { id: 'kemarin', label: 'Kemarin' },
                { id: 'minggu_ini', label: 'Satu Minggu' },
                { id: 'bulan_ini', label: 'Satu Bulan' },
                { id: 'semua', label: 'Semua' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTimeFilter(cat.id as any)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    timeFilter === cat.id
                      ? 'bg-[#5d4037] text-white shadow-xl shadow-black/10'
                      : 'bg-white text-[#8b5e3c] border border-[#d7ccc8]/40 hover:border-[#8b5e3c]/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#d7ccc8]/40 mb-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d7ccc8] group-focus-within:text-[#5d4037] transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau detail riwayat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#fdfcf0] border border-[#f8f3ed] rounded-2xl focus:ring-2 focus:ring-[#5d4037] outline-none transition-all text-sm font-black italic text-[#3e2723]"
                />
              </div>
            </div>
          </div>

          {/* List Riwayat - Combined & Color Coded */}
          <div className="grid grid-cols-1 gap-3">
            {filteredHistory.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => {
                  if (item.origin === 'izin_sakit') setSelectedPermit(item.raw as IzinSakit);
                  else setShowHistoryDetail(item);
                }}
                className={`group flex items-center gap-4 p-4 bg-white rounded-[2rem] shadow-sm border-l-8 hover:shadow-md transition-all cursor-pointer ${
                  item.category === 'sakit' ? 'border-[#5d4037]' :
                  item.category === 'umum' ? 'border-[#8b5e3c]' :
                  'border-[#c0b298]'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  item.category === 'sakit' ? 'bg-[#f8f3ed] text-[#5d4037]' :
                  item.category === 'umum' ? 'bg-[#fdfcf0] text-[#8b5e3c]' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-[#3e2723] font-display truncate tracking-tight italic">{item.title} ({item.subtitle})</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-widest border ${
                      item.category === 'sakit' ? 'bg-[#f8f3ed] text-[#5d4037] border-[#d7ccc8]/40' :
                      item.category === 'umum' ? 'bg-[#fdfcf0] text-[#8b5e3c] border-[#d7ccc8]/20' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {item.category === 'sakit' ? 'Dr' : 
                       item.category === 'umum' ? 'Asuh' : 'Kelas'} : {item.type}
                    </span>
                    <p className="text-[10px] font-bold text-[#8b5e3c]/60 italic uppercase tracking-tight truncate flex-1 leading-none">
                      {item.details}
                    </p>
                  </div>
                  <p className="text-[9px] font-black text-[#8b5e3c]/40 mt-1 uppercase tracking-widest flex items-center gap-1 italic">
                    <Clock className="w-3 h-3" />
                    {item.date ? format(item.date, 'dd MMM, HH:mm') : '-'}
                  </p>
                </div>
                <div className="text-[#d7ccc8] group-hover:text-[#5d4037] transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-[#d7ccc8]/40">
                <ClipboardList className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                <h3 className="text-[#5d4037] font-black uppercase tracking-widest text-xs italic">Riwayat Kosong</h3>
                <p className="text-[#8b5e3c]/40 text-[9px] mt-1 bg-[#f8f3ed] inline-block px-3 py-1 rounded-full uppercase font-black italic">Tidak ditemukan aktivitas</p>
              </div>
            )}
          </div>
        </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Memorandum Intern</h2>
              <p className="text-sm text-slate-500">Kirim instruksi atau pengumuman resmi ke staf.</p>
            </div>
            <button
              onClick={() => setShowMemoModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Buat Memo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memos.map((memo) => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group bg-orange-50 p-6 rounded-[2.5rem] shadow-sm border border-orange-100 border-l-8 border-l-orange-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div 
                  onClick={() => setSelectedMemo(memo)}
                  className="flex items-center justify-between flex-1"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 font-display group-hover:text-orange-700 transition-colors">{memo.perihal}</h3>
                      <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                        {memo.nomor_memo} • {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {memo.penerima.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-black rounded uppercase tracking-tighter">
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-300 group-hover:text-orange-500 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMemorandum(memo.id!);
                  }}
                  className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors shrink-0"
                  title="Hapus Memo"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Belum Ada Memo</h3>
                <p className="text-slate-500 text-sm mt-1">Gunakan tombol "Buat Memo" untuk mengirim instruksi.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {viewMode === 'pengumuman' && (
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pengumuman Banner</h2>
              <p className="text-sm text-slate-500">Kelola pengumuman yang tampil di semua akun.</p>
            </div>
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Buat Pengumuman
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 font-display">{ann.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{ann.content}</p>
                    <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                      Oleh {ann.authorName} • {ann.createdAt && typeof ann.createdAt.toDate === 'function' ? format(ann.createdAt.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteAnnouncement(ann.id!)}
                  className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Belum Ada Pengumuman</h3>
                <p className="text-slate-500 text-sm mt-1">Gunakan tombol "Buat Pengumuman" untuk menyiarkan informasi.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {viewMode === 'pinjam_laptop' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Professional Filter UI */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Permohonan Laptop</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manajemen Izin Inventaris</p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                  {(['semua', 'hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setLaptopTimeFilter(f)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        laptopTimeFilter === f 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f === 'semua' ? 'Semua' : 
                       f === 'hari_ini' ? 'Hari Ini' :
                       f === 'kemarin' ? 'Kemarin' :
                       f === 'minggu_ini' ? 'Minggu Ini' : 'Bulan Ini'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {laptopRequests
                .filter(req => {
                  const reqDate = req.tgl_request.toDate();
                  if (laptopTimeFilter === 'hari_ini') return isToday(reqDate);
                  if (laptopTimeFilter === 'kemarin') return isYesterday(reqDate);
                  if (laptopTimeFilter === 'minggu_ini') return isThisWeek(reqDate, { weekStartsOn: 1 });
                  if (laptopTimeFilter === 'bulan_ini') return isThisMonth(reqDate);
                  return true;
                })
                .map(req => (
                  <motion.div
                    key={req.id}
                    layout
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                          <Laptop className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 font-display leading-tight">Pinjam Laptop - {req.kelas}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(req.tgl_request.toDate(), 'EEEE, dd MMM yyyy, HH:mm')}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                        <span>Guru Pengaju</span>
                        <span className="text-slate-900">{req.guru_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                        <span>Mata Pelajaran</span>
                        <span className="text-slate-900">{req.mapel}</span>
                      </div>
                    </div>

                    <div className="py-2 bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Siswa ({req.daftar_siswa.length})</p>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed truncate">
                        {req.daftar_siswa.join(', ')}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <button
                        onClick={() => handleLaptopPDF(req)}
                        disabled={laptopPdfLoading === req.id}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                      >
                        {laptopPdfLoading === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                        Cetak Surat Izin Laptop
                      </button>
                    </div>
                  </motion.div>
              ))}
              {laptopRequests.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Laptop className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permohonan masuk</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'permohonan_hp' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Professional Filter UI */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Permohonan HP</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manajemen Izin Gadget</p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                  {(['semua', 'hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setHpTimeFilter(f)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        hpTimeFilter === f 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f === 'semua' ? 'Semua' : 
                       f === 'hari_ini' ? 'Hari Ini' :
                       f === 'kemarin' ? 'Kemarin' :
                       f === 'minggu_ini' ? 'Minggu Ini' : 'Bulan Ini'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hpRequests
                .filter(req => {
                  const reqDate = req.tgl_request.toDate();
                  if (hpTimeFilter === 'hari_ini') return isToday(reqDate);
                  if (hpTimeFilter === 'kemarin') return isYesterday(reqDate);
                  if (hpTimeFilter === 'minggu_ini') return isThisWeek(reqDate, { weekStartsOn: 1 });
                  if (hpTimeFilter === 'bulan_ini') return isThisMonth(reqDate);
                  return true;
                })
                .map(req => (
                  <motion.div
                    key={req.id}
                    layout
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 font-display leading-tight">Pinjam HP - {req.kelas}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(req.tgl_request.toDate(), 'EEEE, dd MMM yyyy, HH:mm')}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                        <span>Guru Pengaju</span>
                        <span className="text-slate-900">{req.guru_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                        <span>Mata Pelajaran</span>
                        <span className="text-slate-900">{req.mapel}</span>
                      </div>
                    </div>

                    <div className="py-2 bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Siswa ({req.daftar_siswa.length})</p>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed truncate">
                        {req.daftar_siswa.join(', ')}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <button
                        onClick={() => handleHPPDF(req)}
                        disabled={hpRequestPdfLoading === req.id}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                      >
                        {hpRequestPdfLoading === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                        Cetak Surat Izin HP
                      </button>
                    </div>
                  </motion.div>
              ))}
              {hpRequests.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permohonan HP masuk</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'kartu_siswa' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
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
                {classes.map((c) => {
                  const studentCount = students.filter(s => c === 'Semua' || s.kelas === c).length;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedClass(c)}
                      className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedClass === c
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      {c}
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${selectedClass === c ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {studentCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {students
                .filter(s => {
                  const name = s.nama_lengkap || '';
                  const nik = s.nik || '';
                  const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
                  const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
                                       nik.includes(studentSearchTerm);
                  return matchesClass && matchesSearch;
                })
                .map((student) => {
                  const isFemale = student.jenis_kelamin?.toLowerCase().startsWith('p');
                  const colorClass = isFemale ? 'pink' : 'blue';
                  
                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      onClick={() => setSelectedStudent(student)}
                      className={`bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:border-${colorClass}-300 cursor-pointer transition-all`}
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-${colorClass}-50 group-hover:text-${colorClass}-500 transition-colors`}>
                            <span className="text-xl font-black">{student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-black text-slate-900 leading-tight group-hover:text-${colorClass}-600 transition-colors line-clamp-2 uppercase text-sm`}>{student.nama_lengkap || 'Tanpa Nama'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 bg-${colorClass}-100 text-${colorClass}-700 rounded text-[8px] font-black uppercase tracking-widest`}>{student.kelas}</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{student.asrama || 'ASRAMA'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIK</span>
                            <span className="text-xs font-mono font-bold text-slate-600">{student.nik || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TTL</span>
                            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{student.ttl || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ayah/Ibu</span>
                            <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{student.ayah || '-'} / {student.ibu || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Modal Buat Memo */}
      {showMemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Buat Memorandum Baru</h3>
              </div>
              <button onClick={() => setShowMemoModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSendMemo} className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerima Instruksi</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllPenerima}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all tracking-widest ${
                      newMemo.penerima.length === 3 ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    SEMUA STAF
                  </button>
                  {(['dokter', 'wali_asuh', 'wali_kelas'] as UserRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => togglePenerima(role)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all tracking-widest ${
                        newMemo.penerima.includes(role) ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {role.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal / Subjek</label>
                <input
                  required
                  value={newMemo.perihal}
                  onChange={e => setNewMemo(prev => ({ ...prev, perihal: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-black text-slate-900 font-display"
                  placeholder="Contoh: Instruksi Kebersihan UKS"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Memorandum</label>
                <textarea
                  required
                  rows={6}
                  value={newMemo.isi}
                  onChange={e => setNewMemo(prev => ({ ...prev, isi: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-700 leading-relaxed font-medium"
                  placeholder="Tuliskan pesan atau instruksi Bapak di sini..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMemoModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={memoLoading}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {memoLoading ? 'Mengirim...' : <><Send className="w-4 h-4" /> Kirim Memo</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Announcement */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Bell className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Buat Pengumuman Baru</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Siarkan ke Semua Akun</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Judul Pengumuman</label>
                <input
                  required
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-black text-slate-900 font-display"
                  placeholder="Contoh: Libur Idul Fitri 1445 H"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pengumuman</label>
                <textarea
                  required
                  rows={4}
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700 resize-none"
                  placeholder="Tuliskan detail pengumuman di sini..."
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleAddAnnouncement}
                disabled={announcementLoading || !newAnnouncement.title.trim() || !newAnnouncement.content.trim()}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {announcementLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Siarkan</>}
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
                  <h3 className="font-black text-slate-900">Detail Memorandum</h3>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerima</label>
                <div className="flex flex-wrap gap-2">
                  {selectedMemo.penerima.map(r => (
                    <span key={r} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal</label>
                <p className="text-xl font-black text-slate-900 leading-tight font-display">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{selectedMemo.isi}</p>
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

      {/* Modal Laporan Lengkap */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Laporan Lengkap</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Pilih Periode Laporan</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: 'kemarin', label: 'Kemarin' },
                  { id: 'minggu_ini', label: 'Minggu Ini' },
                  { id: 'bulan_ini', label: 'Bulan Ini' }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setReportRange(range.id as any)}
                    className={`p-4 rounded-2xl border-2 transition-all text-center ${
                      reportRange === range.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-widest">{range.label}</p>
                  </button>
                ))}
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                  Laporan akan mencakup seluruh data perizinan (Sakit, Umum, Catatan) pada periode yang dipilih dalam format PDF resmi.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateFullReport}
                disabled={reportLoading}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4" /> Cetak Laporan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Riwayat Umum (Non-Izin Sakit) */}
      {showHistoryDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Aktivitas</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{showHistoryDetail.type}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</label>
                  <p className="font-black text-slate-900">{showHistoryDetail.title}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900">{showHistoryDetail.subtitle}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Keterangan
                </label>
                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{showHistoryDetail.details}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</label>
                  <p className="text-xs font-bold text-slate-900">{showHistoryDetail.date ? format(showHistoryDetail.date, 'dd MMM yyyy, HH:mm') : '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    showHistoryDetail.status === 'approved' || showHistoryDetail.status === 'acknowledged'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {showHistoryDetail.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 mt-2">
              <button
                onClick={() => setShowHistoryDetail(null)}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedPermit.tipe === 'sakit' ? 'Diagnosa Medis' : (selectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Isi Catatan')}
                </label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {selectedPermit.tipe === 'sakit' ? selectedPermit.diagnosa : (selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.isi_catatan)}
                  </p>
                </div>
              </div>

              {selectedPermit.tipe !== 'catatan' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Izin</label>
                    <p className="text-sm font-black text-slate-900 font-display">{selectedPermit.jumlah_hari} Hari</p>
                    <p className="text-[10px] font-bold text-slate-500">
                      {selectedPermit.tgl_mulai && typeof selectedPermit.tgl_mulai.toDate === 'function' ? format(selectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {selectedPermit.tgl_selesai && typeof selectedPermit.tgl_selesai.toDate === 'function' ? format(selectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-indigo-100 text-indigo-700'
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

              {selectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-black">
                    <MapPin className="w-4 h-4" />
                    {selectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                    selectedPermit.tindakan.map((t, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{t.peran}: {t.oleh}</span>
                          <span className="text-[9px] font-bold text-slate-400">{t.waktu && typeof t.waktu.toDate === 'function' ? format(t.waktu.toDate(), 'HH:mm, dd MMM') : '-'}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{t.pesan}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada catatan tindakan</p>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Tambah catatan/instruksi Kepala Sekolah..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                  <button
                    onClick={() => handleAddTindakan(selectedPermit.id!)}
                    disabled={actionLoading || !newTindakan.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              {selectedPermit && (
                <button
                  onClick={() => {
                    generatePermitPDF(selectedPermit);
                    setSelectedPermit(null);
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa Lengkap */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className={`p-8 border-b border-slate-100 flex items-center justify-between ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-50' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-5">
                <div className={`w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center shadow-lg shadow-black/5`}>
                  <span className={`text-2xl font-black ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'text-pink-600' : 'text-blue-600'}`}>
                    {selectedStudent.nama_lengkap.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{selectedStudent.nama_lengkap}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white'}`}>
                      {selectedStudent.kelas}
                    </span>
                    <span className="px-2.5 py-1 bg-white/80 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-200/50">
                      {selectedStudent.asrama || 'ASRAMA'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="p-3 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Data Pribadi */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 rounded-full ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-500' : 'bg-blue-500'}`} />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Data Personal</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nomor Induk Kependudukan (NIK)</label>
                      <p className="text-sm font-mono font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">{selectedStudent.nik || '-'}</p>
                    </div>
                    
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tempat, Tanggal Lahir</label>
                      <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">{selectedStudent.ttl || `${selectedStudent.tempat_lahir}, ${selectedStudent.tanggal_lahir}` || '-'}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ayah</label>
                        <p className="text-sm font-black text-slate-700 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 group-hover:border-indigo-200 transition-all">{selectedStudent.ayah || '-'}</p>
                      </div>
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ibu</label>
                        <p className="text-sm font-black text-slate-700 bg-rose-50/30 p-4 rounded-2xl border border-rose-100 group-hover:border-rose-200 transition-all">{selectedStudent.ibu || '-'}</p>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alamat Lengkap</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">{selectedStudent.alamat || 'Alamat tidak tersedia'}</p>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/50">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Kec: {selectedStudent.kecamatan || '-'}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">Kel: {selectedStudent.kelurahan || '-'}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">RT/RW: {selectedStudent.rt || '00'}/{selectedStudent.rw || '00'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Siswa ke-</label>
                      <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.anak_ke || '-'} dari {selectedStudent.saudara || '-'} bersaudara</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-full py-5 bg-white border border-slate-200 text-slate-600 font-black rounded-[2rem] hover:bg-slate-100 hover:shadow-lg transition-all uppercase tracking-widest text-xs"
              >
                Tutup Profil Siswa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
