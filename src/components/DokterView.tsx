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
import { ClipboardList, Plus, Calendar, User, Activity, Clock, MapPin, Printer, Loader2, Send, MessageSquare, Mail, ShieldCheck, CheckCircle2, BarChart3, Search, ChevronRight, Check, TrendingUp, Stethoscope, HeartPulse, Building, AlertCircle, Menu, Database, LogOut, GraduationCap, LayoutDashboard, Bell, Info, FileText, BookOpen } from 'lucide-react';
import Logo from './Logo';
import { format, addDays, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateHealthCheckProposalPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
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
  const [notifications] = useState([
    { id: 1, title: 'Izin Disetujui', message: 'Siswa Ahmad Fauzi (X-1) telah disetujui izinnya.', time: '5m ago', type: 'success' },
    { id: 2, title: 'Memo Baru', message: 'Anda menerima memorandum baru dari Kepala Sekolah.', time: '1h ago', type: 'info' }
  ]);
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
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
  const [viewMode, setViewMode] = useState<'perizinan' | 'kartu_siswa' | 'usulan_cek' | 'statistik' | 'profil' | 'memorandum' | 'buat_surat' | 'riwayat_skd' | 'mading'>('statistik');

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

    const COLORS = ['#8b5e3c', '#5d4037', '#c0b298', '#d7ccc8', '#a1887f'];

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="bg-[#5d4037] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group border-b-4 border-[#3e2723]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black font-display tracking-tight mb-2 italic">Hallo, {user.name || user.email}</h1>
            <p className="text-sm font-bold text-amber-100 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              {getRoleLabel(user.role || 'dokter')}
            </p>
            
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-100/60 mb-4 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Daftar Fitur Akun:
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-amber-50">
                {features.map((f, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 text-xs font-bold"
                  >
                    <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#5d4037] font-display">Statistik Klinik</h2>
            <p className="text-[10px] font-bold text-[#8b5e3c]/60 uppercase tracking-widest mt-1">Data pemeriksaan kesehatan siswa.</p>
          </div>
          <div className="p-3 bg-[#fdfcf0] text-[#5d4037] rounded-2xl border border-[#d7ccc8]">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Tren Kunjungan</h3>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Top Diagnosa Medis</h3>
              <Activity className="w-5 h-5 text-rose-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} width={80} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                    {diagnosisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
    'Update Diagnosa & Keterangan Dokter Siswa',
    'Verifikasi Akhir Perizinan Sakit',
    'Review Usulan Kesehatan dari Wali Asrama',
    'Statistik Kesehatan Siswa Terpadu',
    'Review Riwayat Perizinan Siswa',
    'Berbagi Catatan di Mading Sekolah'
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} font-sans transition-colors duration-500`}>
      {/* Sidebar Navigation */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed top-0 left-0 h-full w-72 bg-[#075e6e] text-white z-50 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar border-r border-white/10"
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
                      <nav className="space-y-1.5">
                        {[
                          { id: 'statistik', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'buat_surat', label: 'Buat SKD', icon: FileText },
                          { id: 'riwayat_skd', label: 'Riwayat Surat Kesehatan', icon: ClipboardList },
                          { id: 'kartu_siswa', label: 'Data Siswa', icon: User },
                          { id: 'usulan_cek', label: 'Usulan Cek Kesehatan', icon: ShieldCheck },
                          { id: 'memorandum', label: 'Memorandum Intern', icon: Mail },
                          { id: 'profil', label: 'Profil Saya', icon: User }
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setViewMode(item.id as any);
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
                      </nav>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Logout Section */}
              <div className="p-6 border-t border-white/10">
                <p className="text-[10px] font-black text-cyan-100/40 uppercase tracking-[0.2em] mb-4 px-2">TOKO & AKUN</p>
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

      <header className={`sticky top-0 z-30 ${isDarkMode ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-md border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-2.5 rounded-xl ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} transition-colors shadow-sm`}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">
               {viewMode === 'kartu_siswa' ? 'Database Siswa' :
               viewMode === 'usulan_cek' ? 'Usulan Cek Kesehatan' : 
               viewMode === 'statistik' ? 'Statistik Klinik' :
               viewMode === 'buat_surat' ? 'Buat Surat Keterangan' :
               viewMode === 'riwayat_skd' ? 'Riwayat Surat Kesehatan' :
               viewMode === 'mading' ? 'Mading Sekolah' :
               viewMode === 'memorandum' ? 'Memorandum Intern' : 'Profil Dokter'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-500'} transition-all`}
            >
              {isDarkMode ? <Activity className="w-5 h-5" /> : <Activity className="w-5 h-5 rotate-180" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'} relative transition-all`}
              >
                <Mail className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-80 ${isDarkMode ? 'bg-slate-900 ring-slate-800' : 'bg-white ring-slate-200'} rounded-[2rem] shadow-2xl ring-1 p-4 z-50`}
                  >
                    <div className="flex items-center justify-between mb-4 px-2">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pesan Masuk</h3>
                    </div>
                    <div className="space-y-2">
                      {notifications.map(n => (
                        <div key={n.id} className={`p-4 rounded-2xl ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} transition-all group cursor-pointer`}>
                          <h4 className="text-xs font-black uppercase tracking-tight">{n.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase leading-relaxed">{n.message}</p>
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

      {/* Top Banner / Announcement */}
      <AnimatePresence mode="wait">
        {showBanner && banners.length > 0 && banners[bannerIndex] && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 pt-6">
              <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-r ${banners[bannerIndex].color} p-6 text-white shadow-xl shadow-rose-200/20`}>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                      {React.createElement(banners[bannerIndex].icon, { className: "w-6 h-6" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80">{banners[bannerIndex].title}</h4>
                        <span className="px-2 py-0.5 bg-white/20 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">
                          {banners[bannerIndex].author}
                        </span>
                      </div>
                      <p className="text-sm font-bold leading-tight mt-1">{banners[bannerIndex].content}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors shrink-0"
                  >
                    <Info className="w-5 h-5 rotate-180" />
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

      <main className={`p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}

        {viewMode === 'buat_surat' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white rounded-[3.5rem] shadow-2xl shadow-indigo-100 border border-slate-100 overflow-hidden">
               <div className="p-10 border-b border-indigo-50 bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,1)_1px,transparent_0)] bg-[size:24px_24px]" />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="p-4 bg-white/20 backdrop-blur-xl rounded-3xl border border-white/30 shadow-xl">
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-white uppercase tracking-tight text-2xl">Penerbitan SKD Digital</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-3 py-0.5 bg-white/20 rounded-full text-[10px] text-white font-mono uppercase tracking-widest backdrop-blur-md border border-white/10">
                        {nomorSurat}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block relative z-10 text-right">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Sistem SRMA 24</p>
                  <p className="text-white font-bold text-sm">{format(new Date(), 'dd MMMM yyyy')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-10 md:p-14 space-y-12">
                {/* Student Info Section */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Informasi Pasien</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative group">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 transition-colors group-focus-within:text-indigo-600">Nama Lengkap Siswa</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-xl group-focus-within:bg-indigo-100 transition-colors">
                          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600" />
                        </div>
                        <input
                          type="text"
                          required
                          value={namaSiswa}
                          onChange={(e) => handleNamaSiswaChange(e.target.value)}
                          className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                          placeholder="Ketik nama siswa untuk mencari..."
                        />
                        <AnimatePresence>
                          {showSuggestions && filteredStudents.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute z-50 left-0 right-0 mt-4 bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden backdrop-blur-xl"
                            >
                              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ditemukan {filteredStudents.length} siswa</p>
                              </div>
                              {filteredStudents.map((student) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() => selectStudent(student)}
                                  className="w-full px-8 py-5 text-left hover:bg-indigo-50 flex items-center justify-between group/item transition-all"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center font-black text-indigo-600">
                                      {student.nama_lengkap.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-slate-900 group-hover/item:text-indigo-700">{student.nama_lengkap || 'Tanpa Nama'}</p>
                                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">{student.kelas}</p>
                                    </div>
                                  </div>
                                  <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover/item:bg-indigo-600 group-hover/item:border-indigo-600 transition-all">
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover/item:text-white" />
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 group-focus-within:text-indigo-600">Kelas</label>
                        <select
                          value={kelas}
                          onChange={(e) => setKelas(e.target.value)}
                          className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none appearance-none transition-all font-bold text-slate-700 shadow-inner"
                        >
                          {WALI_KELAS_LIST.map(wk => (
                            <option key={wk.kelas} value={wk.kelas}>{wk.kelas}</option>
                          ))}
                        </select>
                      </div>
                      <div className="group opacity-60">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Wali Kelas</label>
                        <div className="px-6 py-5 bg-slate-100 border-2 border-transparent rounded-[2rem] font-bold text-slate-500 shadow-inner flex items-center gap-2">
                          <User className="w-4 h-4 opacity-40" />
                          <span className="truncate">{waliKelas}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Section */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Hasil Pemeriksaan</h4>
                  </div>
                  
                  <div className="relative group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 group-focus-within:text-indigo-600">Diagnosa Medis & Keluhan</label>
                    <div className="relative">
                      <div className="absolute left-5 top-5 p-2 bg-slate-100 rounded-xl group-focus-within:bg-indigo-100 transition-colors">
                        <MessageSquare className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600" />
                      </div>
                      <textarea
                        required
                        value={diagnosa}
                        onChange={(e) => setDiagnosa(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2.5rem] focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner min-h-[160px] resize-none"
                        placeholder="Tuliskan hasil diagnosa dan keluhan pasien secara detail..."
                      />
                    </div>
                  </div>
                </div>

                {/* Recovery Period Section */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Masa Istirahat</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 group-focus-within:text-indigo-600">Durasi Istirahat (Hari)</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-xl group-focus-within:bg-indigo-100 transition-colors">
                          <Activity className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600" />
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
                          className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-widest">Hari</div>
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 group-focus-within:text-indigo-600">Tanggal Mulai Istirahat</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-xl group-focus-within:bg-indigo-100 transition-colors">
                          <Calendar className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600" />
                        </div>
                        <input
                          type="date"
                          required
                          value={tglMulai}
                          onChange={(e) => setTglMulai(e.target.value)}
                          className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full group/btn relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-blue-800 transition-transform duration-500 group-hover/btn:scale-105" />
                    <div className="relative py-6 px-10 flex items-center justify-center gap-4 text-white font-black uppercase tracking-[0.2em] text-sm">
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 transition-transform group-hover/btn:scale-110" />
                      )}
                      {loading ? 'Memproses Data...' : 'Terbitkan SKD & Kirim'}
                    </div>
                  </button>
                  <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">Data akan secara otomatis terkirim kepada Wali Kelas & Wali Asuh</p>
                </div>
              </form>
            </div>
            
            {/* Quick Stats / Tips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-indigo-50/50 p-8 rounded-[3rem] border border-indigo-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                  <Activity className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKD Bulan Ini</p>
                <p className="text-2xl font-black text-slate-900">{permits.filter(p => isThisMonth(p.tgl_surat?.toDate() || new Date())).length}</p>
              </div>
              <div className="bg-rose-50/50 p-8 rounded-[3rem] border border-rose-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                  <HeartPulse className="w-6 h-6 text-rose-600" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kesehatan Siswa</p>
                <p className="text-sm font-bold text-rose-700 uppercase tracking-tight">Pantau kondisi secara berkala</p>
              </div>
              <div className="bg-emerald-50/50 p-8 rounded-[3rem] border border-emerald-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Keamanan Data</p>
                <p className="text-sm font-bold text-emerald-700 uppercase tracking-tight">Integrasi Otomatis Wali Asuh</p>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'riwayat_skd' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between pb-4">
              <div>
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Riwayat Surat Kesehatan</h2>
                 <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-widest">Database Elektronik Klinik</p>
              </div>
              <button 
                onClick={() => setViewMode('buat_surat')}
                className="p-3 bg-[#075e6e] text-white rounded-2xl hover:bg-[#085a6a] shadow-lg transition-all"
                title="Buat SKD Baru"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
               <div className="relative group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input
                   type="text"
                   placeholder="Cari nama siswa atau nomor surat..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-[#075e6e] outline-none transition-all text-sm font-bold"
                 />
               </div>
            </div>

            <div className="space-y-4">
              {permits
                .filter(p => 
                  p.nama_siswa?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  p.nomor_surat?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((permit) => (
                <motion.div 
                  key={permit.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedPermit(permit)}
                  className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 hover:border-[#075e6e] transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${
                      permit.status === 'approved' ? 'bg-indigo-500' : 'bg-[#075e6e]'
                    }`} />
                    <div className="space-y-4 flex-1">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold text-slate-900 leading-tight">
                          SKD untuk {permit.nama_siswa} telah dibuat
                        </h3>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-slate-500 text-base leading-relaxed">
                          Dokter telah menerbitkan Surat Keterangan Sakit dengan nomor <span className="font-bold text-slate-900">#{permit.nomor_surat}</span> untuk diagnosa {permit.diagnosa || '-'}. 
                          Siswa disarankan istirahat selama {permit.jumlah_hari} hari.
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-slate-400 text-sm font-semibold tracking-tight">
                          {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' 
                            ? format(permit.tgl_surat.toDate(), 'dd MMMM yyyy, HH:mm') 
                            : format(new Date(), 'dd MMMM yyyy, HH:mm')
                          } WIB
                        </span>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGeneratePDF(permit);
                            }}
                            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-[#075e6e] hover:text-white transition-all shadow-sm"
                            title="Download PDF"
                          >
                            <Printer className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {permits.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada riwayat surat</p>
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
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Usulan Cek Kesehatan</h2>
                   <p className="text-[10px] font-medium text-slate-400 mt-0.5">Monitoring permohonan pemeriksaan dari asrama</p>
                </div>
                <div className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {proposals.filter(p => p.status === 'pending').length} Menunggu
                </div>
              </div>

              {/* FILTER HORIZONTAL */}
              <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {[
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: 'kemarin', label: 'Kemarin' },
                  { id: 'minggu_ini', label: 'Minggu Ini' },
                  { id: 'semua', label: 'Semua Riwayat' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setProposalTimeFilter(f.id as any)}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      proposalTimeFilter === f.id 
                        ? 'bg-[#075e6e] text-white shadow-lg' 
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                     className={`relative overflow-hidden bg-white p-6 rounded-[2.5rem] border ${proposal.status === 'processed' ? 'border-slate-100 opacity-75' : 'border-amber-100 shadow-xl shadow-amber-500/5'} space-y-4 group`}
                   >
                      {proposal.status === 'processed' && (
                        <div className="absolute top-4 right-4 text-emerald-500">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                         <div className={`p-3 rounded-2xl ${proposal.status === 'processed' ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-600'}`}>
                           <Activity className="w-6 h-6" />
                         </div>
                         <div>
                            <h4 className="font-black text-slate-900 uppercase text-xs">Asrama: {proposal.asrama || 'Utama'}</h4>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Diusulkan oleh: {proposal.proposer_name}</p>
                         </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Daftar Siswa (Klik nama untuk buat surat)</p>
                          <div className="flex flex-wrap gap-2">
                            {proposal.daftar_siswa.map((s, i) => (
                              <button 
                                key={i} 
                                onClick={() => handleProposalStudentClick(s)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-700 rounded-xl hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                              >
                                <User className="w-3 h-3 opacity-50" />
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {proposal.keterangan && (
                           <div className="px-4 py-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                             <p className="text-[10px] italic text-rose-700 leading-relaxed">"{proposal.keterangan}"</p>
                           </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">
                            {proposal.tgl_usulan && typeof proposal.tgl_usulan.toDate === 'function' 
                              ? format(proposal.tgl_usulan.toDate(), 'HH:mm, dd MMM') 
                              : '-'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleGenerateProposalPDF(proposal)}
                            disabled={pdfLoading === proposal.id}
                            className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-[#075e6e] hover:text-white transition-all shadow-sm disabled:opacity-50"
                            title="Cetak Usulan"
                          >
                            {pdfLoading === proposal.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </button>
                          {proposal.status === 'pending' && (
                            <button 
                              onClick={() => handleProcessProposal(proposal.id!)}
                              className="px-6 py-2.5 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                            >
                              Selesai
                            </button>
                          )}
                        </div>
                      </div>
                   </motion.div>
                ))}

                {proposals.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada usulan dalam kategori ini</p>
                  </div>
                )}
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

              {currentSelectedPermit.catatan_kamar && (
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
                  {currentSelectedPermit.tindakan && currentSelectedPermit.tindakan.length > 0 ? (
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
                    onClick={() => handleAddTindakan(currentSelectedPermit.id!)}
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
              {currentSelectedPermit.status === 'approved' && (
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
