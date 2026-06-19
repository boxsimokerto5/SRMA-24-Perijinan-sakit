import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, Timestamp, query, where, orderBy, onSnapshot, updateDoc, doc, arrayUnion, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, WALI_KELAS_LIST, IzinSakit, LogTindakan, Memorandum, Siswa, normalizeKelas, HealthCheckProposal, Announcement } from '../types';
import { notifyAllRoles } from '../services/fcmService';
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
  Cell
} from 'recharts';
import { ClipboardList, Plus, Calendar, User, Activity, Clock, MapPin, Printer, Loader2, Send, MessageSquare, Mail, ShieldCheck, CheckCircle2, BarChart3, Search, ChevronRight, ChevronDown, Check, TrendingUp, Stethoscope, HeartPulse, Building, AlertCircle, Menu, Database, LogOut, GraduationCap, LayoutDashboard, Bell, Info, FileText, BookOpen, X, Image as LucideImage } from 'lucide-react';
import Logo from './Logo';
import { format, addDays, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateMemorandumPDF, generateHealthCheckProposalPDF, generateSummaryReportPDF, generateHealthCheckSummaryReportPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import AgendaView from './AgendaView';
import JurnalKeperawatanView from './JurnalKeperawatanView';
import { motion, AnimatePresence } from 'motion/react';

interface DokterViewProps {
  user: AppUser;
  activeTab: string;
}

export default function DokterView({ user, activeTab }: DokterViewProps) {
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [notifications] = useState([
    { id: 1, title: 'Izin Disetujui', message: 'Siswa Ahmad Fauzi (X-1) telah disetujui izinnya.', time: '5m ago', type: 'success' },
    { id: 2, title: 'Memo Baru', message: 'Anda menerima memorandum baru dari Kepala Sekolah.', time: '1h ago', type: 'info' }
  ]);
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [expandedMemos, setExpandedMemos] = useState<Record<string, boolean>>({});
  const [memoSearch, setMemoSearch] = useState('');

  const toggleExpandMemo = (memoId: string) => {
    setExpandedMemos(prev => ({
      ...prev,
      [memoId]: !prev[memoId]
    }));
  };

  const [students, setStudents] = useState<Siswa[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Helper to generate nomor surat
  const generateNomorSurat = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `SRMA24-${randomNum}-SR-2026`;
  };

  // Form states
  const [nomorSurat, setNomorSurat] = useState(generateNomorSurat());
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [diagnosa, setDiagnosa] = useState('');
  const [jumlahHari, setJumlahHari] = useState(1);
  const [tglMulai, setTglMulai] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [waliKelas, setWaliKelas] = useState(WALI_KELAS_LIST[0].name);

  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [newTindakan, setNewTindakan] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

  // View Mode
  const [viewMode, setViewMode] = useState<'perizinan' | 'kartu_siswa' | 'usulan_cek' | 'statistik' | 'profil' | 'memorandum' | 'buat_surat' | 'riwayat_skd' | 'mading' | 'agenda' | 'jurnal_keperawatan'>('statistik');
  const [isAksesDropdownOpen, setIsAksesDropdownOpen] = useState(false);

  const viewTitles: Record<string, string> = {
    'perizinan': 'Riwayat Perizinan',
    'kartu_siswa': 'Data Siswa',
    'usulan_cek': 'Usulan Cek Kesehatan',
    'statistik': 'Statistik Kesehatan',
    'profil': 'Profil Dokter',
    'memorandum': 'Memorandum',
    'buat_surat': 'Buat Surat Keterangan',
    'riwayat_skd': 'Riwayat Surat (SKD)',
    'mading': 'Mading Kampus',
    'agenda': 'Agenda Dokter',
    'jurnal_keperawatan': 'Jurnal Keperawatan'
  };

  useEffect(() => {
    if (activeTab === 'profil') setViewMode('profil');
    else if (activeTab === 'statistik') setViewMode('statistik');
    else if (activeTab === 'perizinan') setViewMode('riwayat_skd');
  }, [activeTab]);
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [proposals, setProposals] = useState<HealthCheckProposal[]>([]);
  const [proposalTimeFilter, setProposalTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'semua'>('hari_ini');
  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const defaultBanners = [
    {
      id: 'def-1',
      title: "Informasi Kesehatan",
      content: "Jaga kebersihan diri dan lingkungan asrama untuk mencegah penyebaran penyakit.",
      color: "from-[#075e6e] to-[#085a6a]",
      icon: Info
    }
  ];

  const banners = announcements.length > 0 
    ? announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        color: "from-rose-600 to-orange-600",
        icon: Bell,
        author: "Kepala Sekolah"
      }))
    : defaultBanners.map(b => ({ ...b, author: "Sistem" }));

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

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
  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).filter(Boolean).sort()];

  const currentSelectedPermit = permits.find(p => p.id === selectedPermit?.id) || selectedPermit;

  React.useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'siswa'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => {
          const rawData = doc.data() as Siswa;
          return { 
            id: doc.id, 
            ...rawData,
            kelas: normalizeKelas(rawData.kelas)
          } as Siswa;
        }).sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
        setStudents(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'siswa');
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    const wk = WALI_KELAS_LIST.find(w => w.kelas === kelas);
    if (wk) {
      setWaliKelas(wk.name);
    }
  }, [kelas]);

  const handleNamaSiswaChange = (value: string) => {
    setNamaSiswa(value);
    if (value.length > 1) {
      const filtered = students.filter(s => {
        const name = s.nama_lengkap || '';
        return name.toLowerCase().includes(value.toLowerCase());
      }).slice(0, 5);
      setFilteredStudents(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredStudents([]);
      setShowSuggestions(false);
    }
  };

  const selectStudent = (student: Siswa) => {
    setNamaSiswa(student.nama_lengkap);
    setKelas(student.kelas);
    
    // Auto-select Wali Kelas based on class
    const wk = WALI_KELAS_LIST.find(w => w.kelas === student.kelas);
    if (wk) {
      setWaliKelas(wk.name);
    }
    
    setShowSuggestions(false);
  };

  const handleProposalStudentClick = (studentName: string) => {
    // Attempt to find student object in local state (must have been loaded in kartu_siswa effect)
    const student = students.find(s => s.nama_lengkap.toLowerCase() === studentName.toLowerCase());
    
    if (student) {
      selectStudent(student);
    } else {
      // If not found in the pre-loaded slice, at least set the name
      setNamaSiswa(studentName);
      setDiagnosa('');
      setJumlahHari(1);
    }
    
    setViewMode('buat_surat');
    setShowSidebar(false);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleGenerateProposalPDF = async (proposal: HealthCheckProposal) => {
    setPdfLoading(proposal.id!);
    try {
      await generateHealthCheckProposalPDF(proposal);
    } catch (error) {
      console.error("Proposal PDF Error:", error);
      alert("Gagal membuat PDF usulan. Silakan coba lagi.");
    } finally {
      setPdfLoading(null);
    }
  };

  const handleAddTindakan = async (permitId: string) => {
    if (!newTindakan.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        tindakan: arrayUnion({
          waktu: Timestamp.now(),
          oleh: user.name,
          peran: 'Dokter',
          pesan: newTindakan
        })
      });
      setNewTindakan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('tipe', '==', 'sakit'),
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
      setPermits(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'izin_sakit');
    });
    return () => unsubscribe();
  }, [user.uid]);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'dokter'),
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

  React.useEffect(() => {
    const q = query(
      collection(db, 'health_check_proposals')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthCheckProposal));
      // Sort manually to avoid index issues while still providing good UX
      setProposals(data.sort((a, b) => {
        const timeA = a.tgl_usulan?.toMillis() || 0;
        const timeB = b.tgl_usulan?.toMillis() || 0;
        return timeB - timeA;
      }));
    }, (err) => {
      console.error("Proposals subscription error:", err);
      handleFirestoreError(err, OperationType.LIST, 'health_check_proposals');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (jumlahHari < 1) {
      alert('Jumlah hari minimal 1 hari');
      setLoading(false);
      return;
    }

    const startDate = new Date(tglMulai);
    const endDate = addDays(startDate, jumlahHari - 1);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'sakit',
        nomor_surat: nomorSurat,
        nama_siswa: namaSiswa,
        kelas: kelas,
        diagnosa: diagnosa,
        jumlah_hari: jumlahHari,
        tgl_mulai: Timestamp.fromDate(startDate),
        tgl_selesai: Timestamp.fromDate(endDate),
        tgl_surat: serverTimestamp(),
        lokasi: 'Kediri',
        nama_dokter: user.name || 'Dokter SRMA',
        nama_wali_kelas: waliKelas,
        status: 'pending_asuh',
        dokter_uid: user.uid,
      });

      // Automatically add record to Jurnal Keperawatan
      await addDoc(collection(db, 'jurnal_keperawatan'), {
        nama_siswa: namaSiswa,
        kelas: kelas,
        keterangan_sakit: `${diagnosa} (SKD #${nomorSurat})`,
        tgl_mulai: Timestamp.fromDate(startDate),
        status: 'dirawat',
        penanganan: [
          {
            waktu: Timestamp.fromDate(startDate),
            oleh_name: user.name || 'Dokter Klinik',
            oleh_role: 'dokter',
            tindakan: `Penerbitan SKD nomor ${nomorSurat} selama ${jumlahHari} hari.`
          }
        ],
        created_by_name: user.name || 'Dokter Klinik',
        created_by_uid: user.uid,
        created_by_role: 'dokter'
      });

      // Notify relevant roles
      notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Izin Sakit Baru', `Dokter ${user.name} membuat riwayat izin sakit untuk ${namaSiswa}.`);

      setViewMode('riwayat_skd');
      // Reset form fields
      setNomorSurat(generateNomorSurat());
      setNamaSiswa('');
      setDiagnosa('');
      setJumlahHari(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'izin_sakit');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessProposal = async (proposalId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'health_check_proposals', proposalId), {
        status: 'processed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `health_check_proposals/${proposalId}`);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status.startsWith('pending')).length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length,
    usulan: proposals.length
  };

  // Current Time Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (activeTab === 'profil') {
    // Profil view will be handled inside main return
  }

  const renderStatistik = () => {
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

    const dropdownFeatures = [
      { 
        title: 'Update Diagnosa & Keterangan Dokter Siswa', 
        id: 'kartu_siswa', 
        icon: User, 
        desc: 'Kelola data riwayat penyakit, diagnose medis & obat siswa',
        badge: 'Database'
      },
      { 
        title: 'Verifikasi Akhir Perizinan Sakit', 
        id: 'riwayat_skd', 
        icon: ClipboardList, 
        desc: 'Verifikasi dispensasi dan bukti istirahat dari dokter eksternal',
        badge: 'Verifikasi'
      },
      { 
        title: 'Review Usulan Kesehatan dari Wali Asrama', 
        id: 'usulan_cek', 
        icon: ShieldCheck, 
        desc: 'Evaluasi pengajuan permohonan cek medis reguler dari pamong',
        badge: 'Urgent'
      },
      { 
        title: 'Statistik Kesehatan Siswa Terpadu', 
        id: 'statistik', 
        icon: LayoutDashboard, 
        desc: 'Pantau grafik perkembangan insiden medis di asrama secara real-time',
        badge: 'Dashboard'
      },
      { 
        title: 'Review Riwayat Perizinan Siswa', 
        id: 'perizinan', 
        icon: ClipboardList, 
        desc: 'Cari & filter arsip lengkap riwayat persetujuan istirahat sakit',
        badge: 'Arsip'
      },
      { 
        title: 'Berbagi Catatan di Mading Sekolah', 
        id: 'mading', 
        icon: BookOpen, 
        desc: 'Tulis tips kesehatan bulanan atau himbauan kebersihan kamar',
        badge: 'Informasi'
      }
    ];

    const COLORS = ['#8b5e3c', '#5d4037', '#c0b298', '#d7ccc8', '#a1887f'];

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-12 mt-6">
        <div className="bg-[#3e2723] p-6 md:p-8 rounded-2xl text-white shadow-md relative overflow-hidden group border-b-4 border-stone-900">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 text-left">
            <h1 className="text-xl md:text-2xl font-black font-display tracking-tight mb-2 italic leading-tight uppercase">Dashboard Layanan Medik</h1>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-xl backdrop-blur-md border border-white/10 w-fit mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
              <p className="text-[9px] font-black text-amber-100 uppercase tracking-widest italic">
                {getRoleLabel(user.role || 'dokter')}: {user.name}
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-1.5 border border-white/10 select-none">
              <button
                type="button"
                onClick={() => setIsAksesDropdownOpen(!isAksesDropdownOpen)}
                className="w-full text-left p-4 hover:bg-white/5 rounded-lg flex items-center justify-between transition-all duration-300 group/btn"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-400/10 text-amber-300 group-hover/btn:bg-amber-400/20 group-hover/btn:scale-105 transition-all duration-300">
                    <LayoutDashboard className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-200 italic leading-none">
                      Akses Perizinan Terpadu
                    </h3>
                    <p className="text-[7.5px] font-black uppercase text-amber-100/50 tracking-widest mt-1 italic">
                      {isAksesDropdownOpen ? 'Klik untuk menutup menu' : 'Klik untuk mengeksplorasi layanan'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black bg-amber-400/20 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-300/20 hidden sm:inline-block">
                    {dropdownFeatures.length} Menu
                  </span>
                  <motion.div
                    animate={{ rotate: isAksesDropdownOpen ? 180 : 0, scale: isAksesDropdownOpen ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <ChevronDown className="w-4 h-4 text-amber-200" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {isAksesDropdownOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden px-4 pb-4 space-y-2 mt-2"
                  >
                    <div className="h-px bg-white/10 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dropdownFeatures.map((item, idx) => {
                        const IconComponent = item.icon;
                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setViewMode(item.id as any);
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="w-full text-left bg-white/[0.03] hover:bg-white/[0.08] p-3.5 rounded-xl border border-white/5 hover:border-amber-400/20 flex items-start gap-3.5 transition-all duration-300 group/item active:scale-[0.99] cursor-pointer"
                          >
                            <div className="p-2.5 rounded-xl bg-[#3e2723]/60 text-amber-200 group-hover/item:bg-amber-400/20 group-hover/item:text-amber-300 transition-all duration-300 shrink-0 shadow-inner">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 group-hover/item:text-amber-200 transition-colors truncate">
                                  {item.title}
                                </span>
                                <span className="text-[7.5px] font-black uppercase bg-amber-400/10 text-amber-300 px-1.5 py-0.5 rounded tracking-wide shrink-0 border border-amber-400/25">
                                  {item.badge}
                                </span>
                              </div>
                              <p className="text-[8px] text-stone-300/70 group-hover/item:text-stone-200/90 transition-colors mt-1 leading-relaxed">
                                {item.desc}
                              </p>
                              <div className="flex items-center gap-1 text-[8px] font-black uppercase text-amber-400 opacity-0 group-hover/item:opacity-100 transition-all duration-300 mt-2 transform translate-y-1 group-hover/item:translate-y-0">
                                <span>Buka Menu</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between font-display relative px-2">
          <div className="absolute -left-4 bottom-0 w-16 h-16 bg-[#3e2723]/5 rounded-full blur-2xl -z-10" />
          <div className="text-left">
            <h2 className="text-lg font-black text-[#3e2723] uppercase italic tracking-tight font-display">E-Klinik Dashboard</h2>
            <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest mt-1 italic leading-none">Indikator Kesehatan Akademik Digital</p>
          </div>
          <div className="p-3 bg-white text-[#3e2723] rounded-xl border border-stone-100 shadow-sm group hover:rotate-3 transition-transform">
            <Activity className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#fcfaf6] rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-1000" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-black text-[#3e2723] uppercase tracking-wider text-[9px] italic leading-none">Analisis Tren Kunjungan</h3>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="h-56 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8f5f2" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#333', fontStyle: 'italic' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#333' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 900, fontSize: '10px' }} />
                  <Line type="monotone" dataKey="value" stroke="#3e2723" strokeWidth={4} dot={{ r: 5, fill: '#3e2723', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, fill: '#3e2723' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-1000" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="font-black text-[#3e2723] uppercase tracking-wider text-[9px] italic leading-none">Etiologi Diagnosa Terbesar</h3>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="h-56 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f8f5f2" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#3e2723', fontStyle: 'italic' }} width={80} />
                  <Tooltip cursor={{ fill: '#fcfaf6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 900, fontSize: '10px' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
                    {diagnosisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3e2723', '#5d4037', '#8b5e3c', '#a1887f', '#d7ccc8'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      dokter: 'Tim Medis Digital',
      wali_asuh: 'Wali Asuh',
      wali_kelas: 'Wali Kelas',
      kepala_sekolah: 'Kepala Sekolah',
      guru_mapel: 'Guru Mapel',
      wali_asrama: 'Wali Asrama'
    };
    return labels[role] || role;
  };

  const features = [
    'Update Diagnosa & Keterangan Dokter Siswa',
    'Verifikasi Akhir Perizinan Sakit',
    'Review Usulan Kesehatan dari Wali Asrama',
    'Statistik Kesehatan Siswa Terpadu',
    'Review Riwayat Perizinan Siswa',
    'Berbagi Catatan di Mading Sekolah'
  ];

  const COLORS = ['#0d9488', '#0ea5e9', '#6366f1', '#f43f5e', '#8b5cf6'];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950 text-amber-50' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans transition-colors duration-500 selection:bg-[#3e2723] selection:text-white`}>
      {/* Sidebar Navigation */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 h-full w-[260px] z-[70] flex flex-col shadow-2xl overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-stone-900 border-white/5' : 'bg-white border-stone-100'}`}
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4">
                  <div className={`rounded-xl p-4 mb-6 border shadow-md relative overflow-hidden group ${isDarkMode ? 'bg-stone-950 border-white/5' : 'bg-[#fcfaf6] border-stone-200'}`}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#3e2723]/5 rounded-full -mr-8 -mt-8 blur-xl group-hover:scale-110 transition-transform" />
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 bg-[#3e2723] rounded-xl flex items-center justify-center shadow-sm -rotate-3 group-hover:rotate-0 transition-transform">
                        <Stethoscope className="w-5 h-5 text-amber-200" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-xs leading-tight tracking-tight uppercase italic font-display">Medical Desk</span>
                        <span className={`text-[8px] font-black uppercase tracking-[0.15em] mt-0.5 opacity-40 italic`}>SRMA 24 KEDIRI</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-3 px-2 italic opacity-30 text-left`}>Klinik Hub Nav</p>
                      <nav className="space-y-1">
                        {[
                          { id: 'statistik', label: 'Dashboard Klinik', icon: LayoutDashboard },
                          { id: 'jurnal_keperawatan', label: 'Jurnal Keperawatan', icon: Activity },
                          { id: 'agenda', label: 'Agenda Kegiatan', icon: Calendar },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'buat_surat', label: 'Penerbitan SKD', icon: FileText },
                          { id: 'riwayat_skd', label: 'Arsip Kesehatan', icon: ClipboardList },
                          { id: 'kartu_siswa', label: 'Database Siswa', icon: User },
                          { id: 'usulan_cek', label: 'Usulan Cek Up', icon: ShieldCheck },
                          { id: 'memorandum', label: 'Memorandum Intern', icon: Mail },
                          { id: 'profil', label: 'Identitas Dokter', icon: User }
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setViewMode(item.id as any);
                              setShowSidebar(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 italic border-b-2 ${
                              viewMode === item.id 
                                ? 'bg-[#3e2723] text-white border-black shadow-md shadow-stone-900/15' 
                                : 'bg-transparent text-stone-400 hover:bg-stone-50 hover:text-[#3e2723] border-transparent'
                            }`}
                          >
                            <item.icon className={`w-4 h-4 ${viewMode === item.id ? 'text-amber-200' : 'text-stone-300'}`} />
                            {item.label}
                          </button>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Logout Section */}
              <div className="p-4 border-t border-stone-100">
                <button 
                  onClick={() => auth.signOut()}
                  className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl font-black text-[9px] transition-all shadow-md active:scale-95 bg-rose-600 text-white border-b-4 border-rose-900 italic uppercase tracking-wider mb-2 justify-center`}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out Session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-30 transition-all ${isDarkMode ? 'bg-[#3e2723]/80 border-white/5' : 'bg-[#fcfaf6]/80 border-stone-200'} backdrop-blur-md border-b h-16`}>
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-2 rounded-xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-stone-900 text-amber-200 shadow-md shadow-black/15' 
                  : 'bg-white text-[#3e2723] shadow-md shadow-stone-200/40'
              } active:scale-95 border border-stone-50`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col text-left">
              <h1 className={`text-sm font-black uppercase tracking-tight font-display italic ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                {viewTitles[viewMode] || 'Medical Center'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1 h-1 bg-[#3e2723] rounded-full animate-pulse opacity-40" />
                <p className={`text-[7px] font-black uppercase tracking-[0.15em] opacity-40 italic ${isDarkMode ? 'text-amber-200/50' : 'text-[#3e2723]'}`}>Digital Health Informatics</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl ${isDarkMode ? 'bg-stone-800 text-amber-200 shadow-sm shadow-black/15' : 'bg-white text-stone-400 shadow-sm shadow-stone-200/40'} transition-all active:scale-95 border border-stone-50`}
            >
              {isDarkMode ? <Activity className="w-4 h-4 text-amber-200" /> : <Activity className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl ${isDarkMode ? 'bg-stone-800 text-amber-200 shadow-sm shadow-black/15' : 'bg-white text-stone-400 shadow-sm shadow-stone-200/40'} transition-all active:scale-95 border border-stone-50 relative`}
              >
                <Mail className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white shadow-xs" />
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-72 ${isDarkMode ? 'bg-stone-900 border-white/5' : 'bg-white border-stone-100'} rounded-2xl shadow-xl p-4 z-50 border`}
                  >
                    <div className="flex items-center justify-between mb-4 px-1">
                       <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-[#3e2723]/30">Pesan Masuk</h3>
                    </div>
                    <div className="space-y-2">
                       {notifications.map(n => (
                        <div key={n.id} className={`p-3 rounded-xl ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-[#fcfaf6]'} transition-all group cursor-pointer border border-transparent`}>
                          <h4 className="text-[10px] font-black uppercase tracking-tight italic text-left">{n.title}</h4>
                          <p className="text-[9px] text-stone-400 mt-1 uppercase leading-relaxed font-bold italic line-clamp-2 text-left">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Top Banner / Announcement (Mobile Native Style) */}
      <AnimatePresence mode="wait">
        {showBanner && banners.length > 0 && banners[bannerIndex] && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 pt-4">
              <div className={`relative overflow-hidden rounded-xl bg-[#3e2723] p-4 text-white shadow-md group border-b-4 border-black`}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                <div className="relative z-10 flex items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20 shadow-sm group-hover:rotate-6 transition-transform">
                      {React.createElement(banners[bannerIndex].icon, { className: "w-5 h-5 text-amber-200" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[9px] font-black uppercase tracking-wider text-amber-100 italic">{banners[bannerIndex].title}</h4>
                        <span className="px-2 py-0.5 bg-white/15 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-xs">
                          {banners[bannerIndex].author || 'System'}
                        </span>
                      </div>
                      <p className="text-xs font-bold leading-normal mt-1 italic text-white/90 font-display">"{banners[bannerIndex].content}"</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-lg transition-all active:scale-90 border border-white/10 group/btn"
                  >
                    <X className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                  </button>
                </div>
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
                    <span className="text-[8px] font-mono tracking-widest text-[#e0a96d] font-bold uppercase italic block mb-0.5">PENGUMUMAN PENTING</span>
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
      <div className="max-w-7xl mx-auto w-full px-4 mt-4">
        <div className="p-0.5 rounded-xl bg-stone-100">
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-[calc(0.75rem-1px)] bg-[#fcfaf6] border-2 border-stone-50 shadow-inner">
            <span className="w-1.5 h-1.5 bg-[#3e2723] rounded-full animate-ping opacity-30" />
            <p className="text-[8px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 text-stone-400 italic">
              OFFICIAL SYSTEM TIME: <span className="text-[#3e2723] font-black">{formatRealTime(currentTime)}</span>
            </p>
            <span className="w-1.5 h-1.5 bg-[#3e2723] rounded-full animate-ping opacity-30" />
          </div>
        </div>
      </div>

      <main className={`p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'jurnal_keperawatan' && <JurnalKeperawatanView user={user} />}

        {viewMode === 'buat_surat' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
               <div className="p-4 border-b border-indigo-50 bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,1)_1px,transparent_0)] bg-[size:16px_16px]" />
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-2 bg-white/20 backdrop-blur-xl rounded-xl border border-white/20 shadow-md">
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-white uppercase tracking-tight text-sm text-left">Penerbitan SKD Digital</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] text-white font-mono uppercase tracking-widest backdrop-blur-md border border-white/10">
                        {nomorSurat}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block relative z-10 text-right">
                  <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em]">Sistem SRMA 24</p>
                  <p className="text-white font-bold text-xs">{format(new Date(), 'dd MMMM yyyy')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                {/* Student Info Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider text-left">Informasi Pasien</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group text-left">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 transition-colors group-focus-within:text-indigo-600 text-left">Nama Lengkap Siswa</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors">
                          <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600" />
                        </div>
                        <input
                          type="text"
                          required
                          value={namaSiswa}
                          onChange={(e) => handleNamaSiswaChange(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-xs text-slate-700 shadow-inner"
                          placeholder="Ketik nama siswa..."
                        />
                        <AnimatePresence>
                          {showSuggestions && filteredStudents.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.98, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98, y: -5 }}
                              className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden backdrop-blur-xl"
                            >
                              <div className="p-2 bg-slate-50/50 border-b border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Ditemukan {filteredStudents.length} siswa</p>
                              </div>
                              {filteredStudents.map((student) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() => selectStudent(student)}
                                  className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center justify-between group/item transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white shadow-xs border border-slate-100 rounded-lg flex items-center justify-center font-black text-xs text-indigo-600">
                                      {student.nama_lengkap.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-slate-900 group-hover/item:text-indigo-700">{student.nama_lengkap || 'Tanpa Nama'}</p>
                                      <p className="text-[8px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{student.kelas}</p>
                                    </div>
                                  </div>
                                  <div className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center group-hover/item:bg-indigo-600 group-hover/item:border-indigo-600 transition-all">
                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover/item:text-white" />
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="group">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 group-focus-within:text-indigo-600 text-left">Kelas</label>
                        <select
                          value={kelas}
                          onChange={(e) => setKelas(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none appearance-none transition-all font-bold text-xs text-slate-700 shadow-inner"
                        >
                          {WALI_KELAS_LIST.map(wk => (
                            <option key={wk.kelas} value={wk.kelas}>{wk.kelas}</option>
                          ))}
                        </select>
                      </div>
                      <div className="group opacity-70">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 text-left">Wali Kelas</label>
                        <div className="px-3 py-2 bg-[#f1f3f5] border border-slate-200 rounded-xl font-bold text-xs text-slate-500 shadow-inner flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 opacity-45" />
                          <span className="truncate">{waliKelas}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Section */}
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider text-left">Hasil Pemeriksaan</h4>
                  </div>
                  
                  <div className="relative group">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 group-focus-within:text-indigo-600 text-left">Diagnosa Medis & Keluhan</label>
                    <div className="relative">
                      <div className="absolute left-3 top-3 p-1 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600" />
                      </div>
                      <textarea
                        required
                        value={diagnosa}
                        onChange={(e) => setDiagnosa(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-xs text-slate-700 shadow-inner min-h-[100px] resize-none"
                        placeholder="Tuliskan hasil diagnosa pasien..."
                      />
                    </div>
                  </div>
                </div>

                {/* Recovery Period Section */}
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider text-left">Masa Istirahat</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 group-focus-within:text-indigo-600 text-left">Durasi (Hari)</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors">
                          <Activity className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600" />
                        </div>
                        <input
                          type="number"
                          min="1"
                          required
                          value={jumlahHari || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setJumlahHari(isNaN(val) ? 0 : val);
                          }}
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-xs text-slate-700 shadow-inner"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Hari</div>
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1 group-focus-within:text-indigo-600 text-left">Mulai Tanggal</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-slate-100 rounded-lg group-focus-within:bg-indigo-100 transition-colors">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600" />
                        </div>
                        <input
                          type="date"
                          required
                          value={tglMulai}
                          onChange={(e) => setTglMulai(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-xs text-slate-700 shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full group/btn relative overflow-hidden rounded-xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-blue-800 transition-transform duration-500 group-hover/btn:scale-105" />
                    <div className="relative py-3.5 px-6 flex items-center justify-center gap-3 text-white font-black uppercase tracking-widest text-xs">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 transition-transform group-hover/btn:scale-105" />
                      )}
                      {loading ? 'Memproses Data...' : 'Terbitkan SKD & Kirim'}
                    </div>
                  </button>
                  <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-4">Data akan secara otomatis terkirim kepada Wali Kelas & Wali Asuh</p>
                </div>
              </form>
            </div>
            
            {/* Quick Stats / Tips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs mb-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5 text-center">Total SKD Bulan Ini</p>
                <p className="text-base font-black text-slate-900 text-center">{permits.filter(p => isThisMonth(p.tgl_surat?.toDate() || new Date())).length}</p>
              </div>
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs mb-2">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5 text-center">Kesehatan Siswa</p>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-tight text-center">Pantau berkala</p>
              </div>
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5 text-center">Keamanan Data</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight text-center">Integrasi Wali Asuh</p>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'riwayat_skd' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            {/* Minimal High-Contrast Header */}
            <div className="bg-[#3e2723] rounded-xl p-4 md:p-5 shadow-md text-white relative overflow-hidden border border-[#5d4037]/60">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-black font-display tracking-tight leading-none italic uppercase">Riwayat Surat</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">MEDICAL LOGS</span>
                    </div>
                    <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-wider italic opacity-80">Database Elektronik Surat Keterangan Sakit</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisWeek(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Minggu Ini', user.name, 'Dokter UKS');
                      }}
                      className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[8px] font-black uppercase tracking-wider italic">Minggu</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-0.5 self-stretch" />
                    <button 
                      onClick={() => {
                        const filtered = permits.filter(p => isThisMonth(p.tgl_surat.toDate()));
                        generateSummaryReportPDF(filtered, 'Bulan Ini', user.name, 'Dokter UKS');
                      }}
                      className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[8px] font-black uppercase tracking-wider italic">Bulan</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setViewMode('buat_surat')}
                    className="px-4 py-2 bg-[#fcfaf6] text-[#3e2723] rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white transition-all active:scale-95 shadow-md italic border-b-2 border-[#d7ccc8]"
                  >
                    <Plus className="w-4 h-4" /> Buat Surat baru
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-xs border border-stone-100 flex flex-col md:flex-row gap-4 items-center border-b-4">
              <div className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari nama siswa atau no surat..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#fcfaf6] border border-stone-100 rounded-xl focus:border-[#3e2723] focus:bg-white outline-none transition-all font-bold text-xs italic placeholder:text-stone-300 shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
                {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                      timeFilter === filter 
                        ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-102' 
                        : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
                    }`}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {permits
                  .filter(p => {
                    const matchesSearch = p.nama_siswa?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        p.nomor_surat?.toLowerCase().includes(searchTerm.toLowerCase());
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
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white p-5 rounded-xl border border-stone-50 shadow-xs hover:shadow-md transition-all group relative border-b-4 border-stone-100 overflow-hidden text-left"
                    >
                      <div className="absolute top-0 right-0 w-1 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-500" />
                      
                      <div className="flex flex-col h-full gap-4 text-left">
                        <div className="flex justify-between items-start">
                           <div className="flex gap-3 text-left">
                              <div className="w-10 h-10 rounded-lg bg-[#fcfaf6] flex items-center justify-center border border-stone-100 group-hover:bg-[#3e2723] transition-colors duration-300">
                                <FileText className="w-5 h-5 text-[#3e2723]/30 group-hover:text-amber-200" />
                              </div>
                              <div className="text-left">
                                <p className="text-[8px] font-bold text-stone-300 uppercase tracking-wider italic">SKD #{permit.nomor_surat}</p>
                                <h4 className="text-sm font-black text-[#3e2723] uppercase italic tracking-tight font-display text-left">{permit.nama_siswa}</h4>
                                <p className="text-[9px] font-bold text-stone-400 mt-0.5 uppercase tracking-wider italic text-left">{permit.kelas}</p>
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#fcfaf6] p-4 rounded-xl border border-stone-50 relative group-hover:border-[#3e2723]/10 transition-colors text-left">
                          <p className="text-[8px] font-black text-stone-300 uppercase tracking-wider mb-2 italic leading-none text-left">Diagnosa Medis:</p>
                          <p className="text-[11px] font-bold text-[#5d4037] italic leading-normal whitespace-pre-wrap text-left">"{permit.diagnosa || permit.alasan || '-'}"</p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-stone-50 mt-auto">
                           <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-stone-200" />
                              <span className="text-[8px] font-black text-stone-300 uppercase tracking-wider italic">
                                {permit.tgl_surat ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy', { locale: id }) : '-'}
                              </span>
                           </div>
                           
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => generatePermitPDF(permit)}
                               className="p-2 bg-stone-50 text-stone-300 hover:text-[#3e2723] hover:bg-white rounded-lg transition-all border border-transparent hover:border-stone-100"
                               title="Cetak PDF"
                             >
                               <Printer className="w-4 h-4" />
                             </button>
                             <div className="px-3 py-1 bg-[#3e2723] text-amber-200 rounded-lg text-[8px] font-black uppercase tracking-wider italic border-b-2 border-black">
                               VERIFIED
                             </div>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {permits.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <FileText className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
                  <h3 className="text-lg font-black text-stone-200 uppercase tracking-wider italic font-display leading-tight mb-2 text-center">Arsip Kosong</h3>
                  <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest italic max-w-xs leading-relaxed text-center">Database elektronik belum merekam adanya surat keterangan yang diterbitkan untuk periode ini.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'statistik' && renderStatistik()}



        {viewMode === 'kartu_siswa' && (
          <div className="space-y-8 animate-in fade-in duration-500">
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
                  {classes.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedClass(c)}
                      className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        selectedClass === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {students.filter(s => (selectedClass === 'Semua' || s.kelas === selectedClass) && (s.nama_lengkap.toLowerCase().includes(studentSearchTerm.toLowerCase()) || (s.nik && s.nik.includes(studentSearchTerm)))).slice(0, 12).map(student => (
                  <motion.div key={student.id} onClick={() => setSelectedStudent(student)} className="bg-white rounded-[2.5rem] border border-slate-100 p-6 cursor-pointer hover:border-indigo-300 transition-all shadow-sm group">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                          {student.nama_lengkap.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight">{student.nama_lengkap}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.kelas}</p>
                        </div>
                    </div>
                  </motion.div>
                ))}
              </div>
          </div>
        )}

        {viewMode === 'usulan_cek' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            {/* Header Style Matching the Theme */}
            <div className="bg-[#3e2723] rounded-2xl p-4 md:p-5 text-white relative overflow-hidden shadow-md border border-[#5d4037]/60">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shadow-black/20 shrink-0">
                    <Activity className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Usulan Kesehatan</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10">
                        MONITORING
                      </span>
                    </div>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-80 leading-snug">
                      Permohonan Pemeriksaan dari Wali Asrama
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-[#5d4037]/90 p-1 rounded-xl border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => {
                        const filtered = proposals.filter(p => isThisWeek(p.tgl_usulan.toDate()));
                        generateHealthCheckSummaryReportPDF(filtered, 'Minggu Ini', user.name);
                      }}
                      className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[8px] font-black uppercase tracking-wider italic">Minggu</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                    <button 
                      onClick={() => {
                        const filtered = proposals.filter(p => isThisMonth(p.tgl_usulan.toDate()));
                        generateHealthCheckSummaryReportPDF(filtered, 'Bulan Ini', user.name);
                      }}
                      className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[8px] font-black uppercase tracking-wider italic">Bulan</span>
                    </button>
                  </div>

                  <div className="px-3 py-1.5 bg-[#fcfaf6] text-[#3e2723] rounded-xl font-black text-[9px] uppercase tracking-wider shadow-sm italic border-b-2 border-[#d7ccc8]">
                    {proposals.filter(p => p.status === 'pending').length} Menunggu
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4 items-center border-b-4">
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full">
                {[
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: 'kemarin', label: 'Kemarin' },
                  { id: 'minggu_ini', label: 'Minggu Ini' },
                  { id: 'semua', label: 'Semua Riwayat' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setProposalTimeFilter(f.id as any)}
                    className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                      proposalTimeFilter === f.id 
                        ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-102' 
                        : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {(proposals || [])
                  .filter(p => {
                    if (proposalTimeFilter === 'semua') return true;
                    
                    const date = p.tgl_usulan?.toDate();
                    if (!date) return false;
                    
                    if (proposalTimeFilter === 'hari_ini') return isToday(date);
                    if (proposalTimeFilter === 'kemarin') return isYesterday(date);
                    if (proposalTimeFilter === 'minggu_ini') return isThisWeek(date);
                    return true;
                  })
                  .map(proposal => (
                   <motion.div 
                     key={proposal.id} 
                     layout
                     initial={{ opacity: 0, scale: 0.98, y: 15 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.98 }}
                     className={`relative overflow-hidden bg-white p-5 rounded-xl border transition-all duration-500 border-b-4 group text-left flex flex-col justify-between ${
                       proposal.status === 'processed' 
                         ? 'border-stone-100 opacity-75 shadow-sm' 
                         : 'border-[#3e2723] shadow-md'
                     }`}
                     id={`proposal-card-${proposal.id}`}
                   >
                      <div className="absolute top-0 right-0 w-1.5 h-full bg-[#3e2723] opacity-0 group-hover:opacity-10 transition-all duration-500" />
                      
                      <div className="flex flex-col h-full gap-4 w-full">
                        <div className="flex items-center justify-between w-full">
                           <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-300 shrink-0 border ${
                                proposal.status === 'processed' ? 'bg-stone-50 text-stone-300 border-stone-200' : 'bg-[#3e2723] text-amber-200 border-transparent shadow-sm'
                              }`}>
                                <Activity className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <p className="text-[8px] font-bold text-stone-300 uppercase tracking-wider italic">
                                  {proposal.tgl_usulan && typeof proposal.tgl_usulan.toDate === 'function' 
                                    ? format(proposal.tgl_usulan.toDate(), 'HH:mm • dd MMM yyyy', { locale: id }) 
                                    : '-'}
                                </p>
                                <h4 className="text-xs font-black text-[#3e2723] uppercase italic font-display leading-tight text-left">Asrama: {proposal.asrama || 'Utama'}</h4>
                              </div>
                           </div>
                           {proposal.status === 'processed' && (
                             <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shrink-0">
                               <CheckCircle2 className="w-4 h-4" />
                             </div>
                           )}
                        </div>

                        <div className="space-y-3">
                          <div className="bg-[#fcfaf6] rounded-xl p-3 border border-stone-50/80">
                            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2 italic text-left">Daftar Siswa:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {proposal.daftar_siswa.map((s, i) => (
                                <button 
                                  key={i} 
                                  onClick={() => handleProposalStudentClick(s)}
                                  className="px-2.5 py-1 bg-white border border-stone-200/60 text-[10px] font-black text-[#5d4037] rounded-lg hover:border-[#3e2723] hover:text-[#3e2723] transition-all shadow-xs flex items-center gap-1.5 active:scale-95 italic shrink-0"
                                >
                                  <User className="w-3 h-3 text-[#3e2723]/40" />
                                  <span>{s}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {proposal.keterangan && (
                             <div className="p-3 bg-rose-50/55 rounded-xl border border-rose-100/60 text-left">
                               <p className="text-[7.5px] font-black text-rose-400 uppercase tracking-wider mb-1 italic">Keterangan Gejala:</p>
                               <p className="text-xs font-semibold text-[#5d4037] italic leading-relaxed whitespace-pre-wrap">"{proposal.keterangan}"</p>
                             </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 mt-auto">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-[#d7ccc8]/20 border border-[#d7ccc8]/40 rounded-lg flex items-center justify-center shrink-0">
                               <User className="w-4 h-4 text-[#3e2723]" />
                             </div>
                             <div className="text-left">
                               <p className="text-[8px] font-bold text-stone-400 uppercase italic leading-none">Diusulkan oleh</p>
                               <span className="text-xs font-extrabold text-[#3e2723] italic block mt-1 leading-none">{proposal.proposer_name}</span>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => handleGenerateProposalPDF(proposal)}
                              className="p-1 px-2.5 bg-[#ebdccb]/60 hover:bg-[#3e2723] hover:text-white text-[7.5px] font-black uppercase tracking-wider text-[#3e2723] rounded transition-all active:scale-95 flex items-center gap-1 border border-transparent"
                              title="Cetak Usulan"
                            >
                               <Printer className="w-3 h-3" />
                               <span>PDF</span>
                            </button>
                            {proposal.status === 'pending' && (
                              <button 
                                onClick={() => handleProcessProposal(proposal.id!)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[8px] uppercase tracking-widest transition-all shadow-xs border-b-2 border-emerald-800 italic"
                              >
                                Selesaikan
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                   </motion.div>
                ))}
              </AnimatePresence>

              {proposals.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
                  <ShieldCheck className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
                  <h3 className="text-base font-black text-stone-300 uppercase tracking-widest italic font-display leading-tight mb-2 text-center">Data Nihil</h3>
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-wider italic max-w-xs leading-relaxed text-center">Saat ini tidak ada usulan cek kesehatan yang perlu ditindaklanjuti.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'memorandum' && (
          <div className="w-full mix-blend-normal space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12 text-left">
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
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Memorandum Intern</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10">
                        OFFICIAL
                      </span>
                    </div>
                    <p className="text-[#ebdccb] text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-80 leading-snug">
                      Instruksi & Komunikasi Strategis dari Pimpinan (Kepala Sekolah)
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#fcfaf6] text-[#3e2723] rounded-xl font-black text-[9px] uppercase tracking-wider shadow-sm italic border-b-2 border-[#d7ccc8] shrink-0">
                  {memos.length} Memorandum Diterima
                </div>
              </div>
            </div>

            {/* Archives and Listing (Compact, aligned with Mading exactly) */}
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-sm shrink-0">
                    <Clock className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Daftar Memo</h3>
                    <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.15em] italic mt-1 leading-none">
                      Daftar instruksi resmi yang harus dilaksanakan
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
                {memos
                  .filter(memo => 
                    memo.perihal?.toLowerCase().includes(memoSearch.toLowerCase()) || 
                    memo.isi?.toLowerCase().includes(memoSearch.toLowerCase()) ||
                    memo.pengirim_name?.toLowerCase().includes(memoSearch.toLowerCase())
                  )
                  .map((memo, idx) => {
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
                        id={`memo-card-${memo.id}`}
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
                            
                            <span className="text-[8px] font-black text-[#ea580c] uppercase tracking-widest italic bg-orange-50 px-2 py-0.5 rounded">
                              {format(memoDate, 'dd MMM yyyy')}
                            </span>
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

                {memos.length === 0 && (
                  <div className="lg:col-span-2 flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-stone-100 text-center relative overflow-hidden">
                    <Mail className="w-12 h-12 text-stone-100 mb-3 opacity-50" />
                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest italic">Belum ada memorandum masuk</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Detail Perizinan */}
      {selectedPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Detail Perizinan</h3>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Siswa</label>
                  <p className="font-bold text-slate-900">{selectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-bold text-slate-900">{selectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diagnosa Medis</label>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedPermit.diagnosa}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Masa Izin</label>
                  <p className="text-sm font-bold text-slate-900">{selectedPermit.jumlah_hari} Hari</p>
                  <p className="text-[10px] text-slate-500">
                    {selectedPermit.tgl_mulai && typeof selectedPermit.tgl_mulai.toDate === 'function' ? format(selectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {selectedPermit.tgl_selesai && typeof selectedPermit.tgl_selesai.toDate === 'function' ? format(selectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedPermit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      selectedPermit.status === 'pending_kelas' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {(selectedPermit.status || '').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-semibold text-slate-700">{selectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-semibold text-slate-700">{selectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {currentSelectedPermit?.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <MapPin className="w-4 h-4" />
                    {currentSelectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {currentSelectedPermit && currentSelectedPermit.tindakan && currentSelectedPermit.tindakan.length > 0 ? (
                    currentSelectedPermit.tindakan.map((t, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase">{t.peran}: {t.oleh}</span>
                          <span className="text-[9px] text-slate-400">{t.waktu && typeof t.waktu.toDate === 'function' ? format(t.waktu.toDate(), 'HH:mm, dd MMM') : '-'}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{t.pesan}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Belum ada catatan tindakan</p>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Tambah catatan tindakan..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    onClick={() => currentSelectedPermit && handleAddTindakan(currentSelectedPermit.id!)}
                    disabled={loading || !newTindakan.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              {currentSelectedPermit && (
                <button
                  onClick={() => {
                    handleGeneratePDF(currentSelectedPermit);
                    setSelectedPermit(null);
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Memo */}
      {selectedMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Memorandum Intern</h3>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari</label>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> {selectedMemo.pengirim_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal</label>
                  <p className="font-bold text-slate-900">
                    {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perihal</label>
                <p className="text-lg font-black text-slate-900 leading-tight">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedMemo.isi}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedMemo(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generateMemorandumPDF(selectedMemo);
                  setSelectedMemo(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa Lengkap */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className={`p-8 border-b border-slate-100 flex items-center justify-between shrink-0 ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-50' : 'bg-blue-50'}`}>
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
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
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

            <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
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
