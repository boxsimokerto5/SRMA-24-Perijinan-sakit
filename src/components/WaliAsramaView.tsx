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
  ClipboardCheck
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, Memorandum, Siswa, normalizeKelas, HealthCheckProposal, SarprasReport, Announcement, PinjamHP, Ketidakhadiran, parseFirestoreDate } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { generatePermitPDF, generateHealthCheckProposalPDF, generateSarprasReportPDF, generateSarprasSummaryPDF, generatePinjamHPReportPDF, generateMemorandumPDF, generateSummaryReportPDF, generateKetidakhadiranPDF, generateKetidakhadiranReportPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import AgendaView from './AgendaView';
import WallView from './WallView';
import EvaluationNotesView from './EvaluationNotesView';
import DormitoryIncidentsView from './DormitoryIncidentsView';
import JurnalKeperawatanView from './JurnalKeperawatanView';
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
  const [reportLoading, setReportLoading] = useState(false);

  // Ketidakhadiran states
  const [ketidakhadiranData, setKetidakhadiranData] = useState<Ketidakhadiran[]>([]);
  const [khTimeFilter, setKhTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');
  const [showKetidakhadiranForm, setShowKetidakhadiranForm] = useState(false);
  const [khKegiatan, setKhKegiatan] = useState('');
  const [khKelas, setKhKelas] = useState('X-1');
  const [khSelectedSiswa, setKhSelectedSiswa] = useState<string[]>([]);
  const [khDeskripsi, setKhDeskripsi] = useState('');
  const [khSearchSiswaFilter, setKhSearchSiswaFilter] = useState('');
  const [khPdfLoading, setKhPdfLoading] = useState<string | null>(null);

  const filteredKetidakhadiran = React.useMemo(() => {
    return ketidakhadiranData.filter(rec => {
      const date = parseFirestoreDate(rec.tgl_absen);

      let matchesTime = true;
      if (khTimeFilter === 'hari_ini') matchesTime = date ? isToday(date) : false;
      else if (khTimeFilter === 'kemarin') matchesTime = date ? isYesterday(date) : false;
      else if (khTimeFilter === 'minggu_ini') matchesTime = date ? isThisWeek(date, { weekStartsOn: 1 }) : false;
      else if (khTimeFilter === 'bulan_ini') matchesTime = date ? isThisMonth(date) : false;

      const matchesSearch = !searchTerm || 
        rec.keterangan_kegiatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.daftar_siswa.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        rec.deskripsi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.author_name.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTime && matchesSearch;
    });
  }, [ketidakhadiranData, khTimeFilter, searchTerm]);

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
      color: "from-slate-900 to-slate-950",
      icon: Info
    },
    {
      id: 'def-2',
      title: "Sistem Terpadu",
      content: "Data siswa kini terhubung dengan pangkalan data asrama secara real-time.",
      color: "from-cyan-600 to-teal-700",
      icon: BarChart3
    },
    {
      id: 'def-3',
      title: "Update Keamanan",
      content: "Selalu verifikasi izin keluar masuk siswa melalui panel konfirmasi resmi.",
      color: "from-slate-800 to-cyan-900",
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

  const [viewMode, setViewMode] = useState<'perizinan' | 'cek_kesehatan' | 'memorandum' | 'pangkalan_data' | 'profil' | 'mading' | 'sarpras' | 'agenda' | 'dinding' | 'catatan_evaluasi' | 'catatan_kejadian' | 'pinjam_hp' | 'cek_ketidakhadiran' | 'jurnal_keperawatan'>('perizinan');
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
  const [hpStatusFilter, setHpStatusFilter] = useState<'semua' | 'dipinjam' | 'dikembalikan'>('dipinjam');
  const [hpTimeFilter, setHpTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');

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
  const [selectedSarprasForTindakan, setSelectedSarprasForTindakan] = useState<SarprasReport | null>(null);
  const [tindakanStatus, setTindakanStatus] = useState<'pending' | 'on_progress' | 'fixed'>('on_progress');
  const [tindakanKeterangan, setTindakanKeterangan] = useState('');
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
  const [selectedProposal, setSelectedProposal] = useState<HealthCheckProposal | null>(null);

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

  React.useEffect(() => {
    const q = query(
      collection(db, 'ketidakhadiran'),
      orderBy('tgl_absen', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ketidakhadiran));
      setKetidakhadiranData(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'ketidakhadiran');
    });
    return () => unsubscribe();
  }, []);

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

      await generateKetidakhadiranReportPDF(filtered, periodType, user.name, 'Wali Asrama');
      alert(`Berhasil membuat rekap PDF ${periodType}!`);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat rekap PDF!');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKetidakhadiran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khKegiatan.trim()) {
      alert('Nama kegiatan harus diisi!');
      return;
    }
    if (khSelectedSiswa.length === 0) {
      alert('Pilih minimal satu siswa!');
      return;
    }
    setLoading(true);
    try {
      const nomorSurat = `KTH-WAS-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, 'ketidakhadiran'), {
        nomor_surat: nomorSurat,
        tgl_absen: Timestamp.now(),
        keterangan_kegiatan: khKegiatan,
        kelas: khKelas,
        daftar_siswa: khSelectedSiswa,
        deskripsi: khDeskripsi || 'Tidak ada keterangan tambahan.',
        author_name: user.name,
        author_uid: user.uid,
        author_role: user.role,
        createdAt: serverTimestamp()
      });

      // Reset
      setKhKegiatan('');
      setKhSelectedSiswa([]);
      setKhDeskripsi('');
      setKhSearchSiswaFilter('');
      setShowKetidakhadiranForm(false);

      notifyAllRoles(['wali_kelas', 'kepala_sekolah', 'wali_asuh'], 'Catatan Ketidakhadiran Baru', `Wali Asrama ${user.name} membuat catatan ketidakhadiran untuk kelas ${khKelas} pada kegiatan ${khKegiatan}.`);
      alert('Catatan ketidakhadiran berhasil disimpan.');
    } catch (err) {
      console.error('Error saving ketidakhadiran:', err);
      alert('Gagal menyimpan catatan: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.WRITE, 'ketidakhadiran');
    } finally {
      setLoading(false);
    }
  };



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
      // 1. Status Filter
      if (hpStatusFilter !== 'semua' && item.status !== hpStatusFilter) {
        return false;
      }

      // 2. Time Filter
      const pinjamDate = item.tgl_pinjam?.toDate();
      
      let matchesTime = item.status === 'dipinjam' || hpTimeFilter === 'semua';
      
      if (!matchesTime && pinjamDate) {
        if (hpTimeFilter === 'hari_ini') matchesTime = isToday(pinjamDate);
        else if (hpTimeFilter === 'kemarin') matchesTime = isYesterday(pinjamDate);
        else if (hpTimeFilter === 'minggu_ini') matchesTime = isThisWeek(pinjamDate, { weekStartsOn: 1 });
        else if (hpTimeFilter === 'bulan_ini') matchesTime = isThisMonth(pinjamDate);
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

  const handleSaveTindakanLanjut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSarprasForTindakan) return;

    setSubmittingSarpras(true);
    try {
      const newAction = {
        waktu: Timestamp.now(),
        oleh_name: user.name,
        oleh_role: user.role === 'wali_asuh' ? 'Wali Asuh' : (user.role === 'wali_asrama' ? 'Wali Asrama' : user.role),
        tindakan: tindakanKeterangan
      };

      const updatedTindakanList = [
        ...(selectedSarprasForTindakan.tindakan_list || []),
        newAction
      ];

      await updateDoc(doc(db, 'sarpras_reports', selectedSarprasForTindakan.id!), {
        status: tindakanStatus,
        tindakan_list: updatedTindakanList,
        tindakan_oleh_name: user.name,
        tindakan_oleh_role: user.role === 'wali_asuh' ? 'Wali Asuh' : (user.role === 'wali_asrama' ? 'Wali Asrama' : user.role),
        tgl_tindakan: Timestamp.now(),
        keterangan_tindakan: tindakanKeterangan,
        updatedAt: serverTimestamp()
      });

      setSelectedSarprasForTindakan(null);
      setTindakanKeterangan('');
      alert('Tindak lanjut berhasil disimpan!');
    } catch (err) {
      console.error('Error updating sarpras follow up:', err);
      handleFirestoreError(err, OperationType.UPDATE, `sarpras_reports/${selectedSarprasForTindakan.id}`);
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
    catatan_evaluasi: 'Evaluasi Asrama',
    catatan_kejadian: 'Catatan Kejadian di Asrama',
    cek_ketidakhadiran: 'Cek Ketidakhadiran',
    jurnal_keperawatan: 'Jurnal Keperawatan'
  };

  const navItems = [
    { id: 'perizinan', label: 'Perizinan', icon: ClipboardList },
    { id: 'cek_kesehatan', label: 'Usulan Cek', icon: Activity },
    { id: 'catatan_evaluasi', label: 'Evaluasi Asrama', icon: ClipboardList },
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
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-stone-950 text-white' : 'bg-[#fcfaf6] text-[#3e2723]'} font-sans antialiased selection:bg-[#3e2723] selection:text-white`}>
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
                <div className="p-6">
                  <div className={`rounded-[2.5rem] p-5 mb-8 border border-white/5 relative overflow-hidden group bg-stone-950`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#3e2723]/10 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10 font-display text-left">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight uppercase italic text-amber-100">SRMA 24</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 italic text-amber-200/60`}>Dorm Guardian</span>
                      </div>
                    </div>
                  </div>

                    <div className="space-y-8 text-left">
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 italic text-stone-500`}>MENU ASRAMA</p>
                        <div className="space-y-1.5">
                          {[
                            { id: 'perizinan', label: 'Dashboard', icon: LayoutDashboard },
                            { id: 'agenda', label: 'Agenda Kegiatan', icon: Calendar },
                            { id: 'dinding', label: 'Dinding Guardians', icon: MessageSquare },
                            { id: 'catatan_evaluasi', label: 'Evaluasi Asrama', icon: ClipboardList },
                            { id: 'catatan_kejadian', label: 'Kejadian Asrama', icon: AlertTriangle },
                            { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                            { id: 'cek_kesehatan', label: 'Usulan Cek Kesehatan', icon: Activity },
                            { id: 'jurnal_keperawatan', label: 'Jurnal Keperawatan', icon: Activity },
                            { id: 'cek_ketidakhadiran', label: 'Cek Ketidakhadiran', icon: ClipboardCheck },
                            { id: 'pinjam_hp', label: 'Peminjaman HP', icon: Smartphone },
                            { id: 'sarpras', label: 'Sarpras Asrama', icon: Wrench },
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
                {viewTitles[viewMode] || 'Dashboard'}
              </h1>
              <p className={`text-[8px] font-bold uppercase tracking-widest opacity-50 italic ${isDarkMode ? 'text-amber-100' : 'text-[#8b5e3c]'}`}>
                Guardian Portal
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
        {viewMode === 'dinding' && <WallView user={user} wallType="asrama" title="Dinding Wali Asrama" />}
        {viewMode === 'catatan_evaluasi' && <EvaluationNotesView user={user} />}
        {viewMode === 'catatan_kejadian' && <DormitoryIncidentsView user={user} />}
        {viewMode === 'jurnal_keperawatan' && <JurnalKeperawatanView user={user} />}

        {viewMode === 'cek_ketidakhadiran' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Banner header coklat */}
            <div className="relative bg-[#3e2723] rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-white overflow-hidden shadow-xl border-b-4 border-amber-950 flex flex-col justify-between min-h-[250px] md:aspect-[16/6] transition-all">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_0)] bg-[size:16px_16px]" />
              </div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-200 text-[8px] font-black uppercase tracking-[0.2em] rounded-md border border-amber-500/20 w-fit">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>ABSENCE VERIFICATION MODULE</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-display uppercase tracking-tight text-[#fdfcf0] italic leading-none">
                    Cek Ketidak-hadiran
                  </h2>
                  <p className="text-[10px] sm:text-xs font-semibold text-[#ebdccb]/85 uppercase tracking-widest leading-relaxed">
                    Evaluasi Harian & Pencatatan Ketidakhadiran Pembelajaran / Kegiatan
                  </p>
                </div>

                <div className="bg-[#4e342e] border border-amber-500/10 rounded-3xl p-4 text-right self-start">
                  <p className="text-[7.5px] font-black text-amber-200/50 uppercase tracking-widest mb-1">Live Clock</p>
                  <p className="font-mono text-xs sm:text-sm font-bold text-amber-100 tracking-wider">
                    {formatRealTime ? formatRealTime(currentTime) : format(currentTime, 'EEEE, d MMMM yyyy • HH:mm:ss', { locale: id })}
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handlePrintSummaryPDF('Minggu Ini')}
                  disabled={loading}
                  className="bg-amber-950/40 hover:bg-amber-950/70 text-amber-200 text-[9px] font-black uppercase tracking-widest py-3 px-4 rounded-xl border border-amber-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Rekap Mingguan</span>
                </button>
                <button
                  onClick={() => handlePrintSummaryPDF('Bulan Ini')}
                  disabled={loading}
                  className="bg-amber-950/40 hover:bg-amber-950/70 text-amber-200 text-[9px] font-black uppercase tracking-widest py-3 px-4 rounded-xl border border-amber-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Rekap Bulanan</span>
                </button>
                <button
                  onClick={() => {
                    setKhKegiatan('');
                    setKhSelectedSiswa([]);
                    setKhDeskripsi('');
                    setKhSearchSiswaFilter('');
                    setShowKetidakhadiranForm(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-[9.5px] font-black uppercase tracking-widest py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 border-b-2 border-amber-700 font-display"
                >
                  <Plus className="w-4 h-4 text-stone-900" />
                  <span>Buat Catatan</span>
                </button>
              </div>
            </div>

            {/* Kategori seleksi */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
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
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-4 ${
                    khTimeFilter === cat.id
                      ? 'bg-[#5d4037] text-amber-100 shadow-lg border-amber-950 translate-y-[-1px]'
                      : 'bg-white text-[#8b5e3c] border-stone-200/50 hover:border-sharp hover:bg-[#faf6f0]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Riwayat / History */}
            <div className="p-6 bg-[#fdfcf9] rounded-[2rem] border border-[#d7ccc8]/40 overflow-hidden shadow-sm text-left">
              <h4 className="text-xs font-black text-[#8b5e3c] uppercase tracking-widest mb-4 italic font-display">Riwayat Ketidakhadiran</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredKetidakhadiran.length > 0 ? (
                  filteredKetidakhadiran.map((rec) => {
                    const recDate = parseFirestoreDate(rec.tgl_absen) || new Date();
                    const formattedDate = format(recDate, 'EEEE, d MMMM yyyy • HH:mm', { locale: id });
                    return (
                      <div 
                        key={rec.id}
                        className="bg-white rounded-2xl border border-[#ebdccb] hover:border-[#a1887f] p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#ebdccb]/40">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#f5ebe0] text-[#3e2723] font-black flex items-center justify-center text-sm shadow-inner shrink-0 italic border border-[#ebdccb]/30">
                              {rec.kelas?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-black text-xs text-[#3e2723] font-display uppercase italic tracking-tight leading-none truncate">
                                  {rec.keterangan_kegiatan}
                                </h4>
                                <span className="bg-[#5d4037] text-amber-200 text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                                  {rec.kelas}
                                </span>
                              </div>
                              <p className="text-[9px] font-bold text-[#8d6e63]/85 uppercase mt-1 italic">
                                Oleh: {rec.author_name} ({rec.author_role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama'})
                              </p>
                            </div>
                          </div>
                          <span className="text-[8px] font-black text-[#8d6e63]/60 uppercase tracking-widest shrink-0 font-mono">
                            {rec.nomor_surat ? rec.nomor_surat : ''}
                          </span>
                        </div>

                        <div className="bg-[#fcfaf6] p-3 rounded-xl border border-[#ebdccb]/45 space-y-2">
                          <div className="flex items-center gap-2 text-[7.5px] font-black text-[#8d6e63] uppercase tracking-wider">
                            <ClipboardCheck className="w-3.5 h-3.5 text-[#5d4037] shrink-0" />
                            <span>Siswa Tidak Hadir ({rec.daftar_siswa.length})</span>
                          </div>
                          <p className="text-[10px] font-semibold text-slate-600 leading-relaxed font-sans pl-1.5 break-words">
                            {rec.daftar_siswa.join(', ')}
                          </p>
                        </div>

                        {rec.deskripsi && (
                          <div className="text-[10px] text-slate-500 pl-1">
                            <span className="font-bold text-[#3e2723] block mb-0.5 uppercase text-[7.5px] tracking-wider">Keterangan:</span>
                            <p className="leading-relaxed font-sans">{rec.deskripsi}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-[7.5px] font-black uppercase text-[#8d6e63] tracking-wider pt-2 border-t border-[#ebdccb]/20">
                          <Clock className="w-3.5 h-3.5 text-[#3e2723]/60 shrink-0" />
                          <span>Dicatat: {formattedDate} WIB</span>
                        </div>

                        <div className="flex gap-2">
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
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#3e2723] hover:bg-black text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-sm"
                          >
                            {khPdfLoading === rec.id ? (
                              <Loader2 className="w-3 animate-spin" />
                            ) : (
                              <Printer className="w-3 text-amber-200" />
                            )}
                            <span>Cetak Detail PDF</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-[#ebdccb]">
                    <ClipboardCheck className="w-12 h-12 text-[#d7ccc8] mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[#8d6e63] text-xs font-sans">Belum ada riwayat ketidakhadiran</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Buat Catatan Ketidakhadiran */}
        {showKetidakhadiranForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#fdfcf9] rounded-[2.5rem] border-2 border-[#ebdccb] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-[#3e2723] p-6 text-white flex items-center justify-between border-b-4 border-amber-950">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-200 rounded-xl">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-sm uppercase tracking-wider font-display text-amber-100">Buat Catatan Ketidakhadiran</h3>
                    <p className="text-[8px] font-bold text-amber-200/60 uppercase tracking-widest">Database Sync Active</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKetidakhadiranForm(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-amber-200" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateKetidakhadiran} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-left">
                {/* Kegiatan */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[#5d4037] uppercase tracking-widest block">Keterangan Kegiatan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Shalat Berjamaah, KBM Kelas, Upacara, dll."
                    value={khKegiatan}
                    onChange={(e) => setKhKegiatan(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white border border-[#ebdccb] rounded-2xl focus:ring-2 focus:ring-[#3e2723] outline-none transition-all text-xs font-bold text-[#3e2723]"
                  />
                </div>

                {/* Kelas */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[#5d4037] uppercase tracking-widest block">Pilih Kelas</label>
                  <select
                    value={khKelas}
                    onChange={(e) => {
                      setKhKelas(e.target.value);
                      setKhSelectedSiswa([]); // Reset selected when class changes to keep clean selections
                    }}
                    className="w-full px-4 py-3 bg-white border border-[#ebdccb]/60 rounded-2xl focus:ring-2 focus:ring-[#3e2723] outline-none transition-all text-xs font-bold text-[#3e2723]"
                  >
                    {['X-1', 'X-2', 'X-3', 'X-4', 'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XII-1', 'XII-2', 'XII-3', 'XII-4'].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                {/* Siswa Selector (Multi Select) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-[#5d4037] uppercase tracking-widest block">
                      Siswa Tidak Hadir dari Kelas {khKelas} ({khSelectedSiswa.length} terpilih)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const inClass = students.filter(s => s.kelas === khKelas).map(s => s.nama_lengkap || s.id || '');
                          setKhSelectedSiswa(inClass);
                        }}
                        className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setKhSelectedSiswa([])}
                        className="text-[8px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Small search inside selection */}
                  <input
                    type="text"
                    placeholder="Cari nama siswa di seluruh database..."
                    value={khSearchSiswaFilter}
                    onChange={(e) => setKhSearchSiswaFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-stone-50 border border-[#ebdccb]/60 rounded-xl text-[10px] font-bold text-[#3e2723] outline-none mb-2"
                  />

                  <div className="max-h-40 overflow-y-auto border border-[#ebdccb] rounded-2xl p-3 bg-white space-y-1.5 custom-scrollbar">
                    {(() => {
                      const filterVal = khSearchSiswaFilter.toLowerCase();
                      const inClass = students.filter(s => {
                        if (!filterVal) {
                          return s.kelas === khKelas;
                        }
                        return (s.nama_lengkap || '').toLowerCase().includes(filterVal);
                      });

                      if (inClass.length === 0) {
                        return <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center py-4">Tidak ada data siswa ditemukan</p>;
                      }

                      return inClass.map(s => {
                        const name = s.nama_lengkap || 'Siswa Tanpa Nama';
                        const isChecked = khSelectedSiswa.includes(name);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-[#f5ebe0] border-[#a1887f] text-[#3e2723]' 
                                : 'bg-[#fafafa] border-[#ebdccb]/30 hover:border-[#ebdccb] text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setKhSelectedSiswa(khSelectedSiswa.filter(val => val !== name));
                                } else {
                                  setKhSelectedSiswa([...khSelectedSiswa, name]);
                                }
                              }}
                              className="w-4 h-4 rounded text-[#3e2723] border-[#ebdccb] focus:ring-[#3e2723]"
                            />
                            <span className="text-xs font-bold uppercase tracking-tight text-stone-800">
                              {name} <span className="text-[10px] text-amber-800 font-semibold ml-1.5">({s.kelas || '-'})</span>
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Deskripsi */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[#5d4037] uppercase tracking-widest block">Keterangan Tambahan / Alasan</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan keterangan detail, misalnya: Siswa ijin sakit berada di UKS, alfa tanpa keterangan, dll..."
                    value={khDeskripsi}
                    onChange={(e) => setKhDeskripsi(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#ebdccb]/60 rounded-2xl focus:ring-2 focus:ring-[#3e2723] outline-none transition-all text-xs font-medium text-slate-700 font-display"
                  />
                </div>

                {/* Submit footer */}
                <div className="pt-4 border-t border-[#ebdccb]/50 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKetidakhadiranForm(false)}
                    className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-[#3e2723] hover:bg-[#271815] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}


        {viewMode === 'pinjam_hp' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Shrunk Header style */}
            <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
                    <Smartphone className="w-6 h-6 text-[#3e2723]" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Pinjam HP</h1>
                      <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                        GADGET LOG
                      </span>
                    </div>
                    <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-80">
                      MONITORING PENGGUNAAN GADGET SISWA
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                    <button 
                      onClick={() => generatePinjamHPReportPDF(pinjamHPList, 'minggu', user.name)}
                      className="px-3 py-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[9px] font-black uppercase tracking-widest italic">MINGGU</span>
                    </button>
                    <div className="w-[1px] bg-[#3e2723] mx-0.5 self-stretch" />
                    <button 
                      onClick={() => generatePinjamHPReportPDF(pinjamHPList, 'bulan', user.name)}
                      className="px-3 py-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                      <span className="text-[9px] font-black uppercase tracking-widest italic">BULAN</span>
                    </button>
                  </div>
 
                  <button
                    onClick={() => setShowPinjamForm(!showPinjamForm)}
                    className={`group px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md italic border-b-2 ${
                      showPinjamForm 
                      ? 'bg-[#5d4037] text-stone-300 border-black' 
                      : 'bg-[#fcfaf6] text-[#3e2723] border-stone-200 hover:bg-white'
                    }`}
                  >
                    {showPinjamForm ? 'CANCEL' : (
                      <>
                        <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                        INPUT PINJAM
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
                  <div className="bg-[#fcfaf6] rounded-2xl p-5 lg:p-6 shadow-xl border border-[#d7ccc8]/30 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative text-left">
                        <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic mb-1.5">NAMA SISWA</label>
                        <div className="relative">
                           <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                           <input 
                             type="text" 
                             value={phNamaSiswa}
                             onChange={(e) => handlePhNamaSiswaChange(e.target.value)}
                             onFocus={() => phNamaSiswa.length > 1 && setPhShowSuggestions(true)}
                             placeholder="Cari nama siswa..."
                             className="w-full bg-white border border-stone-100 rounded-xl pl-10 pr-4 py-2.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs italic placeholder:text-stone-200"
                           />
                        </div>
                        {phShowSuggestions && phFilteredStudentsList.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden">
                            {phFilteredStudentsList.slice(0, 5).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => selectPhStudent(s)}
                                className="w-full px-4 py-2.5 text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 flex items-center justify-between group"
                              >
                                <div>
                                  <p className="text-xs font-black text-[#3e2723] italic uppercase tracking-tight">{s.nama_lengkap}</p>
                                  <p className="text-[8px] font-bold text-stone-300 uppercase tracking-widest">{s.kelas}</p>
                                </div>
                                <div className="w-7 h-7 bg-stone-50 rounded-lg flex items-center justify-center group-hover:bg-[#3e2723] transition-colors">
                                  <Plus className="w-4 h-4 text-stone-200 group-hover:text-white transition-colors" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
 
                      <div className="text-left">
                        <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic mb-1.5">KELAS (AUTO)</label>
                        <input 
                          type="text" 
                          value={phKelas}
                          readOnly
                          className="w-full bg-stone-50/50 border border-stone-100 rounded-xl px-4 py-2.5 outline-none font-bold text-[#3e2723] text-xs italic opacity-60"
                        />
                      </div>
 
                      <div className="md:col-span-2 text-left">
                        <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic mb-1.5">KEPERLUAN PEMINJAMAN</label>
                        <textarea 
                          value={phKeperluan}
                          onChange={(e) => setPhKeperluan(e.target.value)}
                          placeholder="Jelaskan keperluan penggunaan gadget..."
                          className="w-full bg-white border border-stone-100 rounded-xl px-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] min-h-[100px] placeholder:text-stone-200 text-xs italic"
                        />
                      </div>
 
                      <div className="md:col-span-2">
                        <button
                          onClick={handleSubmitPinjamHP}
                          disabled={loading}
                          className="w-full bg-[#3e2723] text-white py-3.5 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 text-[10px] italic border-b-4 border-stone-900"
                        >
                          {loading ? 'PROCESSING...' : 'SAHKAN PEMINJAMAN SMARTPHONE'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
 
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-md -rotate-2">
                    <History className="w-5 h-5 text-[#3e2723]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Log Peminjaman</h3>
                    <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.2em] italic mt-1 underline decoration-amber-200 decoration-2 underline-offset-2">TRACKING AKTIF & ARSIP SMARTPHONE</p>
                  </div>
                </div>

                {/* Filter Controls for Handphone Lending */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Status Filter */}
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/50 gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'dipinjam', label: 'MASIH DIPINJAM' },
                      { id: 'dikembalikan', label: 'DIKEMBALIKAN' },
                      { id: 'semua', label: 'SEMUA STATUS' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setHpStatusFilter(st.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all italic whitespace-nowrap ${
                          hpStatusFilter === st.id
                            ? 'bg-[#3e2723] text-white shadow-sm'
                            : 'text-stone-400 hover:text-[#3e2723]'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Time Filter */}
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/50 gap-1 overflow-x-auto no-scrollbar">
                    {[ 
                      { id: 'semua', label: 'SEMUA WAKTU' },
                      { id: 'hari_ini', label: 'HARI INI' },
                      { id: 'kemarin', label: 'KEMARIN' },
                      { id: 'minggu_ini', label: 'MINGGU INI' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setHpTimeFilter(cat.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all italic whitespace-nowrap ${
                          hpTimeFilter === cat.id
                            ? 'bg-stone-600 text-white shadow-sm'
                            : 'text-stone-400 hover:text-stone-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredPinjamHP.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`bg-white rounded-xl p-4 shadow-sm border transition-all duration-300 group relative cursor-pointer overflow-hidden flex flex-col justify-between text-left ${
                        item.status === 'dipinjam' 
                          ? 'ring-4 ring-amber-500/5 border-amber-200 shadow-md shadow-amber-500/5' 
                          : 'border-stone-100 hover:border-stone-200 hover:shadow-md'
                      }`}
                      onClick={() => setSelectedPinjam(item)}
                    >
                      {/* Decorative edge line */}
                      <div className={`absolute top-0 right-0 w-1 h-full transition-all duration-700 ${item.status === 'dipinjam' ? 'bg-amber-500 opacity-100' : 'bg-emerald-500 opacity-40 group-hover:opacity-100'}`} />

                      <div className="flex flex-col gap-3 h-full">
                        {/* Status + Class Header row */}
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded bg-[#fcfaf6] text-[#3e2723] border border-stone-200/50 uppercase italic shrink-0`}>
                            {item.kelas}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-widest italic border-b-2 ${
                            item.status === 'dipinjam' 
                              ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {item.status === 'dipinjam' ? 'DIPINJAM' : 'KEMBALI'}
                          </span>
                        </div>

                        {/* Student Name */}
                        <div>
                          <h4 className="text-sm font-black text-[#3e2723] italic tracking-tight uppercase truncate">{item.nama_siswa}</h4>
                          
                          {/* Timing Log Container */}
                          <div className="flex items-center gap-2 mt-1.5 text-[8px] text-stone-400 font-mono">
                            <Clock className="w-3 h-3 text-[#3e2723]/40" />
                            <span>
                              {item.tgl_pinjam && typeof item.tgl_pinjam.toDate === 'function' 
                                ? format(item.tgl_pinjam.toDate(), 'dd MMM, HH:mm', { locale: id }) 
                                : '-'}
                            </span>
                            {item.status === 'dikembalikan' && (
                              <>
                                <span className="text-stone-300">→</span>
                                <span className="text-emerald-600 font-bold">
                                  {item.tgl_kembali && typeof item.tgl_kembali.toDate === 'function' 
                                    ? format(item.tgl_kembali.toDate(), 'dd MMM, HH:mm', { locale: id }) 
                                    : '-'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Purpose/Keperluan Box */}
                        <div className="relative pl-2.5 border-l-2 border-stone-100 bg-[#fcfaf6]/50 p-2 rounded-lg group-hover:bg-[#fcfaf6] transition-all flex flex-col gap-0.5">
                          <span className="text-[6px] font-black text-stone-300 uppercase tracking-widest italic">KEPERLUAN:</span>
                          <p className="text-[10px] font-bold text-[#5d4037] leading-tight italic line-clamp-2">
                            "{item.keperluan}"
                          </p>
                        </div>
                        
                        {/* Footer details */}
                        <div className="pt-2 border-t border-stone-50 flex flex-col gap-1.5 mt-auto">
                          <div className="flex flex-wrap gap-1.5 text-[8px] font-bold">
                            <div className="bg-[#fcfaf6] text-[#5d4037]/85 px-1.5 py-0.5 rounded border border-stone-150 italic max-w-full">
                              Peminjam: <strong className="text-[#3e2723] uppercase font-black">{item.wali_asuh_name}</strong>
                            </div>
                            {item.status === 'dikembalikan' && item.penerima_kembali_name && (
                              <div className="bg-emerald-50 text-emerald-650 px-1.5 py-0.5 rounded border border-emerald-100 italic max-w-full font-bold">
                                Penerima: <strong className="text-emerald-850 uppercase font-black">{item.penerima_kembali_name}</strong>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between gap-1 w-full mt-1">
                            <span className="text-[6.5px] font-black text-stone-300 uppercase tracking-widest italic leading-none">GADGET SYSTEM</span>
                            <div className="flex items-center gap-1 py-1 px-1.5 bg-stone-50 rounded group-hover:bg-[#3e2723] transition-colors shrink-0">
                              <span className="text-[7.5px] font-black text-[#3e2723]/60 group-hover:text-amber-200 uppercase tracking-widest italic leading-none">
                                DETAILS
                              </span>
                              <ChevronRight className="w-2.5 h-2.5 text-stone-300 group-hover:text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {pinjamHPList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-stone-50 relative overflow-hidden">
                  <Tablet className="w-12 h-12 text-stone-100 mb-3 opacity-50" />
                  <p className="text-[10px] font-black text-stone-200 uppercase tracking-[0.2em] italic">No active hp loan logs found</p>
                </div>
              )}
            </div>
          </div>
        )}        {viewMode === 'perizinan' && (() => {
          const weeklyPermits = permits.filter(p => {
            const date = p.tgl_surat?.toDate ? p.tgl_surat.toDate() : (p.tgl_surat instanceof Date ? p.tgl_surat : null);
            return date ? isThisWeek(date, { weekStartsOn: 1 }) : false;
          });
          const monthlyPermits = permits.filter(p => {
            const date = p.tgl_surat?.toDate ? p.tgl_surat.toDate() : (p.tgl_surat instanceof Date ? p.tgl_surat : null);
            return date ? isThisMonth(date) : false;
          });
          const weeklySakitCount = weeklyPermits.filter(p => p.tipe === 'sakit').length;
          const weeklyUmumCount = weeklyPermits.filter(p => p.tipe === 'umum').length;
          const monthlySakitCount = monthlyPermits.filter(p => p.tipe === 'sakit').length;
          const monthlyUmumCount = monthlyPermits.filter(p => p.tipe === 'umum').length;

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 text-left">
              {/* Shrunk Widescreen Header style (skala 7:16) */}
              <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
                      <History className="w-6 h-6 text-[#3e2723]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Audit Perizinan</h1>
                        <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                          PERMIT LOGS
                        </span>
                      </div>
                      <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-80">
                        MONITORING SURAT KETERANGAN SAKIT &amp; IZIN UMUM
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                      <button 
                        onClick={() => generateSummaryReportPDF(weeklyPermits, 'Minggu Ini', user.name, 'Wali Asrama')}
                        className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest italic">REKAP MINGGU</span>
                      </button>
                      <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
                      <button 
                        onClick={() => generateSummaryReportPDF(monthlyPermits, 'Bulan Ini', user.name, 'Wali Asrama')}
                        className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest italic">REKAP BULAN</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rekap mingguan & bulanan analytic cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weekly summary card */}
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 opacity-70" />
                  <div>
                    <div className="flex items-center justify-between mb-2 pl-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[8px] font-black text-amber-700 tracking-wider uppercase italic">SUMMARY MINGGUAN</span>
                      </div>
                      <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Minggu Ini</span>
                    </div>

                    <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Riwayat Izin &amp; Sakit</h4>
                    <div className="grid grid-cols-2 gap-3 pl-2 mb-4">
                      <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                        <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">IZIN SAKIT</span>
                        <span className="text-2xl font-black text-rose-600 leading-tight mt-1">{weeklySakitCount}</span>
                        <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Siswa Medis</span>
                      </div>
                      <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                        <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">IZIN UMUM</span>
                        <span className="text-2xl font-black text-indigo-600 leading-tight mt-1">{weeklyUmumCount}</span>
                        <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Siswa Umum</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between pl-2">
                    <span className="text-xs font-bold text-stone-500">
                      Total Surat Terbit: <span className="font-extrabold text-[#3e2723] underline decoration-amber-300 decoration-2">{weeklyPermits.length} Izin</span>
                    </span>
                    <button
                      onClick={() => generateSummaryReportPDF(weeklyPermits, 'Minggu Ini', user.name, 'Wali Asrama')}
                      className="px-3 py-1.5 bg-[#3e2723] hover:bg-black text-white text-[8px] font-black rounded-lg tracking-widest uppercase italic flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Printer className="w-3 h-3 text-amber-200" /> Cetak PDF
                    </button>
                  </div>
                </div>

                {/* Monthly summary card */}
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm text-left flex flex-col justify-between hover:border-stone-200 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#3e2723] opacity-70" />
                  <div>
                    <div className="flex items-center justify-between mb-2 pl-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#3e2723] animate-pulse" />
                        <span className="text-[8px] font-black text-[#3e2723] tracking-wider uppercase italic">SUMMARY BULANAN</span>
                      </div>
                      <span className="text-[9px] font-mono text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-md">Bulan Ini</span>
                    </div>

                    <h4 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic mb-3 pl-2">Rekapitulasi Bulanan</h4>
                    <div className="grid grid-cols-2 gap-3 pl-2 mb-4">
                      <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                        <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">TOTAL SAKIT</span>
                        <span className="text-2xl font-black text-rose-600 leading-tight mt-1">{monthlySakitCount}</span>
                        <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Surat Sakit</span>
                      </div>
                      <div className="bg-[#fcfaf6] p-3 rounded-xl border border-stone-100/60 flex flex-col">
                        <span className="text-[7px] text-stone-400 font-black uppercase tracking-wider block">TOTAL UMUM</span>
                        <span className="text-2xl font-black text-indigo-600 leading-tight mt-1">{monthlyUmumCount}</span>
                        <span className="text-[8px] text-stone-400 mt-1 uppercase font-semibold">Izin Umum</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between pl-2">
                    <span className="text-xs font-bold text-stone-500">
                      Total Surat Terbit: <span className="font-extrabold text-[#3e2723] underline decoration-amber-400 decoration-2">{monthlyPermits.length} Izin</span>
                    </span>
                    <button
                      onClick={() => generateSummaryReportPDF(monthlyPermits, 'Bulan Ini', user.name, 'Wali Asrama')}
                      className="px-3 py-1.5 bg-[#3e2723] hover:bg-black text-white text-[8px] font-black rounded-lg tracking-widest uppercase italic flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Printer className="w-3 h-3 text-amber-200" /> Cetak PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Search & Filter Container */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col sm:flex-row gap-3 items-center w-full">
                <div className="relative w-full group text-left">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-[#3e2723] transition-colors" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa atau no surat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-stone-100 rounded-xl focus:ring-4 focus:ring-[#3e2723]/5 focus:border-[#3e2723] outline-none transition-all text-xs font-bold font-sans italic"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 custom-scrollbar w-full sm:w-auto">
                  {(['hari_ini', 'kemarin', 'minggu_ini', 'bulan_ini', 'semua'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTimeFilter(filter)}
                      className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all italic border-b-2 hover:scale-[1.02] active:scale-[0.98] ${
                        timeFilter === filter 
                          ? 'bg-[#3e2723] text-amber-200 border-stone-600 shadow-md' 
                          : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'
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
                      className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between" onClick={() => setSelectedPermit(permit)}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            permit.tipe === 'sakit' ? 'bg-rose-50 text-rose-600' : 
                            permit.tipe === 'umum' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {permit.tipe === 'sakit' ? <Activity className="w-4 h-4" /> : 
                             permit.tipe === 'umum' ? <Calendar className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">{permit.nama_siswa}</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{permit.kelas} • {permit.nomor_surat}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
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
                              className="p-1.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Cetak Surat Sakit"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredPermits.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-stone-200">
                    <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[#3e2723] text-[9px] italic">Tidak ada riwayat ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {viewMode === 'cek_kesehatan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Shrunk Widescreen Header style */}
          <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
                  <Activity className="w-6 h-6 text-[#3e2723]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Usulan Cek Kesehatan</h1>
                    <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                      HEALTH CHECK
                    </span>
                  </div>
                  <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-80">
                    SISTEM MONITORING & USULAN PENGECEKAN KESEHATAN SISWA
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-sm font-black text-slate-900 font-display uppercase tracking-wider">Usulan Baru</h3>
               <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[8px] font-black uppercase tracking-widest italic">
                 {selectedStudents.length} Siswa Terpilih
               </div>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-[#3e2723]/5 focus:border-[#3e2723] outline-none transition-all text-xs font-bold"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      selectedClass === c
                        ? 'bg-[#3e2723] text-white shadow-md'
                        : 'bg-white text-slate-500 border border-slate-205/60 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                {filteredStudents.map(student => (
                  <div 
                    key={student.id}
                    onClick={() => toggleStudentSelection(student.nama_lengkap)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedStudents.includes(student.nama_lengkap)
                        ? 'bg-[#fcfaf6] border-amber-200'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded bg-stone-100 text-[#3e2723] flex items-center justify-center text-[9px] font-black`}>
                        {student.nama_lengkap.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">{student.nama_lengkap}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{student.kelas}</p>
                      </div>
                    </div>
                    {selectedStudents.includes(student.nama_lengkap) ? (
                      <CheckCircle2 className="w-4 h-4 text-[#3e2723]" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-200" />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-left">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan Tambahan (Opsional)</label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-stone-100 rounded-xl outline-none focus:ring-2 focus:ring-[#3e2723]/10 focus:border-[#3e2723] transition-all text-xs font-medium min-h-[80px]"
                  placeholder="Misal: Siswa mengeluh pusing sejak pagi..."
                />
              </div>

              <button
                onClick={handleSubmitProposal}
                disabled={submittingProposal || selectedStudents.length === 0}
                className="w-full py-3 bg-[#3e2723] text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-[10px] uppercase tracking-widest italic"
              >
                {submittingProposal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 rotate-45" />}
                KIRIM USULAN KE DOKTER
              </button>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-md -rotate-2">
                 <Activity className="w-5 h-5 text-[#3e2723]" />
               </div>
               <div className="text-left">
                 <h3 className="text-xl font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Log Usulan Kesehatan</h3>
                 <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.2em] italic mt-1 underline decoration-amber-200 decoration-2 underline-offset-2">TRACKING REKOMENDASI MEDIS SISWA</p>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {proposalHistory.map(prop => (
                    <div 
                      key={prop.id} 
                      onClick={() => setSelectedProposal(prop)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 transition-all duration-300 hover:border-stone-200 hover:shadow-md cursor-pointer relative overflow-hidden flex flex-col justify-between text-left group"
                    >
                      {/* Decorative edge line */}
                      <div className={`absolute top-0 right-0 w-1 h-full transition-all duration-700 ${prop.status === 'pending' ? 'bg-amber-500 opacity-100' : 'bg-emerald-500 opacity-40 group-hover:opacity-100'}`} />

                      <div className="flex flex-col gap-3 h-full">
                        {/* Status + Class Header row */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-[#fcfaf6] text-[#3e2723] border border-stone-200/50 uppercase italic shrink-0">
                            {prop.asrama} ASRAMA
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-widest italic border-b-2 ${
                            prop.status === 'pending' 
                              ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {prop.status === 'pending' ? 'PENDING' : 'SELESAI'}
                          </span>
                        </div>

                        {/* Title & Count */}
                        <div>
                          <h4 className="text-sm font-black text-[#3e2723] italic tracking-tight uppercase truncate">
                            {prop.daftar_siswa.length} Siswa Diusulkan
                          </h4>
                          
                          {/* Timing Log Container */}
                          <div className="flex items-center gap-1.5 mt-1 text-[8px] text-stone-400 font-mono">
                            <Clock className="w-3 h-3 text-[#3e2723]/30" />
                            <span>
                              {prop.tgl_usulan && typeof prop.tgl_usulan.toDate === 'function' 
                                ? format(prop.tgl_usulan.toDate(), 'dd MMM yyyy, HH:mm', { locale: id }) 
                                : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Student list Box */}
                        <div className="relative pl-2.5 border-l-2 border-stone-100 bg-[#fcfaf6]/50 p-2 rounded-lg group-hover:bg-[#fcfaf6] transition-all flex flex-col gap-0.5">
                          <span className="text-[6px] font-black text-stone-300 uppercase tracking-widest italic">DAFTAR SISWA:</span>
                          <p className="text-[10px] font-bold text-[#5d4037] leading-tight italic line-clamp-2">
                            {prop.daftar_siswa.join(', ')}
                          </p>
                        </div>
                        
                        {/* Footer details with Selengkapnya button */}
                        <div className="pt-2 border-t border-stone-50 flex items-center justify-between gap-1 mt-auto">
                          <div className="min-w-0">
                            <span className="text-[6px] font-black text-stone-300 uppercase tracking-widest italic block leading-none">PROPOSED BY</span>
                            <span className="text-[8px] font-black text-[#3e2723] uppercase italic truncate block mt-0.5 max-w-[120px]">{prop.proposer_name}</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProposal(prop);
                            }}
                            className="flex items-center gap-1 py-1 px-1.5 bg-stone-50 rounded-lg group-hover:bg-[#3e2723] transition-colors shrink-0"
                          >
                            <span className="text-[7px] font-black text-stone-400 group-hover:text-amber-200 uppercase tracking-widest italic leading-none">
                              SELENGKAPNYA
                            </span>
                            <ChevronRight className="w-2.5 h-2.5 text-stone-300 group-hover:text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
             </div>

             {proposalHistory.length === 0 && (
               <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                 <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] italic">Belum ada riwayat usulan</p>
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
      )}        {viewMode === 'sarpras' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
          {/* Shrunk Header style */}
          <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 -rotate-2 transition-transform hover:rotate-0">
                  <Wrench className="w-6 h-6 text-[#3e2723]" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none italic uppercase">Sarpras Asrama</h1>
                    <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                      MAINTENANCE
                    </span>
                  </div>
                  <p className="text-stone-400 text-[8px] font-black mt-1 uppercase tracking-[0.2em] italic opacity-80">
                    LAPORAN KERUSAKAN FASILITAS
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
                  <button 
                    onClick={() => {
                      const filtered = sarprasReports.filter(r => {
                        const date = r.tgl_lapor?.toDate();
                        if (!date) return false;
                        return isThisWeek(date);
                      });
                      generateSarprasSummaryPDF(filtered, 'minggu_ini', { name: user.name, role: user.role });
                    }}
                    className="px-3 py-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                    <span className="text-[9px] font-black uppercase tracking-widest italic">MINGGU</span>
                  </button>
                  <div className="w-[1px] bg-[#3e2723] mx-0.5 self-stretch" />
                  <button 
                    onClick={() => {
                      const filtered = sarprasReports.filter(r => {
                        const date = r.tgl_lapor?.toDate();
                        if (!date) return false;
                        return isThisMonth(date);
                      });
                      generateSarprasSummaryPDF(filtered, 'bulan_ini', { name: user.name, role: user.role });
                    }}
                    className="px-3 py-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                    <span className="text-[9px] font-black uppercase tracking-widest italic">BULAN</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsAddingSarpras(!isAddingSarpras)}
                  className={`group px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md italic border-b-2 ${
                    isAddingSarpras 
                    ? 'bg-[#5d4037] text-stone-300 border-black' 
                    : 'bg-[#fcfaf6] text-[#3e2723] border-stone-200 hover:bg-white'
                  }`}
                >
                  {isAddingSarpras ? 'CANCEL' : (
                    <>
                      <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                      INPUT LAPORAN
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {isAddingSarpras && (
            <div className="bg-[#fcfaf6] rounded-2xl p-5 lg:p-6 shadow-xl border border-[#d7ccc8]/30 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic">NAMA BARANG</label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                      <input
                        type="text"
                        value={newSarpras.item_name}
                        onChange={(e) => setNewSarpras({...newSarpras, item_name: e.target.value})}
                        placeholder="Misal: AC Kamar, Pintu, dsb..."
                        className="w-full bg-white border border-stone-100 rounded-xl pl-10 pr-4 py-2.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs italic placeholder:text-stone-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic">LOKASI DETAIL</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                      <input
                        type="text"
                        value={newSarpras.location}
                        onChange={(e) => setNewSarpras({...newSarpras, location: e.target.value})}
                        placeholder="Misal: Kamar 10-A, Lt. 2..."
                        className="w-full bg-white border border-stone-100 rounded-xl pl-10 pr-4 py-2.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs italic placeholder:text-stone-200"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic">ASRAMA</label>
                    <select
                      value={newSarpras.asrama}
                      onChange={(e) => setNewSarpras({...newSarpras, asrama: e.target.value})}
                      className="w-full bg-white border border-stone-100 rounded-xl px-4 py-2.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs italic"
                    >
                      <option value="">Pilih Asrama</option>
                      <option value="Asrama Putra">Asrama Putra</option>
                      <option value="Asrama Putri">Asrama Putri</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest ml-2 italic">DESKRIPSI KERUSAKAN</label>
                    <textarea
                      value={newSarpras.damage_description}
                      onChange={(e) => setNewSarpras({...newSarpras, damage_description: e.target.value})}
                      placeholder="Uraikan detail kerusakan fasilitas..."
                      className="w-full bg-white border border-stone-100 rounded-xl px-4 py-3 focus:border-[#3e2723] min-h-[100px] outline-none transition-all font-bold text-[#3e2723] text-xs italic placeholder:text-stone-200"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={handleSubmitSarpras}
                    disabled={submittingSarpras}
                    className="w-full bg-[#3e2723] text-white py-3.5 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 text-[10px] italic border-b-4 border-stone-900"
                  >
                    {submittingSarpras ? 'SUBMITTING...' : 'SAHKAN LAPORAN KERUSAKAN'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
             <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-md -rotate-2">
                <History className="w-5 h-5 text-[#3e2723]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Log Pemeliharaan</h3>
                <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.2em] italic mt-1 underline decoration-amber-200 decoration-2 underline-offset-2">INVENTARIS FASILITAS ASRAMA</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {sarprasReports.map((report, idx) => (
                  <motion.div 
                    key={report.id} 
                    layout
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="bg-white p-4 rounded-xl border border-stone-50 shadow-sm relative group hover:shadow-lg transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className={`absolute top-0 right-0 w-1 h-full transition-all duration-700 ${report.status === 'fixed' ? 'bg-emerald-500 opacity-100' : 'bg-rose-500 opacity-40 group-hover:opacity-100'}`} />
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
                            report.status === 'fixed' ? 'bg-emerald-50 text-emerald-600' :
                            report.status === 'on_progress' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            <Wrench className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[6px] font-black text-stone-300 uppercase tracking-widest italic mb-0.5">
                              {report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? format(report.tgl_lapor.toDate(), 'dd MMM yyyy', { locale: id }) : '-'}
                            </p>
                            <h4 className="text-sm font-black text-[#3e2723] italic tracking-tight uppercase truncate">{report.item_name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[7px] font-bold text-stone-400 uppercase tracking-widest italic truncate">{report.location}</span>
                              <span className="w-1 h-1 bg-stone-100 rounded-full shrink-0" />
                              <span className="text-[7px] font-black text-amber-600 uppercase italic shrink-0">{report.asrama}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateSarprasReportPDF(report);
                            }}
                            className="w-7 h-7 bg-stone-50 text-stone-200 hover:text-[#3e2723] hover:bg-white rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 border border-transparent hover:border-stone-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <span className={`px-2 py-1 rounded-lg text-[6px] font-black uppercase tracking-widest italic border-b-2 ${
                            report.status === 'fixed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            report.status === 'on_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative pl-3 border-l-2 border-stone-100 bg-[#fcfaf6]/50 p-2.5 rounded-lg group-hover:bg-white group-hover:shadow-inner transition-all flex items-center gap-3">
                         <p className="text-[10px] font-bold text-[#5d4037] leading-relaxed italic block flex-1">
                           "{report.damage_description}"
                         </p>
                      </div>

                      {/* Actions chronological log (adopted from Jurnal Keperawatan) */}
                      {(() => {
                        const actions = report.tindakan_list || (report.keterangan_tindakan ? [{
                          waktu: report.tgl_tindakan || report.tgl_lapor,
                          oleh_name: report.tindakan_oleh_name || 'Petugas',
                          oleh_role: report.tindakan_oleh_role || 'Staff',
                          tindakan: report.keterangan_tindakan
                        }] : []);

                        if (actions.length === 0) {
                          return (
                            <div className="p-3 bg-[#fcfaf6] rounded-xl text-center border border-dashed border-[#ebdccb]/30">
                              <p className="text-[9px] font-bold text-stone-400 uppercase italic">Belum ada tindakan lanjut</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2 mt-2 bg-stone-50 border border-stone-100 rounded-xl p-3">
                            <span className="text-[8px] font-black text-[#5d4037] uppercase tracking-widest block">Riwayat Tindakan Perbaikan ({actions.length})</span>
                            <div className="border-l border-[#ebdccb] pl-3.5 py-1 space-y-3">
                              {actions.map((action, actionIdx) => {
                                const actionD = action.waktu?.toDate ? action.waktu.toDate() : new Date();
                                return (
                                  <div key={actionIdx} className="relative text-left">
                                    <div className="absolute -left-[18px] top-1.5 w-1.5 h-1.5 rounded-full bg-[#5d4037] border border-white" />
                                    <div className="text-[10px] leading-relaxed">
                                      <span className="font-semibold text-slate-700">{action.tindakan}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[8px] text-[#8d6e63]/85 font-black uppercase italic">
                                          Oleh: {action.oleh_name} ({action.oleh_role})
                                        </span>
                                        <span className="text-[7.5px] font-semibold text-stone-400 font-mono">
                                          {format(actionD, 'd MMM • HH:mm', { locale: id })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Footer with action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                        <span className="text-[8.5px] font-bold text-stone-400 uppercase tracking-widest font-mono">
                          PELAPOR: {report.author_name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSarprasForTindakan(report);
                              setTindakanStatus(report.status || 'on_progress');
                              setTindakanKeterangan('');
                            }}
                            className="flex items-center gap-1.5 py-1.5 px-3 bg-[#3e2723] hover:bg-black text-[9px] text-white font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-sm shrink-0"
                          >
                            <Check className="w-3 h-3 text-amber-200" />
                            Tindak Lanjut
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {sarprasReports.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-stone-50 relative overflow-hidden">
                <Wrench className="w-12 h-12 text-stone-100 mb-3 opacity-50" />
                <p className="text-[10px] font-black text-stone-200 uppercase tracking-[0.2em] italic">No active maintenance reports</p>
              </div>
            )}

            {/* Modal Pop Up Tindak Lanjut */}
            <AnimatePresence>
              {selectedSarprasForTindakan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-[2.5rem] border border-[#ebdccb] shadow-2xl max-w-md w-full overflow-hidden text-left"
                  >
                    <div className="bg-[#5d4037] p-6 text-white relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black tracking-widest bg-white/15 px-2.5 py-0.5 rounded uppercase font-mono">FOLLOW UP ACTIONS</span>
                          <h3 className="text-lg font-black uppercase tracking-tight font-display mt-1">Tindak Lanjut Kerusakan</h3>
                        </div>
                        <button
                          onClick={() => setSelectedSarprasForTindakan(null)}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-[#f5ebe0] transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleSaveTindakanLanjut} className="p-6 space-y-4">
                      <div className="bg-[#fcfaf6] p-4 rounded-xl border border-[#ebdccb]/30 space-y-1">
                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block">Detail Item Kerusakan</span>
                        <h4 className="text-xs font-black text-[#5d4037] uppercase">{selectedSarprasForTindakan.item_name}</h4>
                        <p className="text-[10px] text-stone-500 font-sans italic">"{selectedSarprasForTindakan.damage_description}"</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Status Terbaru</label>
                        <select
                          value={tindakanStatus}
                          onChange={(e) => setTindakanStatus(e.target.value as any)}
                          className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-bold text-[#3e2723] font-sans"
                        >
                          <option value="pending">🟡 Pending (Belum Ditangani)</option>
                          <option value="on_progress">🔵 Proses (Sedang Diperbaiki)</option>
                          <option value="fixed">🟢 Selesai (Sudah Diperbaiki)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Catatan Tindakan Lengkap</label>
                        <textarea
                          rows={3}
                          placeholder="Contoh: Lampu telah diganti baru oleh tim sarpras asrama pada sore hari tadi."
                          value={tindakanKeterangan}
                          onChange={(e) => setTindakanKeterangan(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                        />
                      </div>

                      <div className="pt-4 border-t border-[#ebdccb]/40 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSarprasForTindakan(null)}
                          className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={submittingSarpras}
                          className="flex-1 py-3 bg-[#3e2723] hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md"
                        >
                          {submittingSarpras && <Loader2 className="w-4 h-4 animate-spin" />}
                          Simpan Tindakan
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {viewMode === 'memorandum' && (
        <div className="space-y-6 animate-in fade-in duration-700">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl font-black text-[#2d1e1a] font-display italic">Memorandum Intern</h2>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1 italic">Daftar Instruksi & Pengumuman Resmi</p>
            </div>
            <div className="w-10 h-10 bg-[#3e2723] rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Mail className="w-5 h-5 text-amber-200" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memos.map((memo) => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedMemo(memo)}
                className="group bg-orange-50 p-6 rounded-[2.5rem] shadow-sm border border-orange-100 border-l-8 border-l-orange-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 font-display group-hover:text-orange-700 transition-colors uppercase tracking-tight">{memo.perihal}</h3>
                      <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                        <span>{memo.nomor_memo}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span>{memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {memo.penerima.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-orange-100/50 text-orange-700 text-[8px] font-black rounded uppercase tracking-tighter border border-orange-200/50">
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
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-orange-200">
                <Mail className="w-12 h-12 text-orange-200/40 mx-auto mb-4" />
                <h3 className="text-[#3e2723] font-black uppercase tracking-widest text-xs italic">Belum Ada Memo</h3>
                <p className="text-stone-400 text-[9px] mt-1 uppercase font-black bg-orange-50 inline-block px-3 py-1 rounded-full italic">Tidak ditemukan riwayat memorandum</p>
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

                <div className="grid grid-cols-2 gap-4 font-sans text-left">
                  <div className="bg-white p-4 rounded-2xl border border-[#d7ccc8]/30 shadow-sm">
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Peminjaman Gadget</label>
                    <p className="text-[11px] font-black text-[#3e2723] leading-none mb-1">
                      {selectedPinjam.tgl_pinjam && typeof selectedPinjam.tgl_pinjam.toDate === 'function' ? format(selectedPinjam.tgl_pinjam.toDate(), 'HH:mm - dd MMM yyyy') : '-'}
                    </p>
                    <p className="text-[8px] font-bold text-[#3e2723]/80 uppercase tracking-tight truncate mt-1">Peminjam: <span className="font-extrabold text-[#3e2723]">{selectedPinjam.wali_asuh_name}</span></p>
                  </div>
                  <div className={`p-4 rounded-2xl border transition-all ${selectedPinjam.status === 'dikembalikan' ? 'bg-[#fdfcf0] border-emerald-100' : 'bg-stone-50 border-stone-100 opacity-60'}`}>
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Pengembalian Gadget</label>
                    <p className="text-[11px] font-black text-[#3e2723] leading-none mb-1">
                      {selectedPinjam.tgl_kembali && typeof selectedPinjam.tgl_kembali.toDate === 'function' ? format(selectedPinjam.tgl_kembali.toDate(), 'HH:mm - dd MMM yyyy') : '--:--'}
                    </p>
                    <p className="text-[8px] font-bold text-emerald-800/80 uppercase tracking-tight truncate mt-1">Penerima: <span className="font-extrabold text-emerald-950">{selectedPinjam.penerima_kembali_name || '-'}</span></p>
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
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-xl">
                    <Mail className="w-5 h-5 text-orange-600" />
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
                      <ShieldCheck className="w-4 h-4 text-orange-600" /> {selectedMemo.pengirim_name}
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
                      <span key={r} className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                        {r.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal</label>
                  <p className="text-xl font-black text-slate-900 leading-tight font-display italic tracking-tight">{selectedMemo.perihal}</p>
                </div>

                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium italic">{selectedMemo.isi}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setSelectedMemo(null)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    generateMemorandumPDF(selectedMemo);
                    setSelectedMemo(null);
                  }}
                  className="flex-1 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Printer className="w-4 h-4" /> Cetak PDF
                </button>
              </div>
            </div>
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

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#d7ccc8]/10 text-left">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Waktu Pinjam</label>
                    <p className="text-xs font-black text-stone-600">
                      {format(selectedPinjam.tgl_pinjam.toDate(), 'dd MMM yyyy, HH:mm')}
                    </p>
                    <p className="text-[9px] font-bold text-[#3e2723]/80 uppercase mt-1">Peminjam: <span className="font-extrabold text-[#3e2723]">{selectedPinjam.wali_asuh_name}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Waktu Kembali</label>
                    <p className="text-xs font-black text-stone-600">
                      {selectedPinjam.tgl_kembali 
                        ? format(selectedPinjam.tgl_kembali.toDate(), 'dd MMM yyyy, HH:mm') 
                        : 'Belum dikembalikan'}
                    </p>
                    {selectedPinjam.status === 'dikembalikan' && (
                      <p className="text-[9px] font-bold text-emerald-700/80 uppercase mt-1">Penerima: <span className="font-extrabold text-emerald-900">{selectedPinjam.penerima_kembali_name || '-'}</span></p>
                    )}
                  </div>
                </div>
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

      {/* Modal Detail Usulan Kesehatan */}
      <AnimatePresence>
        {selectedProposal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#d7ccc8]/30 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="p-6 border-b border-[#d7ccc8]/20 bg-[#f8f3ed] flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#3e2723] rounded-xl">
                    <Activity className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#3e2723] uppercase tracking-tight italic text-sm">Detail Usulan Cek Kesehatan</h3>
                    <p className="text-[9px] text-[#3e2723]/40 font-bold uppercase">Log Pengajuan Medis</p>
                  </div>
                </div>
                <button onClick={() => setSelectedProposal(null)} className="p-2 hover:bg-[#d7ccc8]/20 rounded-full transition-colors text-[#3e2723]/40">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-0.5">Diusulkan Oleh:</span>
                    <p className="font-bold text-[#3e2723] text-sm uppercase italic">{selectedProposal.proposer_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-0.5">Asrama / Lokasi:</span>
                    <p className="font-bold text-slate-700 text-sm uppercase">{selectedProposal.asrama}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-1">Daftar Siswa ({selectedProposal.daftar_siswa.length} Siswa):</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {selectedProposal.daftar_siswa.map((siswa, sIdx) => {
                      const initial = siswa.charAt(0);
                      return (
                        <div key={sIdx} className="px-3 py-1.5 bg-[#fcfaf6] border border-stone-150 rounded-lg flex items-center gap-2 shadow-sm animate-in fade-in duration-300">
                          <span className="w-4 h-4 rounded bg-[#3e2723] text-white flex items-center justify-center text-[8px] font-black shrink-0">{initial}</span>
                          <span className="text-xs font-bold text-[#3e2723] uppercase">{siswa}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedProposal.keterangan && (
                  <div className="bg-[#fcfaf6] p-4 rounded-xl border border-stone-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-1">Catatan Keluhan / Keterangan:</span>
                    <p className="text-xs text-stone-600 leading-relaxed font-semibold italic">"{selectedProposal.keterangan}"</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#d7ccc8]/10 text-xs">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-0.5 font-sans">Waktu Usulan:</span>
                    <p className="font-bold text-stone-600">
                      {selectedProposal.tgl_usulan && typeof selectedProposal.tgl_usulan.toDate === 'function' 
                        ? format(selectedProposal.tgl_usulan.toDate(), 'dd MMM yyyy, HH:mm') 
                        : '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block italic mb-0.5">Status Tindak Lanjut:</span>
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic leading-none inline-block mt-1 ${
                      selectedProposal.status === 'processed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {selectedProposal.status === 'processed' ? 'SELESAI DIPROSES' : 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#f8f3ed] border-t border-[#d7ccc8]/20 flex gap-3">
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="flex-1 py-3 bg-white border border-[#d7ccc8]/30 text-[#3e2723] font-black rounded-xl hover:bg-[#d7ccc8]/10 transition-all uppercase tracking-widest text-[9px] italic shadow-sm"
                >
                  Tutup
                </button>
                
                <button
                  onClick={() => {
                    generateHealthCheckProposalPDF(selectedProposal);
                  }}
                  className="py-3 px-4 bg-white border border-[#d7ccc8]/30 text-indigo-700 font-black rounded-xl hover:bg-[#d7ccc8]/10 transition-all uppercase tracking-widest text-[9px] italic flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 animate-bounce" /> Cetak
                </button>

                {selectedProposal.status === 'pending' && (
                  <button
                    onClick={async () => {
                      await handleProcessProposal(selectedProposal.id!);
                      setSelectedProposal(prev => prev ? { ...prev, status: 'processed' } : null);
                    }}
                    disabled={loading}
                    className="flex-1 py-3 bg-[#3e2723] text-white font-black rounded-xl hover:bg-black shadow-lg transition-all uppercase tracking-widest text-[9px] italic flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {loading ? '...' : 'Selesai'}
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
