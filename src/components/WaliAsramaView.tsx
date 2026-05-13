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
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, HealthCheckProposal, SarprasReport, Announcement, PinjamHP } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateHealthCheckProposalPDF, generateSarprasReportPDF, generateSarprasSummaryPDF, generatePinjamHPReportPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import WallView from './WallView';
import EvaluationNotesView from './EvaluationNotesView';
import DormitoryIncidentsView from './DormitoryIncidentsView';
import { motion, AnimatePresence } from 'motion/react';

interface WaliAsramaViewProps {
  user: AppUser;
  activeTab: string;
}

export default function WaliAsramaView({ user, activeTab }: WaliAsramaViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
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

  const defaultBanners = [
    {
      id: 'def-1',
      title: "Informasi Kesehatan",
      content: "Jaga kebersihan diri dan lingkungan asrama agar tetap sehat dan produktif.",
      color: "from-[#5d4037] to-[#8b5e3c]",
      icon: Info
    },
    {
      id: 'def-2',
      title: "Sistem Terpadu",
      content: "Data siswa kini terhubung dengan pangkalan data asrama secara real-time.",
      color: "from-[#8b5e3c] to-[#c0b298]",
      icon: BarChart3
    },
    {
      id: 'def-3',
      title: "Update Keamanan",
      content: "Selalu verifikasi izin keluar masuk siswa melalui panel konfirmasi resmi.",
      color: "from-[#075e6e] to-[#085a6a]",
      icon: Bell
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

  const [viewMode, setViewMode] = useState<'perizinan' | 'cek_kesehatan' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'sarpras' | 'agenda' | 'dinding' | 'catatan_evaluasi' | 'catatan_kejadian' | 'pinjam_hp'>('perizinan');
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Pinjam HP States
  const [pinjamHPList, setPinjamHPList] = useState<PinjamHP[]>([]);
  const [showPinjamForm, setShowPinjamForm] = useState(false);
  const [phNamaSiswa, setPhNamaSiswa] = useState('');
  const [phKelas, setPhKelas] = useState('');
  const [phKeperluan, setPhKeperluan] = useState('');
  const [phShowSuggestions, setPhShowSuggestions] = useState(false);
  const [phFilteredStudentsList, setPhFilteredStudentsList] = useState<Siswa[]>([]);
  const [selectedPinjam, setSelectedPinjam] = useState<PinjamHP | null>(null);

  // ... (keep Sarpras states as they are)
  const [sarprasReports, setSarprasReports] = useState<SarprasReport[]>([]);
  const [sarprasFilter, setSarprasFilter] = useState<'minggu_ini' | 'bulan_ini' | 'semua'>('minggu_ini');
  const [isAddingSarpras, setIsAddingSarpras] = useState(false);
  const [newSarpras, setNewSarpras] = useState({
    item_name: '',
    damage_description: '',
    location: '',
    asrama: ''
  });
  const [submittingSarpras, setSubmittingSarpras] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  
  // Health Check Proposal states
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [proposalNotes, setProposalNotes] = useState('');
  const [proposalHistory, setProposalHistory] = useState<HealthCheckProposal[]>([]);
  const [submittingProposal, setSubmittingProposal] = useState(false);

  const handleProcessProposal = async (id: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'health_check_proposals', id), {
        status: 'processed'
      });
      alert('Usulan telah ditandai selesai');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `health_check_proposals/${id}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Permits Watcher - Wali Asrama can see all permits but focus on their role
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
      where('penerima', 'array-contains', 'wali_asrama'),
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

  useEffect(() => {
    const q = query(
      collection(db, 'health_check_proposals'),
      where('proposer_uid', '==', user.uid),
      orderBy('tgl_usulan', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProposalHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthCheckProposal)));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'sarpras_reports'),
      orderBy('tgl_lapor', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSarprasReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SarprasReport)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sarpras_reports');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pinjam_hp'), orderBy('tgl_pinjam', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinjamHP));
      setPinjamHPList(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'pinjam_hp');
    });
    return () => unsubscribe();
  }, []);

  const handlePhNamaSiswaChange = (val: string) => {
    setPhNamaSiswa(val);
    if (val.length > 1) {
      const filtered = students.filter(s => 
        (s.nama_lengkap || '').toLowerCase().includes(val.toLowerCase())
      );
      setPhFilteredStudentsList(filtered);
      setPhShowSuggestions(true);
    } else {
      setPhShowSuggestions(false);
    }
  };

  const selectPhStudent = (student: Siswa) => {
    setPhNamaSiswa(student.nama_lengkap);
    setPhKelas(student.kelas);
    setPhShowSuggestions(false);
  };

  const handleSubmitPinjamHP = async () => {
    if (!phNamaSiswa || !phKelas || !phKeperluan) {
      alert('Mohon lengkapi data peminjaman');
      return;
    }

    setSubmittingProposal(true);
    try {
      await addDoc(collection(db, 'pinjam_hp'), {
        nama_siswa: phNamaSiswa,
        kelas: phKelas,
        keperluan: phKeperluan,
        tgl_pinjam: serverTimestamp(),
        status: 'dipinjam',
        wali_asuh_name: user.name,
        wali_asuh_uid: user.uid
      });

      setPhNamaSiswa('');
      setPhKelas('');
      setPhKeperluan('');
      setShowPinjamForm(false);
      alert('Peminjaman berhasil dicatat');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'pinjam_hp');
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleKembalikanHP = async (id: string) => {
    if (!confirm('Apakah HP sudah benar-benar dikembalikan?')) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'pinjam_hp', id), {
        status: 'dikembalikan',
        tgl_kembali: serverTimestamp(),
        penerima_kembali_name: user.name,
        penerima_kembali_uid: user.uid
      });
      alert('HP telah berhasil dikembalikan');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pinjam_hp/${id}`);
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

  const filteredPinjamHP = pinjamHPList
    .filter(item => {
      const pinjamDate = item.tgl_pinjam?.toDate();
      
      let matchesTime = item.status === 'dipinjam' || timeFilter === 'semua';
      
      if (!matchesTime && pinjamDate) {
        if (timeFilter === 'hari_ini') matchesTime = isToday(pinjamDate);
        else if (timeFilter === 'kemarin') matchesTime = isYesterday(pinjamDate);
        else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(pinjamDate, { weekStartsOn: 1 });
        else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(pinjamDate);
      }

      const matchesSearch = !searchTerm || item.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch && matchesTime;
    })
    .sort((a, b) => {
      if (a.status === 'dipinjam' && b.status !== 'dipinjam') return -1;
      if (a.status !== 'dipinjam' && b.status === 'dipinjam') return 1;
      const dateA = a.tgl_pinjam?.toDate()?.getTime() || 0;
      const dateB = b.tgl_pinjam?.toDate()?.getTime() || 0;
      return dateB - dateA;
    });

  const handleSubmitProposal = async () => {
    if (selectedStudents.length === 0) {
      alert('Pilih setidaknya satu siswa');
      return;
    }
    setSubmittingProposal(true);
    try {
      await addDoc(collection(db, 'health_check_proposals'), {
        proposer_name: user.name,
        proposer_uid: user.uid,
        asrama: 'Asrama', // Should ideally come from user profile if available
        tgl_usulan: serverTimestamp(),
        daftar_siswa: selectedStudents,
        status: 'pending',
        keterangan: proposalNotes
      });

      notifyAllRoles(['dokter'], 'Usulan Cek Kesehatan Baru', `Wali Asrama ${user.name} mengusulkan pengecekan kesehatan untuk ${selectedStudents.length} siswa.`);
      
      setSelectedStudents([]);
      setProposalNotes('');
      alert('Usulan berhasil dikirim ke Dokter');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'health_check_proposals');
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleSubmitSarpras = async () => {
    if (!newSarpras.item_name || !newSarpras.damage_description || !newSarpras.location || !newSarpras.asrama) {
      alert('Mohon lengkapi semua data laporan');
      return;
    }
    setSubmittingSarpras(true);
    try {
      await addDoc(collection(db, 'sarpras_reports'), {
        ...newSarpras,
        author_name: user.name,
        author_uid: user.uid,
        tgl_lapor: serverTimestamp(),
        status: 'pending'
      });

      notifyAllRoles(['kepala_sekolah', 'wali_asuh'], 'Laporan Kerusakan Sarpras Baru', `Wali Asrama ${user.name} melaporkan adanya kerusakan sarana & prasarana.`);
      
      setNewSarpras({
        item_name: '',
        damage_description: '',
        location: '',
        asrama: ''
      });
      setIsAddingSarpras(false);
      alert('Laporan berhasil dikirim');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sarpras_reports');
    } finally {
      setSubmittingSarpras(false);
    }
  };

  const toggleStudentSelection = (name: string) => {
    setSelectedStudents(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const filteredStudents = students.filter(s => {
    const name = s.nama_lengkap || '';
    const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase());
    const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).sort()];

  const viewTitles: Record<string, string> = {
    perizinan: 'Riwayat Perizinan',
    cek_kesehatan: 'Usulan Cek Kesehatan',
    memorandum: 'Memorandum',
    pangkalan_data: 'Pangkalan Data Wali Asuh',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    agenda: 'Agenda Kegiatan',
    dinding: 'Dinding Wali Asrama',
    sarpras: 'Sarana & Prasarana',
    pinjam_hp: 'Pinjam Smartphone',
    catatan_evaluasi: 'Catatan Evaluasi',
    catatan_kejadian: 'Catatan Kejadian di Asrama'
  };

  const navItems = [
    { id: 'perizinan', label: 'Perizinan', icon: ClipboardList },
    { id: 'cek_kesehatan', label: 'Usulan Cek', icon: Activity },
    { id: 'catatan_evaluasi', label: 'Evaluasi', icon: ClipboardList },
    { id: 'pangkalan_data', label: 'Pangkalan Data', icon: Tablet },
    { id: 'memorandum', label: 'Memorandum', icon: Mail },
    { id: 'profil', label: 'Profil Saya', icon: User }
  ];

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
    'Monitoring Kehadiran & Kepulangan Siswa',
    'Review Riwayat Perizinan Siswa',
    'Review & Verifikasi Memorandum',
    'Pengajuan Usulan Cek Kesehatan (Cek-UP)',
    'Pangkalan Data Siswa Terpadu',
    'Berbagi Catatan di Mading Sekolah'
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#1a0f0d]' : 'bg-[#fcf8f5] text-[#2d1e1a]'} font-sans antialiased selection:bg-[#8b5e3c]/20`}>
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
              className={`fixed inset-y-0 left-0 w-[280px] z-[70] shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#2d1e1a] border-white/5' : 'bg-[#3e2723] text-white'}`}
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  <div className={`rounded-3xl p-5 mb-8 border border-white/10 relative overflow-hidden group ${isDarkMode ? 'bg-white/5' : 'bg-black/20'}`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight">SRMA 24 KEDIRI</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-70 ${isDarkMode ? 'text-amber-200' : 'text-[#d7ccc8]'}`}>SEKOLAH RAKYAT</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 ${isDarkMode ? 'text-amber-200/40' : 'text-[#d7ccc8]/40'}`}>HOME</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'perizinan', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'agenda', label: 'Agenda Kegiatan', icon: Calendar },
                          { id: 'dinding', label: 'Dinding Wali Asrama', icon: MessageSquare },
                          { id: 'catatan_evaluasi', label: 'Catatan Evaluasi', icon: ClipboardList },
                          { id: 'catatan_kejadian', label: 'Kejadian Asrama', icon: AlertTriangle },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'cek_kesehatan', label: 'Usulan Cek Kesehatan', icon: Activity },
                          { id: 'pinjam_hp', label: 'Pinjam Smartphone', icon: Tablet },
                          { id: 'sarpras', label: 'Sarana & Prasarana', icon: Wrench },
                          { id: 'pangkalan_data', label: 'Pangkalan Data', icon: Database },
                          { id: 'memorandum', label: 'Memorandum', icon: Mail },
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
                                ? 'bg-white text-[#3e2723] shadow-xl shadow-black/10' 
                                : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white text-white'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-[#3e2723]' : 'text-white/40'}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-[#2d1e1a]/90 border-white/5' : 'bg-[#f8f3ed]/90 border-[#d7ccc8]/40'} backdrop-blur-xl border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-3 rounded-2xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-white/5 text-amber-200 hover:bg-white/10 shadow-lg shadow-black/20' 
                  : 'bg-[#8b5e3c]/10 text-[#5d4037] hover:bg-[#8b5e3c]/20 shadow-sm'
              } active:scale-95`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-200' : 'text-[#3e2723]'}`}>
              {viewTitles[viewMode] || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-500'} transition-all`}
            >
              {isDarkMode ? <Activity className="w-5 h-5" /> : <Activity className="w-5 h-5 rotate-180" />}
            </button>
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
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${banners[bannerIndex].color.includes('rose') ? 'from-[#5d4037] to-[#8b5e3c]' : 'from-[#8b5e3c] to-[#c0b298]'} p-4 text-white shadow-lg shadow-black/10`}>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
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

      {/* Shrunken Real-time Clock Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 mt-3">
        <div className="p-[1px] rounded-xl bg-gradient-to-r from-[#d7ccc8]/40 via-[#8b5e3c]/40 to-[#d7ccc8]/40">
          <div className="flex items-center justify-center gap-2 py-1.5 px-4 rounded-[calc(0.75rem-1px)] bg-white/80 backdrop-blur-sm">
            <span className="w-1 h-1 bg-[#8b5e3c] rounded-full animate-ping" />
            <p className="text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1 text-[#5d4037] italic">
              {formatRealTime(currentTime)}
            </p>
            <span className="w-1 h-1 bg-[#8b5e3c] rounded-full animate-ping" />
          </div>
        </div>
      </div>

      <main className={`p-6 ${viewMode === 'mading' || viewMode === 'dinding' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'agenda' && <AgendaView user={user} />}
        {viewMode === 'dinding' && <WallView user={user} wallType="asrama" title="Dinding Wali Asrama" />}
        {viewMode === 'catatan_evaluasi' && <EvaluationNotesView user={user} />}
        {viewMode === 'catatan_kejadian' && <DormitoryIncidentsView user={user} />}

        {viewMode === 'pinjam_hp' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Style similar to Catatan Kejadian */}
            <div className="bg-[#3e2723] rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-[#5d4037] relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
                    <Tablet className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black font-display tracking-tight leading-none italic">Pinjam Smartphone</h1>
                      <span className="bg-[#d7ccc8]/20 text-[#d7ccc8] px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-[#d7ccc8]/20">
                        MONITORING
                      </span>
                    </div>
                    <p className="text-stone-400 text-[10px] font-semibold mt-1 uppercase tracking-widest italic">
                      Log Penggunaan Gadget Siswa
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex bg-[#5d4037] p-1 rounded-2xl border border-[#3e2723] mr-2">
                    <button 
                      onClick={() => generatePinjamHPReportPDF(pinjamHPList, 'minggu', user.name)}
                      className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        <Printer className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-black uppercase tracking-tighter italic">Minggu</span>
                      </div>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                    <button 
                      onClick={() => generatePinjamHPReportPDF(pinjamHPList, 'bulan', user.name)}
                      className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        <Printer className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-black uppercase tracking-tighter italic">Bulan</span>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPinjamForm(!showPinjamForm)}
                    className={`group px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                      showPinjamForm 
                      ? 'bg-[#5d4037] text-stone-300 hover:bg-[#3e2723]' 
                      : 'bg-[#3e2723] text-white hover:bg-black shadow-black/20 border border-[#d7ccc8]/20'
                    }`}
                  >
                    {showPinjamForm ? 'Batal' : (
                      <>
                        <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                        Pinjam Baru
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showPinjamForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#f8f3ed] rounded-[2rem] p-6 lg:p-8 shadow-xl border border-[#d7ccc8]/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="relative">
                        <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Nama Siswa</label>
                        <div className="relative">
                           <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3e2723]/40" />
                           <input 
                             type="text" 
                             value={phNamaSiswa}
                             onChange={(e) => handlePhNamaSiswaChange(e.target.value)}
                             onFocus={() => phNamaSiswa.length > 1 && setPhShowSuggestions(true)}
                             placeholder="Masukkan nama siswa..."
                             className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl pl-12 pr-4 py-3.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-sm"
                           />
                        </div>
                        {phShowSuggestions && phFilteredStudentsList.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#d7ccc8]/30 overflow-hidden">
                            {phFilteredStudentsList.slice(0, 5).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => selectPhStudent(s)}
                                className="w-full px-4 py-3 text-left hover:bg-[#f8f3ed] transition-colors border-b border-[#d7ccc8]/10 last:border-0 flex items-center justify-between group"
                              >
                                <div>
                                  <p className="text-sm font-black text-[#3e2723] italic">{s.nama_lengkap}</p>
                                  <p className="text-[10px] font-bold text-[#3e2723]/40 uppercase tracking-widest">{s.kelas}</p>
                                </div>
                                <Plus className="w-4 h-4 text-[#3e2723]/20 group-hover:text-[#3e2723] transition-colors" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Kelas</label>
                        <input 
                          type="text" 
                          value={phKelas}
                          readOnly
                          className="w-full bg-[#f8f3ed] border-2 border-[#d7ccc8]/30 rounded-2xl px-5 py-3.5 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Keperluan Peminjaman</label>
                        <textarea 
                          value={phKeperluan}
                          onChange={(e) => setPhKeperluan(e.target.value)}
                          placeholder="Misal: Menghubungi orang tua, Pekerjaan rumah, dsb..."
                          className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl px-5 py-4 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] min-h-[100px] placeholder:text-stone-300 text-sm"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <button
                          onClick={handleSubmitPinjamHP}
                          disabled={loading}
                          className="w-full bg-[#3e2723] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-xs italic"
                        >
                          Simpan Peminjaman
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#3e2723] uppercase tracking-widest px-2 italic">Riwayat Peminjaman</h3>
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {pinjamHPList.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`bg-white rounded-3xl p-5 shadow-sm border border-[#d7ccc8]/20 hover:shadow-md transition-all group relative cursor-pointer ${
                        item.status === 'dipinjam' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500'
                      }`}
                      onClick={() => setSelectedPinjam(item)}
                    >
                      <div className="flex gap-4">
                        {/* Date Block */}
                        <div className="w-20 shrink-0 flex flex-col gap-2">
                          <div className="bg-[#f8f3ed] rounded-2xl p-2 border border-[#d7ccc8]/30 text-center">
                            <div className="text-[16px] font-black text-[#3e2723] leading-none mb-0.5">
                              {format(item.tgl_pinjam.toDate(), 'dd', { locale: id })}
                            </div>
                            <div className="text-[8px] font-black text-[#3e2723]/40 uppercase tracking-tighter italic">
                              {format(item.tgl_pinjam.toDate(), 'MMM yy', { locale: id })}
                            </div>
                          </div>
                          <div className="bg-[#3e2723]/5 rounded-2xl p-2 border border-[#3e2723]/10 text-center">
                            <Clock className="w-3 h-3 text-[#3e2723]/40 mx-auto mb-0.5" />
                            <div className="text-[9px] font-black text-[#3e2723] uppercase tracking-tighter">
                              {format(item.tgl_pinjam.toDate(), 'HH:mm')}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="text-sm font-black text-[#3e2723] italic tracking-tight">{item.nama_siswa}</h4>
                              <p className="text-[10px] font-bold text-[#3e2723]/40 uppercase tracking-widest">{item.kelas}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              item.status === 'dipinjam' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#3e2723]/70 italic line-clamp-2">{item.keperluan}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pinjamHPList.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-[#d7ccc8]">
                    <Tablet className="w-12 h-12 text-[#d7ccc8] mx-auto mb-4" />
                    <p className="text-[#3e2723]/40 font-bold uppercase tracking-widest text-xs">Belum ada riwayat peminjaman</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'perizinan' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#075e6e] to-[#0a8ea4] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <h1 className="text-3xl font-black font-display tracking-tight mb-2">Hallo, {user.name || user.email}</h1>
                <p className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
                  <ShieldCheck className="w-5 h-5" />
                  {getRoleLabel(user.role || 'wali_asrama')}
                </p>
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-50 mb-4 flex items-center gap-2">
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
                        className="flex items-center gap-3 text-sm font-semibold text-white/95"
                      >
                        <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                        {f}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
               <Search className="w-5 h-5 text-slate-400 ml-2" />
               <input 
                 type="text" 
                 placeholder="Cari nama siswa atau no surat..."
                 className="bg-transparent border-none outline-none text-sm font-medium w-full p-2"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    timeFilter === filter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
                <AnimatePresence>
                  {filteredPermits.map(permit => (
                    <motion.div
                      key={permit.id}
                      layout
                      className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                    >
                      <div className="flex items-center justify-between" onClick={() => setSelectedPermit(permit)}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${
                            permit.tipe === 'sakit' ? 'bg-rose-50 text-rose-600' : 
                            permit.tipe === 'umum' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {permit.tipe === 'sakit' ? <Activity className="w-5 h-5" /> : 
                             permit.tipe === 'umum' ? <Calendar className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight">{permit.nama_siswa}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{permit.kelas} • {permit.nomor_surat}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            permit.status === 'approved' || permit.status === 'acknowledged' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {permit.status}
                          </div>
                          {permit.tipe === 'sakit' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                generatePermitPDF(permit);
                              }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Cetak Surat Sakit"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
            {filteredPermits.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada riwayat ditemukan</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'cek_kesehatan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-black text-slate-900 font-display">Usulan Baru</h3>
               <div className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                 {selectedStudents.length} Siswa Terpilih
               </div>
            </div>

            <div className="space-y-4">
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
                      selectedClass === c
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredStudents.map(student => (
                  <div 
                    key={student.id}
                    onClick={() => toggleStudentSelection(student.nama_lengkap)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      selectedStudents.includes(student.nama_lengkap)
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${selectedStudents.includes(student.nama_lengkap) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {student.nama_lengkap.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{student.kelas}</p>
                      </div>
                    </div>
                    {selectedStudents.includes(student.nama_lengkap) ? (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan Tambahan (Opsional)</label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium min-h-[100px]"
                  placeholder="Misal: Siswa mengeluh pusing sejak pagi..."
                />
              </div>

              <button
                onClick={handleSubmitProposal}
                disabled={submittingProposal || selectedStudents.length === 0}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingProposal ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rotate-45" />}
                KIRIM USULAN KE DOKTER
              </button>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Riwayat Usulan Anda</h3>
                <AnimatePresence>
                  {proposalHistory.map(prop => (
                    <div key={prop.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                              <Activity className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {prop.tgl_usulan && typeof prop.tgl_usulan.toDate === 'function' ? format(prop.tgl_usulan.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                              </p>
                              <h4 className="font-bold text-slate-900">{prop.daftar_siswa.length} Siswa diusulkan</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             {prop.status === 'pending' && (
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleProcessProposal(prop.id!);
                                 }}
                                 disabled={loading}
                                 className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                               >
                                 <CheckCircle2 className="w-3.5 h-3.5" /> {loading ? '...' : 'Selesai'}
                               </button>
                             )}
                            <button
                              onClick={() => generateHealthCheckProposalPDF(prop)}
                              className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak
                            </button>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              prop.status === 'processed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {prop.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {prop.daftar_siswa.join(', ')}
                        </p>
                        {prop.keterangan && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex gap-2">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <p className="text-[10px] text-slate-500 font-bold">{prop.keterangan}</p>
                          </div>
                        )}
                    </div>
                  ))}
                </AnimatePresence>
             {proposalHistory.length === 0 && (
               <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                 <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada riwayat usulan</p>
               </div>
             )}
          </div>
        </div>
      )}

      {viewMode === 'pangkalan_data' && (
        <div className="h-[calc(100vh-180px)] w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/60 animate-in fade-in zoom-in-95 duration-500">
           <iframe 
             src="https://app.box.com/s/3ogn8xtw84he8uxb1yfnvum9mgwpc7db"
             className="w-full h-full border-none"
             title="Pangkalan Data Wali Asuh"
             allow="autoplay; fullscreen"
           />
        </div>
      )}

      {viewMode === 'sarpras' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h3 className="text-lg font-black text-slate-900 font-display">Laporan Sarana & Prasarana</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Kelola dan Rekap Laporan Kerusakan</p>
               </div>
               <div className="flex items-center gap-2">
                 <select 
                   value={sarprasFilter}
                   onChange={(e) => setSarprasFilter(e.target.value as any)}
                   className="px-4 py-2.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-display"
                 >
                   <option value="minggu_ini">Minggu Ini</option>
                   <option value="bulan_ini">Bulan Ini</option>
                   <option value="semua">Semua Laporan</option>
                 </select>
                 <button
                   onClick={() => {
                     const filtered = sarprasReports.filter(r => {
                       const date = r.tgl_lapor?.toDate();
                       if (!date) return false;
                       if (sarprasFilter === 'minggu_ini') return isThisWeek(date);
                       if (sarprasFilter === 'bulan_ini') return isThisMonth(date);
                       return true;
                     });
                     generateSarprasSummaryPDF(filtered, sarprasFilter, { name: user.name, role: user.role });
                   }}
                   className="px-6 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                 >
                   <Printer className="w-3.5 h-3.5" />
                   Rekap Laporan
                 </button>
                 <button 
                   onClick={() => setIsAddingSarpras(!isAddingSarpras)}
                   className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                     isAddingSarpras ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                   }`}
                 >
                   {isAddingSarpras ? 'Batal' : 'Laporan Baru'}
                 </button>
               </div>
            </div>

            {isAddingSarpras && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Barang / Sarana</label>
                    <input
                      type="text"
                      value={newSarpras.item_name}
                      onChange={(e) => setNewSarpras({...newSarpras, item_name: e.target.value})}
                      placeholder="Contoh: AC Kamar, Pintu Kamar Mandi, dsb"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lokasi Detail</label>
                    <input
                      type="text"
                      value={newSarpras.location}
                      onChange={(e) => setNewSarpras({...newSarpras, location: e.target.value})}
                      placeholder="Contoh: Kamar 10, Lobby Lt.2, dsb"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Asrama</label>
                    <select
                      value={newSarpras.asrama}
                      onChange={(e) => setNewSarpras({...newSarpras, asrama: e.target.value})}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    >
                      <option value="">Pilih Asrama</option>
                      <option value="Asrama Putra">Asrama Putra</option>
                      <option value="Asrama Putri">Asrama Putri</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Deskripsi Kerusakan</label>
                    <textarea
                      value={newSarpras.damage_description}
                      onChange={(e) => setNewSarpras({...newSarpras, damage_description: e.target.value})}
                      placeholder="Jelaskan detail kerusakan yang terjadi..."
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm h-[115px]"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={handleSubmitSarpras}
                    disabled={submittingSarpras}
                    className="w-full py-5 bg-[#075e6e] text-white font-black rounded-2xl shadow-xl shadow-cyan-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submittingSarpras ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rotate-45" />}
                    KIRIM LAPORAN KERUSAKAN
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Riwayat Laporan Sarpras</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sarprasReports.map((report) => (
                  <div key={report.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4 relative group hover:bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-500">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className={`p-3 rounded-2xl ${
                          report.status === 'fixed' ? 'bg-emerald-50 text-emerald-600' :
                          report.status === 'on_progress' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? format(report.tgl_lapor.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                          </p>
                          <h4 className="font-bold text-slate-900">{report.item_name}</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{report.location} • {report.asrama}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateSarprasReportPDF(report)}
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                          title="Cetak Laporan"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          report.status === 'fixed' ? 'bg-emerald-100 text-emerald-700' :
                          report.status === 'on_progress' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 flex gap-3">
                       <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                       <p className="text-xs text-slate-600 leading-relaxed font-bold italic line-clamp-2">
                         "{report.damage_description}"
                       </p>
                    </div>
                  </div>
                ))}
              </div>
              {sarprasReports.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada laporan kerusakan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'memorandum' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 gap-4">
            {memos.map(memo => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.01, x: 4 }}
                onClick={() => setSelectedMemo(memo)}
                className="group flex items-center gap-5 p-5 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-[#075e6e] transition-all cursor-pointer"
              >
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center shrink-0 group-hover:bg-[#075e6e] group-hover:text-white transition-colors border border-slate-100">
                  <Mail className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate font-display italic">{memo.perihal}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari: {memo.pengirim_name}</span>
                    <span className="text-slate-200">•</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                      {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-[#075e6e] transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] italic">Belum ada memorandum masuk</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>

      {selectedPinjam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#f8f3ed] bg-[#3e2723] flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#d7ccc8] rounded-xl">
                  <Smartphone className="w-5 h-5 text-[#3e2723]" />
                </div>
                <div>
                  <h3 className="font-black italic uppercase tracking-tight text-sm">Detail Peminjaman</h3>
                  <p className="text-[9px] text-[#d7ccc8] font-black uppercase tracking-[0.2em]">{selectedPinjam.nama_siswa}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPinjam(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#d7ccc8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="bg-[#f8f3ed] p-5 rounded-2xl border border-[#d7ccc8]/30">
                  <label className="text-[9px] font-black text-[#5d4037]/40 uppercase tracking-widest block mb-2 italic">Keperluan Penggunaan</label>
                  <p className="text-sm font-bold text-[#3e2723] italic leading-relaxed">"{selectedPinjam.keperluan}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-[#d7ccc8]/30 shadow-sm">
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Pinjam</label>
                    <p className="text-[11px] font-black text-[#3e2723] leading-none mb-1">
                      {selectedPinjam.tgl_pinjam && typeof selectedPinjam.tgl_pinjam.toDate === 'function' ? format(selectedPinjam.tgl_pinjam.toDate(), 'HH:mm - dd MMM') : '-'}
                    </p>
                    <p className="text-[7px] font-black text-stone-400 uppercase tracking-tighter truncate">Oleh: {selectedPinjam.wali_asuh_name}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border transition-all ${selectedPinjam.status === 'dikembalikan' ? 'bg-[#fdfcf0] border-emerald-100' : 'bg-stone-50 border-stone-100 opacity-60'}`}>
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Kembali</label>
                    <p className="text-[11px] font-black text-[#3e2723] leading-none mb-1">
                      {selectedPinjam.tgl_kembali && typeof selectedPinjam.tgl_kembali.toDate === 'function' ? format(selectedPinjam.tgl_kembali.toDate(), 'HH:mm - dd MMM') : '--:--'}
                    </p>
                    <p className="text-[7px] font-black text-stone-400 uppercase tracking-tighter truncate">Oleh: {selectedPinjam.penerima_kembali_name || '-'}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Status Saat Ini:</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                    selectedPinjam.status === 'dipinjam' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedPinjam.status === 'dipinjam' ? 'SEDANG DIPINJAM' : 'TELAH KEMBALI'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#f8f3ed] border-t border-[#d7ccc8]/30 flex gap-3">
              <button
                onClick={() => setSelectedPinjam(null)}
                className="flex-1 py-3 bg-white border border-[#d7ccc8]/30 text-[#3e2723]/60 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#ede8dd] transition-all shadow-sm"
              >
                Tutup Jendela
              </button>
              {selectedPinjam.status === 'dipinjam' && (
                <button
                  onClick={(e) => {
                    handleKembalikanHP(selectedPinjam.id!);
                    setSelectedPinjam(null);
                  }}
                  className="flex-1 py-3 bg-[#3e2723] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black shadow-xl shadow-black/10 transition-all italic"
                >
                  Confirm Kembali
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Izin (View Only) */}
      <AnimatePresence>
        {selectedPermit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedPermit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600' : 
                    selectedPermit.tipe === 'umum' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {selectedPermit.tipe === 'sakit' ? <Activity className="w-5 h-5" /> : 
                     selectedPermit.tipe === 'umum' ? <Calendar className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">Detail Izin</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{selectedPermit.nomor_surat}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPermit(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</label>
                    <p className="font-black text-slate-900">{selectedPermit.nama_siswa}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                    <p className="font-black text-slate-900">{selectedPermit.kelas}</p>
                  </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {selectedPermit.tipe === 'sakit' ? 'Diagnosa' : 'Alasan'}
                   </label>
                   <p className="text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     {selectedPermit.tipe === 'sakit' ? selectedPermit.diagnosa : (selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.isi_catatan)}
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {selectedPermit.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                    <p className="text-[10px] font-bold text-slate-500">
                      {selectedPermit.tgl_surat && typeof selectedPermit.tgl_surat.toDate === 'function' ? format(selectedPermit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riwayat Tindakan</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                      selectedPermit.tindakan.map((t, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[9px] font-black text-indigo-600 uppercase">{t.oleh} ({t.peran})</span>
                          </div>
                          <p className="text-[11px] text-slate-700 font-medium">{t.pesan}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Belum ada tindakan tercatat</p>
                    )}
                  </div>
                </div>
              </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => setSelectedPermit(null)}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-[10px]"
                  >
                    Tutup
                  </button>
                  {(selectedPermit.tipe === 'sakit' || selectedPermit.tipe === 'umum' || selectedPermit.tipe === 'catatan') && (
                    <button
                      onClick={() => generatePermitPDF(selectedPermit)}
                      className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </button>
                  )}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 bg-[#075e6e] text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tight uppercase">Memorandum Intern</h3>
                    <p className="text-[10px] font-bold text-cyan-100/60 tracking-widest">{selectedMemo.nomor_memo}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMemo(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pengirim</label>
                    <p className="font-black text-slate-900 text-lg">{selectedMemo.pengirim_name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</label>
                    <p className="font-bold text-slate-600">
                      {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'EEEE, dd MMM yyyy') : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Perihal</label>
                  <p className="text-xl font-black text-[#075e6e] font-display italic">
                    {selectedMemo.perihal}
                  </p>
                </div>

                <div className="space-y-3 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Isi Instruksi</label>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMemo.isi}
                  </p>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => setSelectedMemo(null)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                >
                  Selesai Membaca
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Detail Pinjam HP */}
      <AnimatePresence>
        {selectedPinjam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#d7ccc8]/30"
            >
              <div className="p-6 border-b border-[#d7ccc8]/20 bg-[#f8f3ed] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#3e2723] rounded-xl">
                    <Tablet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#3e2723] uppercase tracking-tight italic">Detail Peminjaman</h3>
                    <p className="text-[9px] text-[#3e2723]/40 font-bold uppercase">Log Aktivitas Gadget</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPinjam(null)} className="p-2 hover:bg-[#d7ccc8]/20 rounded-full transition-colors text-[#3e2723]/40">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Siswa</label>
                    <p className="font-black text-[#3e2723] text-lg">{selectedPinjam.nama_siswa}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Kelas</label>
                    <p className="font-black text-[#3e2723] text-lg">{selectedPinjam.kelas}</p>
                  </div>
                </div>

                <div className="bg-[#f8f3ed] p-5 rounded-2xl border border-[#d7ccc8]/30">
                  <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-2 block italic">Keperluan Peminjaman:</label>
                  <p className="text-sm font-bold text-[#3e2723] italic leading-relaxed">
                    {selectedPinjam.keperluan}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#d7ccc8]/10">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Waktu Pinjam</label>
                    <p className="text-xs font-black text-stone-600">
                      {format(selectedPinjam.tgl_pinjam.toDate(), 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Waktu Kembali</label>
                    <p className="text-xs font-black text-stone-600">
                      {selectedPinjam.tgl_kembali 
                        ? format(selectedPinjam.tgl_kembali.toDate(), 'dd MMM yyyy, HH:mm') 
                        : 'Belum dikembalikan'}
                    </p>
                  </div>
                </div>

                {selectedPinjam.status === 'dikembalikan' && (
                  <div className="pt-4 border-t border-[#d7ccc8]/10">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">
                         Diterima Oleh: {selectedPinjam.penerima_kembali_name}
                       </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#f8f3ed] border-t border-[#d7ccc8]/20 flex gap-3">
                <button
                  onClick={() => setSelectedPinjam(null)}
                  className="flex-1 py-4 bg-white border border-[#d7ccc8]/30 text-[#3e2723] font-black rounded-2xl hover:bg-[#d7ccc8]/10 transition-all uppercase tracking-widest text-[10px] italic shadow-sm"
                >
                  Tutup
                </button>
                {selectedPinjam.status === 'dipinjam' && (
                  <button
                    onClick={() => {
                      handleKembalikanHP(selectedPinjam.id!);
                      setSelectedPinjam(null);
                    }}
                    className="flex-1 py-4 bg-[#3e2723] text-white font-black rounded-2xl hover:bg-black shadow-xl shadow-black/10 transition-all uppercase tracking-widest text-[10px] italic"
                  >
                    Konfirmasi Kembali
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
