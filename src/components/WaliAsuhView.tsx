import React, { useState, useEffect } from 'react';
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
import { Home, MessageSquare, Send, Clock, User, Printer, Database, Loader2, CheckCircle2, Calendar, Plus, MapPin, ClipboardList, Activity, FileText, Mail, ShieldCheck, Shield, BarChart3, Search, Menu, Smartphone, History, Check, ChevronRight, TrendingUp, Tablet, Bell, Moon, Sun, Star, Settings, CreditCard, LogOut, LayoutDashboard, IdCard, Laptop, Contact, GraduationCap, Info, Users, X, Camera, BookOpen } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, arrayUnion, deleteDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, LogTindakan, Memorandum, PinjamHP, Siswa, normalizeKelas, LaptopRequest, HPRequest, Announcement, AppNotification } from '../types';
import { notifyAllRoles, notifyUserByRole } from '../services/fcmService';
import { format, addDays, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

interface WaliAsuhViewProps {
  user: AppUser;
  activeTab: string;
}

export default function WaliAsuhView({ user, activeTab }: WaliAsuhViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [catatanKamar, setCatatanKamar] = useState<{ [key: string]: string }>({});
  const [newTindakan, setNewTindakan] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

    const [viewMode, setViewMode] = useState<'home' | 'perizinan' | 'pinjam_hp' | 'kartu_siswa' | 'permohonan_hp' | 'pinjam_laptop' | 'izin_umum' | 'memos' | 'pangkalan_data_wali_asuh' | 'mading'>('home');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportRange, setReportRange] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini'>('hari_ini');
  const [reportLoading, setReportLoading] = useState(false);

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
      color: "from-[#5d4037] to-[#3e2723]",
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
  const [showMenu, setShowMenu] = useState(false);
  const [pinjamHPList, setPinjamHPList] = useState<PinjamHP[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [showPinjamForm, setShowPinjamForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [filteredStudentsList, setFilteredStudentsList] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [studentSuggestions, setStudentSuggestions] = useState<Siswa[]>([]);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [selectedPinjam, setSelectedPinjam] = useState<PinjamHP | null>(null);
  
  const [phFilteredStudentsList, setPhFilteredStudentsList] = useState<Siswa[]>([]);
  const [phShowSuggestions, setPhShowSuggestions] = useState(false);
  
  // Pinjam HP Form states
  const [phNamaSiswa, setPhNamaSiswa] = useState('');
  const [phKelas, setPhKelas] = useState('X-1');
  const [phKeperluan, setPhKeperluan] = useState('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentData, setEditStudentData] = useState<Partial<Siswa>>({});

  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);

  const [hpRequests, setHpRequests] = useState<HPRequest[]>([]);
  const [hpRequestPdfLoading, setHpRequestPdfLoading] = useState<string | null>(null);

  const currentSelectedPermit = permits.find(p => p.id === selectedPermit?.id) || selectedPermit;

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

  const filteredPinjamHP = pinjamHPList
    .filter(item => {
      const pinjamDate = item.tgl_pinjam?.toDate();
      
      // Active borrowings (dipinjam) are ALWAYS shown regardless of time filter
      // to ensure all Wali Asuh can monitor and process returns.
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
    // Sort: 'dipinjam' status first, then by date descending
    .sort((a, b) => {
      if (a.status === 'dipinjam' && b.status !== 'dipinjam') return -1;
      if (a.status !== 'dipinjam' && b.status === 'dipinjam') return 1;
      const dateA = a.tgl_pinjam?.toDate()?.getTime() || 0;
      const dateB = b.tgl_pinjam?.toDate()?.getTime() || 0;
      return dateB - dateA;
    });

  const filteredStudents = students.filter(s => {
    const name = s.nama_lengkap || '';
    const nik = s.nik || '';
    const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                         nik.includes(studentSearchTerm);
    const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).sort()];

  const handleNamaSiswaChange = (value: string) => {
    setNamaSiswa(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setFilteredStudentsList(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredStudentsList([]);
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

  const handlePhNamaSiswaChange = (value: string) => {
    setPhNamaSiswa(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setPhFilteredStudentsList(filtered);
      setPhShowSuggestions(true);
    } else {
      setPhFilteredStudentsList([]);
      setPhShowSuggestions(false);
    }
  };

  const selectPhStudent = (student: Siswa) => {
    setPhNamaSiswa(student.nama_lengkap);
    setPhKelas(student.kelas);
    setPhShowSuggestions(false);
  };

  const handleStudentCardSearchChange = (value: string) => {
    setStudentSearchTerm(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setStudentSuggestions(filtered);
      setShowStudentSuggestions(true);
    } else {
      setStudentSuggestions([]);
      setShowStudentSuggestions(false);
    }
  };

  // Close suggestions on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowSuggestions(false);
        setShowStudentSuggestions(false);
        setPhShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form states for Izin Umum
  const [nomorSurat, setNomorSurat] = useState(`SRMA-U-${Date.now().toString().slice(-6)}`);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [alasan, setAlasan] = useState('');
  const [jumlahHari, setJumlahHari] = useState(1);
  const [tglMulai, setTglMulai] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [waliKelas, setWaliKelas] = useState(WALI_KELAS_LIST[0].name);

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('status', 'in', ['pending_asuh', 'pending_kelas', 'approved', 'pending_ack', 'acknowledged']),
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
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'wali_asuh'),
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
      collection(db, 'pinjam_hp'),
      orderBy('tgl_pinjam', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as PinjamHP;
        return { 
          id: doc.id, 
          ...rawData,
          kelas: normalizeKelas(rawData.kelas)
        } as PinjamHP;
      });
      setPinjamHPList(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'pinjam_hp');
    });

    // Auto-cleanup: Delete records older than 2 days
    const cleanupOldRecords = async () => {
      try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoTimestamp = Timestamp.fromDate(twoDaysAgo);
        
        const qCleanup = query(
          collection(db, 'pinjam_hp'), 
          where('tgl_pinjam', '<', twoDaysAgoTimestamp),
          where('wali_asuh_uid', '==', user.uid)
        );
        
        const snapshot = await getDocs(qCleanup);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        if (snapshot.docs.length > 0) {
          console.log(`Auto-cleanup: Deleted ${snapshot.docs.length} old Pinjam HP records.`);
        }
      } catch (err) {
        console.error('Auto-cleanup failed:', err);
      }
    };

    cleanupOldRecords();
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    // Remove orderBy to ensure docments without nama_lengkap field are also fetched
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
        // Sort client-side instead of in query to avoid skipping docs without the field
        .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
        
      setStudents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'siswa');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'laptop_requests'),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest));
      setLaptopRequests(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'laptop_requests');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'hp_requests'),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HPRequest));
      setHpRequests(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'hp_requests');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientRoles', 'array-contains', user.role),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, [user.role]);

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

  const handleSubmitUmum = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const startDate = new Date(tglMulai);
    const endDate = addDays(startDate, jumlahHari - 1);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'umum',
        nomor_surat: nomorSurat,
        nama_siswa: namaSiswa,
        kelas: kelas,
        alasan: alasan,
        jumlah_hari: jumlahHari,
        tgl_mulai: Timestamp.fromDate(startDate),
        tgl_selesai: Timestamp.fromDate(endDate),
        tgl_surat: serverTimestamp(),
        lokasi: 'Kediri',
        nama_wali_asuh: user.name,
        wali_asuh_uid: user.uid,
        nama_wali_kelas: waliKelas,
        status: 'pending_kelas', // Langsung ke Wali Kelas
      });

      // Notify relevant roles
      notifyAllRoles(['wali_kelas', 'kepala_sekolah'], 'Izin Umum Baru', `Wali Asuh ${user.name} membuat riwayat izin umum untuk ${namaSiswa}.`);

      setShowForm(false);
      // Reset form
      setNomorSurat(`SRMA-U-${Date.now().toString().slice(-6)}`);
      setNamaSiswa('');
      setAlasan('');
      setJumlahHari(1);
      alert('Izin umum berhasil dikirim ke Wali Kelas');
    } catch (err) {
      console.error('Error submitting izin umum:', err);
      alert('Gagal mengirim izin: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.WRITE, 'izin_sakit');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (permitId: string) => {
    const note = catatanKamar[permitId];
    if (!note) {
      alert('Mohon isi catatan kamar terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        catatan_kamar: note,
        status: 'pending_kelas',
        wali_asuh_uid: user.uid,
        nama_wali_asuh: user.name,
      });

      // Notify relevant roles
      notifyAllRoles(['wali_kelas', 'kepala_sekolah'], 'Persetujuan Izin Dibutuhkan', `Siswa di kelas Anda memerlukan persetujuan izin (Wali Asuh: ${user.name}).`);

      // Clear note for this permit
      const newNotes = { ...catatanKamar };
      delete newNotes[permitId];
      setCatatanKamar(newNotes);
      alert('Konfirmasi dikirim ke Wali Kelas');
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Gagal memperbarui status: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPinjamHP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phNamaSiswa || !phKeperluan) {
      alert('Mohon isi semua field');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'pinjam_hp'), {
        nama_siswa: phNamaSiswa,
        kelas: phKelas,
        keperluan: phKeperluan,
        tgl_pinjam: serverTimestamp(),
        status: 'dipinjam',
        wali_asuh_name: user?.name || 'Wali Asuh',
        wali_asuh_uid: user?.uid || '',
      });

      // Notify Wali Asuh & Kepala Sekolah
      notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Peminjaman HP Baru', `Siswa ${phNamaSiswa} meminjam HP (Wali Asuh: ${user.name}).`);

      setShowPinjamForm(false);
      setPhNamaSiswa('');
      setPhKeperluan('');
      setPhShowSuggestions(false);
      setPhFilteredStudentsList([]);
      alert('Berhasil menyimpan catatan peminjaman');
    } catch (err) {
      console.error('Error saving pinjam hp:', err);
      alert('Gagal menyimpan: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.WRITE, 'pinjam_hp');
    } finally {
      setLoading(false);
    }
  };

  const handleKembalikanHP = async (id: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'pinjam_hp', id), {
        status: 'dikembalikan',
        tgl_kembali: serverTimestamp(),
        penerima_kembali_name: user.name,
        penerima_kembali_uid: user.uid,
      });
      alert('Handphone telah dikembalikan');
    } catch (err) {
      console.error('Error returning hp:', err);
      alert('Gagal mengupdate status: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.UPDATE, `pinjam_hp/${id}`);
    } finally {
      setLoading(false);
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
          peran: 'Wali Asuh',
          pesan: newTindakan
        })
      });

      // Notify others about log activity
      notifyAllRoles(['dokter', 'wali_kelas', 'kepala_sekolah'], 'Update Riwayat Tindakan', `Wali Asuh ${user.name} menambahkan catatan tindakan untuk siswa.`);
      
      setNewTindakan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'siswa', selectedStudent.id), editStudentData);
      
      // Update local state is handled by onSnapshot
      setIsEditingStudent(false);
      setSelectedStudent({ ...selectedStudent, ...editStudentData } as Siswa);
      alert('Data siswa berhasil diperbarui di seluruh sistem.');
    } catch (err) {
      console.error('Error updating student:', err);
      alert('Gagal memperbarui data siswa: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.UPDATE, `siswa/${selectedStudent.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.link) {
      if (notif.link.startsWith('view:')) {
        setViewMode(notif.link.split(':')[1] as any);
      }
    }
    
    // Mark as read
    if (!notif.readBy.includes(user.uid)) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id!), {
          readBy: arrayUnion(user.uid)
        });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
    setShowNotifications(false);
  };

  const handleAcknowledgeCatatan = async (permitId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'acknowledged',
        wali_asuh_uid: user.uid,
        nama_wali_asuh: user.name,
        tgl_disetujui: Timestamp.now(),
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui catatan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLaptopStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'laptop_requests', requestId), {
        status,
        updatedAt: serverTimestamp()
      });

      const req = laptopRequests.find(r => r.id === requestId);
      if (req) {
        notifyAllRoles(['guru_mapel', 'kepala_sekolah'], `Status Pinjam Laptop ${status.toUpperCase()}`, `Permohonan laptop untuk kelas ${req.kelas} telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh Wali Asuh.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `laptop_requests/${requestId}`);
    } finally {
      setLoading(false);
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

  const handleUpdateHPRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'hp_requests', requestId), {
        status,
        updatedAt: serverTimestamp()
      });

      const req = hpRequests.find(r => r.id === requestId);
      if (req) {
        notifyAllRoles(['guru_mapel', 'kepala_sekolah'], `Status Pinjam HP ${status.toUpperCase()}`, `Permohonan HP untuk kelas ${req.kelas} telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh Wali Asuh.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `hp_requests/${requestId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHPRequestPDF = async (request: HPRequest) => {
    setHpRequestPdfLoading(request.id!);
    try {
      await generateHPRequestPDF(request);
    } catch (error) {
      console.error("PDF Error:", error);
    } finally {
      setHpRequestPdfLoading(null);
    }
  };

  const handleGenerateSummaryReport = async () => {
    setReportLoading(true);
    try {
      const filteredForReport = permits.filter(p => {
        const date = p.tgl_surat?.toDate();
        if (!date) return false;
        
        if (reportRange === 'hari_ini') return isToday(date);
        if (reportRange === 'kemarin') return isYesterday(date);
        if (reportRange === 'minggu_ini') return isThisWeek(date, { weekStartsOn: 1 });
        if (reportRange === 'bulan_ini') return isThisMonth(date);
        return false;
      });

      const rangeLabel = {
        hari_ini: 'Hari Ini',
        kemarin: 'Kemarin',
        minggu_ini: 'Minggu Ini',
        bulan_ini: 'Bulan Ini'
      }[reportRange];

      // Assuming generateSummaryReportPDF is imported from pdfUtils or available globaly
      const { generateSummaryReportPDF } = await import('../pdfUtils');
      await generateSummaryReportPDF(filteredForReport, rangeLabel, user.name);
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat laporan: ' + (err instanceof Error ? err.message : 'Error unknown'));
    } finally {
      setReportLoading(false);
    }
  };

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status === 'pending_asuh').length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length
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

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  if (activeTab === 'statistik') {
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

    const COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6'];

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-display">Statistik Wali Asuh</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Data kesehatan siswa asuhan Anda.</p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Tren Perizinan</h3>
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
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Top Diagnosa</h3>
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
  }

  const viewTitles: Record<string, string> = {
    home: 'Dashboard',
    izin_umum: 'Izin Umum',
    perizinan: 'Perizinan',
    pinjam_hp: 'Peminjaman HP',
    kartu_siswa: 'Kartu Siswa',
    pangkalan_data_wali_asuh: 'Pangkalan Data Wali Asuh',
    permohonan_hp: 'Permohonan HP',
    pinjam_laptop: 'Pinjam Laptop',
    memos: 'Memorandum',
    siswa: 'Daftar Siswa',
    settings: 'Pengaturan',
    mading: 'Mading Sekolah'
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
    'Review & Print Surat Perizinan',
    'Pangkalan Data Wali Asuh Terpadu',
    'Berbagi Catatan di Mading Sekolah'
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Sidebar Navigation */}
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
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'pangkalan_data_wali_asuh', label: 'Pangkalan Data', icon: Database },
                          { id: 'izin_umum', label: 'Izin Umum', icon: ShieldCheck },
                          { id: 'perizinan', label: 'Perizinan', icon: ClipboardList },
                          { id: 'kartu_siswa', label: 'Kartu Siswa', icon: IdCard },
                          { id: 'memos', label: 'Memorandum', icon: Mail },
                          { id: 'pinjam_hp', label: 'Peminjaman HP', icon: Smartphone },
                          { id: 'permohonan_hp', label: 'Permohonan HP', icon: MessageSquare },
                          { id: 'pinjam_laptop', label: 'Pinjam Laptop', icon: Laptop }
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

      {/* Top Header Navigation */}
      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'} backdrop-blur-xl border-b ${isDarkMode ? 'border-slate-800' : 'border-indigo-100/60'} shadow-[0_4px_20px_rgb(0,0,0,0.03)]`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-3 rounded-2xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 shadow-lg shadow-black/20' 
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm'
              } active:scale-95`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className={`text-sm font-black uppercase tracking-widest text-[#075e6e] leading-none mb-0.5`}>
                {viewTitles[viewMode] || 'SRMA 24'}
              </h1>
              <p className={`text-[9px] font-bold uppercase tracking-tighter opacity-50 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Digital Health System
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
             <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-full border border-slate-200/50 dark:border-slate-700/50">
               <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Status</span>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-3 rounded-2xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-700 shadow-lg shadow-black/20' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              } active:scale-95`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 shadow-lg shadow-black/20' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 shadow-sm'
                } active:scale-95 group`}
              >
                <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                {notifications.filter(n => !n.readBy.includes(user.uid)).length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 ring-2 ring-rose-500/20 animate-bounce">
                    {notifications.filter(n => !n.readBy.includes(user.uid)).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowNotifications(false)}
                      className="fixed inset-0 z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={`absolute right-0 mt-3 w-80 z-50 rounded-3xl shadow-2xl overflow-hidden border ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-indigo-50'
                      }`}
                    >
                      <div className="p-5 border-b border-slate-100/10 bg-indigo-600 flex items-center justify-between">
                        <h4 className="font-black text-white text-[10px] uppercase tracking-widest">Notifikasi Baru</h4>
                        <button 
                          onClick={() => setShowNotifications(false)}
                          className="p-1 hover:bg-white/10 rounded-full text-white transition-colors"
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </button>
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full p-4 flex items-start gap-4 hover:bg-[#fdfcf0] transition-colors text-left border-b border-[#f8f3ed] relative group ${
                                notif.readBy.includes(user.uid) ? 'opacity-60' : ''
                              }`}
                            >
                              {!notif.readBy.includes(user.uid) && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#5d4037]" />
                              )}
                              <div className={`p-2 rounded-xl shrink-0 ${
                                notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                notif.type === 'error' ? 'bg-rose-50 text-rose-600' :
                                notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                'bg-[#f8f3ed] text-[#5d4037]'
                              }`}>
                                {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                                 notif.type === 'error' ? <X className="w-4 h-4" /> :
                                 notif.type === 'warning' ? <Info className="w-4 h-4" /> :
                                 <Bell className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-black truncate text-[#3e2723] italic font-display">{notif.title}</h5>
                                <p className="text-[10px] line-clamp-2 mt-0.5 leading-relaxed text-[#8b5e3c]/80 font-medium">{notif.description}</p>
                                <span className="text-[8px] font-black text-[#8b5e3c]/40 mt-2 block uppercase tracking-widest italic">
                                  {notif.createdAt && typeof notif.createdAt.toDate === 'function' ? format(notif.createdAt.toDate(), 'HH:mm, dd MMM') : '-'}
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-10 text-center">
                            <Bell className="w-10 h-10 text-slate-100 mx-auto mb-3" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Belum ada notifikasi <br/>untuk saat ini</p>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="w-full py-4 bg-[#f8f3ed] text-[10px] font-black text-[#5d4037] uppercase tracking-widest hover:bg-[#ede8dd] transition-colors"
                      >
                        Tutup Panel
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button className="p-3 rounded-2xl transition-all duration-300 bg-[#3e2723] text-white shadow-xl shadow-black/20 hover:bg-black active:scale-95 ml-1">
              <User className="w-5 h-5 text-amber-200" />
            </button>
          </div>
        </div>
        {/* Subtle accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#8b5e3c] to-transparent opacity-30" />
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

      <div className={`p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24 space-y-8`}>
        {viewMode === 'mading' && <MadingSekolahView user={user} />}
        {viewMode === 'pangkalan_data_wali_asuh' && (
          <div className="h-[calc(100vh-140px)] w-full bg-white rounded-[3rem] shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 border border-slate-100">
            <iframe 
              src="https://app.box.com/s/3ogn8xtw84he8uxb1yfnvum9mgwpc7db"
              className="w-full h-full border-none"
              title="Pangkalan Data Wali Asuh"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-forms allow-modals allow-orientation-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
            />
          </div>
        )}

        {viewMode === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-gradient-to-br from-[#5d4037] to-[#3e2723] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group border-b-4 border-black/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <h1 className="text-3xl font-black font-display tracking-tight mb-2 italic">Halo, {user.name || user.email}</h1>
                <p className="text-lg font-black text-amber-100 flex items-center gap-2 mb-6 italic">
                  <ShieldCheck className="w-5 h-5 text-amber-200" />
                  {getRoleLabel(user.role || 'wali_asuh')}
                </p>
                
                <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 shadow-inner">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#fdfcf0] mb-4 flex items-center gap-2 italic">
                    <LayoutDashboard className="w-4 h-4 text-amber-200" />
                    Daftar Fitur Akun:
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {features.map((f, i) => (
                      <motion.li 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 text-xs font-black text-[#fdfcf0] italic"
                      >
                        <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                        {f}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black text-[#3e2723] font-display italic">Klik Menu Cepat:</h2>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setViewMode('perizinan')}
                  className="flex-1 py-4 px-6 bg-[#3e2723] text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                >
                  Lihat Perizinan
                </button>
                <button
                  onClick={() => setViewMode('kartu_siswa')}
                  className="flex-1 py-4 px-6 bg-[#5d4037] text-white font-black rounded-2xl shadow-xl hover:bg-[#3e2723] transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                >
                  Lihat Siswa
                </button>
              </div>
            </div>

            {/* Information Card */}
            <div className="bg-white rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm overflow-hidden">
              <div className="p-6 flex items-center justify-between border-b border-[#f8f3ed]">
                <h3 className="font-black text-lg text-[#3e2723] font-display italic tracking-tight">Informasi Wali Asuh</h3>
                <button className="px-6 py-2 bg-white border border-[#d7ccc8]/40 rounded-xl text-[10px] font-black text-[#8b5e3c] shadow-sm hover:bg-[#f8f3ed] transition-all uppercase tracking-widest">
                  Detail Profil
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex justify-between items-center group">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Nama Jabatan</span>
                    <span className="text-sm font-black text-[#3e2723] italic">Wali Asuh SRMA 24</span>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Link Dashboard</span>
                    <div className="flex items-center gap-2 p-3 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/30 group">
                      <p className="text-[10px] font-black text-[#5d4037] truncate flex-1 leading-none italic">
                        https://srma24kediri.app/dashboard/{user.uid}
                      </p>
                      <button className="p-1.5 bg-white rounded-lg shadow-sm text-[#8b5e3c] border border-[#d7ccc8]/20">
                        <ClipboardList className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Status Akun</span>
                    <span className="px-4 py-1.5 bg-[#3e2723] text-white text-[9px] font-black rounded-full uppercase tracking-widest">AKTIF</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Kategori Peran</span>
                    <span className="text-sm font-black text-[#3e2723] italic">Verifikator</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Tipe Akses</span>
                    <span className="text-sm font-black text-[#3e2723] italic">Full Access</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Verifikasi Email</span>
                    <span className="text-sm font-black text-[#3e2723] italic">{auth.currentUser?.emailVerified ? 'Sudah' : 'Belum'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Ulasan Sistem</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-4 h-4 fill-amber-500 text-amber-500" />
                      ))}
                      <span className="ml-2 text-sm font-black text-[#3e2723] italic">5.0</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#fdfcf0]/50 border-t border-[#f8f3ed]">
                <button
                  onClick={() => setViewMode('perizinan')}
                  className="px-6 py-3 bg-[#f8f3ed] text-[#5d4037] font-black rounded-xl shadow-sm hover:bg-[#d7ccc8]/20 transition-all text-[10px] uppercase tracking-widest"
                >
                  Lihat Data Dasbor
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'izin_umum' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} font-display uppercase tracking-tight`}>Layanan Izin Umum</h2>
                <p className={`text-sm font-bold opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-[0.1em] mt-1`}>Pengajuan Izin Keluar & Kegiatan Non-Medis</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                BUAT IZIN BARU
              </button>
            </div>

            {/* Feature Cards / Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Izin Pulang', desc: 'Keperluan keluarga atau mendesak', icon: Home, color: 'text-amber-800', bg: 'bg-amber-100' },
                { title: 'Izin Kegiatan', desc: 'Lomba atau acara luar sekolah', icon: Users, color: 'text-[#5d4037]', bg: 'bg-[#f8f3ed]' },
                { title: 'Izin Mendadak', desc: 'Keadaan darurat / force majeure', icon: Info, color: 'text-rose-800', bg: 'bg-rose-100' }
              ].map((f, i) => (
                <div key={i} className="p-6 rounded-[2.5rem] bg-white border border-[#d7ccc8]/40 shadow-sm">
                  <div className={`p-4 ${f.bg} ${f.color} rounded-2xl w-fit mb-4 border border-black/5`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] mb-2 text-[#3e2723] italic">{f.title}</h3>
                  <p className="text-[10px] font-bold leading-relaxed opacity-60 text-[#8b5e3c] italic uppercase tracking-tighter">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[3rem] border border-[#d7ccc8]/40 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-[#f8f3ed] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#f8f3ed] text-[#5d4037] rounded-xl border border-[#d7ccc8]/20">
                    <History className="w-5 h-5" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] text-[#3e2723] italic">Riwayat Izin Umum Anda</h3>
                </div>
              </div>
              
              <div className="divide-y divide-[#f8f3ed]">
                {permits.filter(p => p.tipe === 'umum').length > 0 ? (
                  permits.filter(p => p.tipe === 'umum').map((permit) => (
                    <div key={permit.id} className="p-6 hover:bg-[#fdfcf0] transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-[#f8f3ed] rounded-2xl flex items-center justify-center font-black text-[#d7ccc8] group-hover:bg-[#5d4037] group-hover:text-[#fdfcf0] transition-colors shadow-inner">
                          {permit.nama_siswa.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-[#3e2723] font-display italic tracking-tight">{permit.nama_siswa}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">{permit.kelas}</span>
                            <span className="w-1 h-1 bg-[#d7ccc8] rounded-full" />
                            <span className="text-[10px] font-black text-[#5d4037] uppercase tracking-widest italic">{permit.alasan}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#8b5e3c]/40">Status</p>
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mt-1 border shadow-sm ${
                            permit.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            permit.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {permit.status.replace('_', ' ')}
                          </span>
                        </div>
                        <button 
                          onClick={() => setSelectedPermit(permit)}
                          className="p-3 bg-white border border-[#d7ccc8]/40 rounded-2xl text-[#d7ccc8] hover:text-[#5d4037] shadow-sm transition-all hover:bg-[#f8f3ed]"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-[#f8f3ed] rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-[#d7ccc8]/40">
                      <ClipboardList className="w-8 h-8 text-[#d7ccc8]" />
                    </div>
                    <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest leading-relaxed">Belum ada riwayat izin umum<br/>yang Anda ajukan.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'perizinan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#3e2723] font-display italic">Rekapitulasi Data</h2>
                <p className="text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest mt-1 italic">Monitor & Cetak Laporan Kesehatan Siswa</p>
              </div>
              <button 
                onClick={() => setShowReportModal(true)}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-[#5d4037] text-white font-black rounded-3xl shadow-xl shadow-black/10 hover:bg-[#3e2723] transition-all active:scale-95 group border-b-4 border-black/20"
              >
                <Printer className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="uppercase tracking-widest text-xs">Pilihan Rekap</span>
              </button>
            </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Sakit Hari Ini */}
            <motion.div 
              whileHover={{ y: -4 }}
              onClick={() => setTimeFilter('hari_ini')}
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

            {/* Card 2: Sakit Kemarin */}
            <motion.div 
              whileHover={{ y: -4 }}
              onClick={() => setTimeFilter('kemarin')}
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

            {/* Card 3: Sakit Minggu Ini */}
            <motion.div 
              whileHover={{ y: -4 }}
              onClick={() => setTimeFilter('minggu_ini')}
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

            {/* Card 4: Sakit Bulan Ini */}
            <motion.div 
              whileHover={{ y: -4 }}
              onClick={() => setTimeFilter('bulan_ini')}
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

          {/* Riwayat Terakhir Header */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {(viewMode as string) === 'perizinan' ? 'Riwayat Perizinan' : (viewMode as string) === 'pinjam_hp' ? 'Riwayat HP Individu' : (viewMode as string) === 'permohonan_hp' ? 'Permohonan HP' : 'Permohonan Laptop'}
            </h2>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('perizinan')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  (viewMode as string) === 'perizinan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Izin
              </button>
              <button 
                onClick={() => setViewMode('pinjam_laptop')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  (viewMode as string) === 'pinjam_laptop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Laptop
              </button>
              <button 
                onClick={() => setViewMode('permohonan_hp')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  (viewMode as string) === 'permohonan_hp' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Req HP
              </button>
              <button 
                onClick={() => setViewMode('pinjam_hp')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  (viewMode as string) === 'pinjam_hp' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Pinjam HP
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Filters & Search - Restored */}
            <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
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
                className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-4 ${
                  timeFilter === cat.id
                    ? 'bg-[#5d4037] text-white shadow-xl shadow-black/10 border-black/20 translate-y-[-2px]'
                    : 'bg-white text-[#8b5e3c] border-[#d7ccc8]/40 hover:border-[#d7ccc8] border-b-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="bg-[#fdfcf0] p-6 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b5e3c]/40" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau nomor surat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-[#d7ccc8]/30 rounded-2xl focus:ring-2 focus:ring-[#5d4037] outline-none transition-all"
                />
              </div>
            </div>
          </div>
            </div>

          {/* Memorandum Section */}
          {memos.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Mail className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black">Memorandum dari Kepala Sekolah</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memos.map(memo => (
                  <div 
                    key={memo.id}
                    onClick={() => setSelectedMemo(memo)}
                    className="bg-orange-50 p-4 rounded-3xl border border-orange-100 border-l-8 border-l-orange-500 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-xl group-hover:scale-110 transition-transform">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-orange-600 transition-colors">{memo.perihal}</h4>
                        <p className="text-[10px] font-bold text-slate-500">{format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List Perizinan - Banner Style */}
          <div className="grid grid-cols-1 gap-3">
            {filteredPermits.map((permit) => (
              <motion.div 
                key={permit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedPermit(permit)}
                className={`group flex items-center gap-4 p-4 bg-white rounded-[2rem] shadow-sm border-l-8 hover:shadow-md transition-all cursor-pointer ${
                  permit.tipe === 'sakit' ? 'border-emerald-500 hover:border-emerald-600' :
                  permit.tipe === 'umum' ? 'border-blue-500 hover:border-blue-600' :
                  'border-amber-500 hover:border-amber-600'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  permit.tipe === 'sakit' ? 'bg-emerald-50 text-emerald-600' :
                  permit.tipe === 'umum' ? 'bg-blue-50 text-blue-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 truncate font-display">{permit.nama_siswa} ({permit.kelas})</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      permit.tipe === 'sakit' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      permit.tipe === 'umum' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {permit.tipe === 'sakit' ? 'Input Dokter' : permit.tipe === 'umum' ? 'Izin Wali Asuh' : 'Input Wali Kelas'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">• {permit.status === 'approved' || permit.status === 'acknowledged' ? 'Selesai' : 'Proses'}</span>
                  </div>
                  <p className="text-[9px] font-bold text-indigo-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                  </p>
                </div>
                <div className="text-slate-300 group-hover:text-amber-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}

            {permits.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Tidak Ada Data</h3>
                <p className="text-slate-500 text-sm mt-1">Belum ada perizinan yang dibuat.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

        {viewMode === 'pinjam_laptop' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {laptopRequests.map(req => (
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.nomor_surat}</p>
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

                <div className="pt-4 border-t border-slate-50 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateLaptopStatus(req.id!, 'rejected')}
                          disabled={loading}
                          className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleUpdateLaptopStatus(req.id!, 'approved')}
                          disabled={loading}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        >
                          Setujui
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleLaptopPDF(req)}
                    disabled={laptopPdfLoading === req.id}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    {laptopPdfLoading === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    Cetak PDF
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
        )}

        {viewMode === 'memos' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Memorandum</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pesan Resmi Manajemen Sekolah</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {memos.length > 0 ? (
                memos.map((memo) => (
                  <motion.div
                    key={memo.id}
                    layout
                    onClick={() => setSelectedMemo(memo)}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group cursor-pointer hover:shadow-xl hover:shadow-indigo-100 transition-all border-l-4 border-l-indigo-500"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 font-display leading-tight">{memo.pengirim_name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{memo.nomor_memo}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                        {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                      </div>
                    </div>

                    <div className="space-y-2">
                       <h5 className="text-sm font-black text-slate-900 line-clamp-1">{memo.perihal}</h5>
                       <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">{memo.isi}</p>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Buka Selengkapnya</span>
                      <ChevronRight className="w-4 h-4 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada memorandum masuk</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'permohonan_hp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {hpRequests.map(req => (
              <motion.div
                key={req.id}
                layout
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Tablet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 font-display leading-tight">Pinjam HP - {req.kelas}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.nomor_surat}</p>
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

                <div className="pt-4 border-t border-slate-50 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateHPRequestStatus(req.id!, 'rejected')}
                          disabled={loading}
                          className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleUpdateHPRequestStatus(req.id!, 'approved')}
                          disabled={loading}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        >
                          Setujui
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleHPRequestPDF(req)}
                    disabled={hpRequestPdfLoading === req.id}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    {hpRequestPdfLoading === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    Cetak Surat Izin HP
                  </button>
                </div>
              </motion.div>
            ))}
            {hpRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Tablet className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permohonan HP masuk</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'pinjam_hp' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Pinjam Handphone</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Monitoring Penggunaan Gadget</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setTimeFilter('hari_ini');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setShowPinjamForm(true)}
                  className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
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

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredPinjamHP.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedPinjam(item)}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${item.status === 'dipinjam' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 font-display">{item.nama_siswa}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas {item.kelas}</p>
                    </div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    item.status === 'dipinjam' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Keperluan</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{item.keperluan}</p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Pinjam: {item.tgl_pinjam && typeof item.tgl_pinjam.toDate === 'function' ? format(item.tgl_pinjam.toDate(), 'dd MMM, HH:mm') : '-'}
                    </div>
                    {item.status === 'dikembalikan' && item.tgl_kembali && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Kembali: {typeof item.tgl_kembali.toDate === 'function' ? format(item.tgl_kembali.toDate(), 'dd MMM, HH:mm') : '-'}
                      </div>
                    )}
                  </div>
                  {item.status === 'dipinjam' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKembalikanHP(item.id!);
                      }}
                      className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all active:scale-95"
                    >
                      Kembalikan
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Kembali: {item.tgl_kembali && typeof item.tgl_kembali.toDate === 'function' ? format(item.tgl_kembali.toDate(), 'HH:mm') : '-'}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {pinjamHPList.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada catatan peminjaman</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'kartu_siswa' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-6">
            <div className="px-1">
              <h2 className="text-2xl font-black text-[#3e2723] font-display tracking-tight italic">Kartu Siswa</h2>
              <p className="text-xs font-bold text-[#8b5e3c]/60 uppercase tracking-widest mt-2 italic">Data Lengkap Siswa Asuhan</p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b5e3c]/40 group-focus-within:text-[#5d4037] transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIK siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => handleStudentCardSearchChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-[#d7ccc8]/40 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-[#5d4037]/10 focus:border-[#5d4037] transition-all outline-none text-sm font-medium text-[#3e2723] placeholder:text-[#8b5e3c]/30"
                />
                <AnimatePresence>
                  {showStudentSuggestions && studentSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                    >
                      {studentSuggestions.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setStudentSearchTerm(student.nama_lengkap);
                            setShowStudentSuggestions(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                          </div>
                          <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
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

            {/* Student Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredStudents.map((student) => (
                <motion.div
                  key={student.id}
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStudent(student)}
                  className={`relative group cursor-pointer aspect-[1.6/1] w-full rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(79,70,229,0.1)] transition-all duration-500 border-2 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}
                >
                  {/* Premium Background Elements */}
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(93,64,55,1)_1px,transparent_0)] bg-[size:24px_24px]" />
                  </div>
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#8b5e3c]/5 rounded-full blur-[80px]" />
                  <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-[#5d4037]/5 rounded-full blur-[80px]" />
                  
                  {/* Decorative Side Label */}
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-[#fdfcf0] dark:bg-[#3e2723]/50 flex flex-col items-center justify-center border-l border-[#d7ccc8]/40">
                    <span className="rotate-90 text-[8px] font-black text-[#8b5e3c]/40 dark:text-[#8b5e3c]/20 uppercase tracking-[0.3em] whitespace-nowrap">
                      STUDENT • SRMA 24
                    </span>
                  </div>

                  {/* ID Card Header */}
                  <div className="h-16 bg-gradient-to-r from-[#5d4037] to-[#8b5e3c] px-8 flex items-center justify-between relative overflow-hidden">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg group-hover:scale-110 transition-transform duration-500">
                        <GraduationCap className="w-5 h-5 text-amber-200" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white leading-none uppercase tracking-tight">SRMA 24 KEDIRI</span>
                        <span className="text-[8px] font-bold text-amber-200/60 uppercase tracking-[0.2em] mt-1">SEKOLAH RAKYAT</span>
                      </div>
                    </div>
                    
                    <div className="relative z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">ACTIVE</span>
                    </div>
                  </div>

                  <div className="p-8 flex gap-8 items-start h-full pb-16">
                    {/* Professional Photo Frame */}
                    <div className="relative group/photo shrink-0">
                      <div className="w-28 h-32 bg-[#f8f3ed] dark:bg-[#3e2723] rounded-2xl overflow-hidden shadow-inner border-4 border-white dark:border-[#5d4037] flex flex-col items-center justify-center group-hover:border-[#d7ccc8] transition-colors duration-500">
                        <div className="text-3xl font-black text-[#d7ccc8]/80 dark:text-[#8b5e3c]/40">
                          {student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 p-1.5 bg-white dark:bg-[#3e2723] rounded-lg shadow-lg border border-[#d7ccc8]/40">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                    </div>

                    {/* Student Identity Core */}
                    <div className="flex-1 min-w-0 pt-2">
                      <h3 className={`text-lg font-black truncate font-display group-hover:text-[#8b5e3c] transition-colors duration-300 italic ${
                        isDarkMode ? 'text-white' : 'text-[#3e2723]'
                      }`}>
                        {student.nama_lengkap || 'Tanpa Nama'}
                      </h3>
                      
                      <div className="mt-5 space-y-4">
                        <div className="flex flex-col">
                          <label className="text-[7px] font-black text-[#8b5e3c]/60 dark:text-[#8b5e3c]/40 uppercase tracking-widest mb-1.5">Nomor Registrasi (NIK)</label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[12px] font-bold font-mono tracking-[0.1em] ${isDarkMode ? 'text-slate-300' : 'text-[#5d4037]'}`}>
                              {student.nik || 'XXXXXXXXXX'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col">
                            <label className="text-[7px] font-black text-[#8b5e3c]/60 dark:text-[#8b5e3c]/40 uppercase tracking-widest mb-1">Kelas</label>
                            <span className={`text-[12px] font-black ${isDarkMode ? 'text-[#c0b298]' : 'text-[#5d4037]'}`}>
                              {student.kelas}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[7px] font-black text-[#8b5e3c]/40 uppercase tracking-widest mb-1">Status</label>
                            <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-300' : 'text-[#3e2723]'}`}>
                              Residen
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ID Card Security Stripes & QR Placeholder */}
                  <div className="absolute bottom-6 left-8 right-16 flex items-center justify-between border-t border-[#d7ccc8]/20 pt-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 opacity-30">
                        <div className="w-12 h-2 bg-[#d7ccc8] dark:bg-[#5d4037] rounded-full" />
                        <Shield className="w-3 h-3 text-[#8b5e3c]" />
                      </div>
                      <p className="text-[6px] font-bold text-[#8b5e3c]/40 uppercase tracking-widest">Digital Student Passport • kediri</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 border-2 border-[#d7ccc8]/20 rounded-lg p-1.5 flex flex-wrap gap-1 opacity-40">
                         {[...Array(9)].map((_, i) => (
                           <div key={i} className={`w-1.5 h-1.5 rounded-sm ${i % 3 === 0 ? 'bg-[#8b5e3c]' : 'bg-[#d7ccc8]'}`} />
                         ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover Decoration */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#5d4037] scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top" />
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

        {/* Floating Action Button (FAB) */}
        {(viewMode === 'perizinan' || viewMode === 'pinjam_hp') && (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => viewMode === 'perizinan' ? setShowForm(true) : setShowPinjamForm(true)}
            className="fixed bottom-24 right-6 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[40]"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              {viewMode === 'perizinan' ? 'Buat Izin Baru' : 'Catat Pinjam HP'}
            </span>
          </motion.button>
        )}
      </div>

      {/* Modals are placed outside the main scroll container but inside the component root helper */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Siswa</label>
                  <p className="font-black text-slate-900 font-display">{currentSelectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900 font-display">{currentSelectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentSelectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Diagnosa Medis'}</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{currentSelectedPermit.tipe === 'umum' ? currentSelectedPermit.alasan : currentSelectedPermit.diagnosa}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Izin</label>
                  <p className="text-sm font-black text-slate-900 font-display">{currentSelectedPermit.jumlah_hari} Hari</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {currentSelectedPermit.tgl_mulai && typeof currentSelectedPermit.tgl_mulai.toDate === 'function' ? format(currentSelectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {currentSelectedPermit.tgl_selesai && typeof currentSelectedPermit.tgl_selesai.toDate === 'function' ? format(currentSelectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      currentSelectedPermit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      currentSelectedPermit.status === 'pending_kelas' ? 'bg-amber-100 text-amber-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {(currentSelectedPermit.status || '').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-bold text-slate-700">{currentSelectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-bold text-slate-700">{currentSelectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {currentSelectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-black">
                    <MapPin className="w-4 h-4" />
                    {currentSelectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {currentSelectedPermit.status === 'pending_ack' && (
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleAcknowledgeCatatan(currentSelectedPermit.id!)}
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Setujui & Tandatangani Catatan
                  </button>
                </div>
              )}

              {currentSelectedPermit.status === 'pending_asuh' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Konfirmasi & Catatan Kamar</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={catatanKamar[currentSelectedPermit.id!] || ''}
                      onChange={(e) => setCatatanKamar({ ...catatanKamar, [currentSelectedPermit.id!]: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[80px] font-medium"
                      placeholder="Contoh: Kamar 302, Kondisi stabil"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStatus(currentSelectedPermit.id!)}
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Konfirmasi & Kirim ke Wali Kelas
                  </button>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {currentSelectedPermit.tindakan && currentSelectedPermit.tindakan.length > 0 ? (
                    currentSelectedPermit.tindakan.map((t, idx) => (
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
                    placeholder="Tambah catatan tindakan..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                  <button
                    onClick={() => handleAddTindakan(currentSelectedPermit.id!)}
                    disabled={loading || !newTindakan.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                  >
                    <Send className="w-4 h-4" />
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
              {currentSelectedPermit && (
                <button
                  onClick={() => {
                    handleGeneratePDF(currentSelectedPermit);
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

      {/* Global Form Modal for Izin Umum */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-indigo-600 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,1)_1px,transparent_0)] bg-[size:16px_16px]" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-tight">Form Pengajuan Izin Umum</h3>
                  <p className="text-[10px] text-indigo-100 font-mono uppercase tracking-widest">{nomorSurat}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors text-white relative z-10"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitUmum} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Siswa</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={namaSiswa}
                        onChange={(e) => handleNamaSiswaChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="Cari nama siswa..."
                      />
                      <AnimatePresence>
                        {showSuggestions && filteredStudentsList.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                          >
                            {filteredStudentsList.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => selectStudent(student)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                                </div>
                                <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kelas & Wali Kelas</label>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</span>
                          <span className="text-xs font-black text-slate-900">{kelas}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Kelas</span>
                          <span className="text-xs font-black text-slate-900">{waliKelas}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keperluan Izin</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <textarea
                        required
                        value={alasan}
                        onChange={(e) => setAlasan(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[120px] text-sm"
                        placeholder="Contoh: Menghadiri pernikahan kakak kandung"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Durasi</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          min="1"
                          required
                          value={jumlahHari || ''}
                          onChange={(e) => setJumlahHari(parseInt(e.target.value) || 0)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mulai</label>
                      <input
                        type="date"
                        required
                        value={tglMulai}
                        onChange={(e) => setTglMulai(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-4">
                <Info className="w-5 h-5 text-indigo-500 mt-1" />
                <p className="text-[10px] font-bold text-indigo-600 leading-relaxed uppercase tracking-wider">
                  PENGAJUAN INI AKAN LANGSUNG TERKONEKSI KE WALI KELAS UNTUK MENDAPATKAN PERSETUJUAN AKHIR. PASTIKAN SEMUA DATA SUDAH BENAR.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  AJUKAN IZIN SEKARANG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Pinjam HP */}
      {selectedPinjam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Peminjaman HP</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Status: {selectedPinjam.status}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPinjam(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="text-center pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 font-display">{selectedPinjam.nama_siswa}</h2>
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-1">Kelas {selectedPinjam.kelas}</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Keperluan</label>
                  <p className="text-sm font-medium text-slate-700">{selectedPinjam.keperluan}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                    <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Waktu Pinjam</label>
                    <p className="text-xs font-black text-slate-900">{selectedPinjam.tgl_pinjam && typeof selectedPinjam.tgl_pinjam.toDate === 'function' ? format(selectedPinjam.tgl_pinjam.toDate(), 'dd MMM, HH:mm') : '-'}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Oleh: {selectedPinjam.wali_asuh_name}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                    <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Waktu Kembali</label>
                    <p className="text-xs font-black text-slate-900">{selectedPinjam.tgl_kembali && typeof selectedPinjam.tgl_kembali.toDate === 'function' ? format(selectedPinjam.tgl_kembali.toDate(), 'dd MMM, HH:mm') : '-'}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Oleh: {selectedPinjam.penerima_kembali_name || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPinjam(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-sm"
              >
                Tutup
              </button>
              {selectedPinjam.status === 'dipinjam' && (
                <button
                  onClick={() => {
                    handleKembalikanHP(selectedPinjam.id!);
                    setSelectedPinjam(null);
                  }}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all"
                >
                  Kembalikan
                </button>
              )}
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

      {/* Modal Form Pinjam HP */}
      {showPinjamForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Catat Pinjam HP</h3>
              </div>
              <button onClick={() => setShowPinjamForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPinjamHP} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Siswa</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={phNamaSiswa}
                    onChange={(e) => handlePhNamaSiswaChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Nama lengkap siswa"
                  />
                  <AnimatePresence>
                    {phShowSuggestions && phFilteredStudentsList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                      >
                        {phFilteredStudentsList.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectPhStudent(student)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                            </div>
                            <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kelas</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={phKelas}
                    onChange={(e) => setPhKelas(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                  >
                    {[
                      'X-1', 'X-2', 'X-3', 'X-4',
                      'XI-1', 'XI-2', 'XI-3', 'XI-4',
                      'XII-1', 'XII-2', 'XII-3', 'XII-4'
                    ].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keperluan Pinjam</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-4 w-4 h-4 text-slate-400" />
                  <textarea
                    required
                    value={phKeperluan}
                    onChange={(e) => setPhKeperluan(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
                    placeholder="Contoh: Menghubungi orang tua"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Catatan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-indigo-600 flex items-center justify-between relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,1)_1px,transparent_0)] bg-[size:16px_16px]" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-tight">
                    {isEditingStudent ? 'Edit Data Siswa' : 'Profil Lengkap Siswa'}
                  </h3>
                  <p className="text-[10px] text-indigo-100 font-mono uppercase tracking-widest">SRMA 24 KEDIRI • SEKOLAH RAKYAT</p>
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10">
                {!isEditingStudent && (
                  <button 
                    onClick={() => {
                      setIsEditingStudent(true);
                      setEditStudentData({ ...selectedStudent });
                    }}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Settings className="w-4 h-4" />
                    Edit Data
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedStudent(null);
                    setIsEditingStudent(false);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            </div>
            
            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {isEditingStudent ? (
                <div className="space-y-8">
                  {/* Edit Identity Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Identitas Dasar</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nama Lengkap</label>
                          <input 
                            type="text"
                            value={editStudentData.nama_lengkap || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, nama_lengkap: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">NIK</label>
                            <input 
                              type="text"
                              value={editStudentData.nik || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, nik: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Kelas</label>
                            <select 
                              value={editStudentData.kelas || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, kelas: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            >
                              {['X-1', 'X-2', 'X-3', 'X-4', 'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XII-1', 'XII-2', 'XII-3', 'XII-4'].map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Tempat Lahir</label>
                            <input 
                              type="text"
                              value={editStudentData.tempat_lahir || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, tempat_lahir: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Tanggal Lahir</label>
                            <input 
                              type="text"
                              value={editStudentData.tanggal_lahir || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, tanggal_lahir: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                              placeholder="DD-MM-YYYY"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Agama</label>
                            <input 
                              type="text"
                              value={editStudentData.agama || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, agama: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Umur</label>
                            <input 
                              type="number"
                              value={editStudentData.umur || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, umur: parseInt(e.target.value) || 0 })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Jenis Kelamin</label>
                            <select 
                              value={editStudentData.jenis_kelamin || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, jenis_kelamin: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            >
                              <option value="Laki-laki">Laki-laki</option>
                              <option value="Perempuan">Perempuan</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nomor KK</label>
                            <input 
                              type="text"
                              value={editStudentData.nomor_kk || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, nomor_kk: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Data Orang Tua</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nama Ayah</label>
                          <input 
                            type="text"
                            value={editStudentData.ayah || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, ayah: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nama Ibu</label>
                          <input 
                            type="text"
                            value={editStudentData.ibu || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, ibu: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Anak Ke</label>
                            <input 
                              type="number"
                              value={editStudentData.anak_ke || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, anak_ke: parseInt(e.target.value) || 1 })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Jumlah Saudara</label>
                            <input 
                              type="number"
                              value={editStudentData.saudara || ''}
                              onChange={(e) => setEditStudentData({ ...editStudentData, saudara: parseInt(e.target.value) || 1 })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Data Domisili</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Alamat Jalan</label>
                        <textarea 
                          value={editStudentData.alamat || ''}
                          onChange={(e) => setEditStudentData({ ...editStudentData, alamat: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold min-h-[80px]"
                          placeholder="Alamat lengkap..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">RT</label>
                          <input 
                            type="text"
                            value={editStudentData.rt || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, rt: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">RW</label>
                          <input 
                            type="text"
                            value={editStudentData.rw || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, rw: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Kelurahan</label>
                          <input 
                            type="text"
                            value={editStudentData.kelurahan || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, kelurahan: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Kecamatan</label>
                          <input 
                            type="text"
                            value={editStudentData.kecamatan || ''}
                            onChange={(e) => setEditStudentData({ ...editStudentData, kecamatan: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header Info */}
                  <div className="flex flex-col items-center text-center pb-6 border-b border-[#f8f3ed]">
                    <div className="w-24 h-24 bg-[#f8f3ed] rounded-[2.5rem] flex items-center justify-center text-[#5d4037] font-black text-4xl shadow-inner mb-4 relative group border border-[#d7ccc8]/20">
                      <User className="w-10 h-10" />
                      <div className="absolute inset-0 bg-[#5d4037]/0 group-hover:bg-[#5d4037]/10 transition-colors rounded-[2.5rem] flex items-center justify-center">
                        <Camera className="w-6 h-6 text-[#5d4037] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-black text-[#3e2723] font-display leading-tight italic tracking-tight">{selectedStudent.nama_lengkap || 'Tanpa Nama'}</h2>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-4 py-1.5 bg-[#3e2723] text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-black/10 italic">
                        Kelas {selectedStudent.kelas}
                      </span>
                      <span className="px-4 py-1.5 bg-[#f8f3ed] text-[#8b5e3c] text-[10px] font-black rounded-full uppercase tracking-widest border border-[#d7ccc8]/20 italic">
                        {selectedStudent.jenis_kelamin}
                      </span>
                    </div>
                  </div>

                  {/* Data Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Identitas Section */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-[#5d4037] uppercase tracking-[0.2em] mb-4 italic">Identitas Dasar</h4>
                      <div className="space-y-3">
                        <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                          <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">NIK Siswa</label>
                          <p className="text-sm font-black text-[#3e2723] font-mono tracking-wider">{selectedStudent.nik || '-'}</p>
                        </div>
                        <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                          <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Tempat, Tgl Lahir</label>
                          <p className="text-sm font-black text-[#3e2723] italic">{selectedStudent.tempat_lahir}, {selectedStudent.tanggal_lahir}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                            <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Agama</label>
                            <p className="text-sm font-black text-[#3e2723] italic">{selectedStudent.agama}</p>
                          </div>
                          <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                            <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Umur</label>
                            <p className="text-sm font-black text-[#3e2723] italic">{selectedStudent.umur} Tahun</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Keluarga Section */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-[#5d4037] uppercase tracking-[0.2em] mb-4 italic">Data Keluarga</h4>
                      <div className="space-y-3">
                        <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                          <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Nama Ayah</label>
                          <p className="text-sm font-black text-[#3e2723] italic">{selectedStudent.ayah || '-'}</p>
                        </div>
                        <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                          <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Nama Ibu</label>
                          <p className="text-sm font-black text-[#3e2723] italic">{selectedStudent.ibu || '-'}</p>
                        </div>
                        <div className="bg-[#fdfcf0] p-4 rounded-2xl border border-[#d7ccc8]/30">
                          <label className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest block mb-1">Anak Ke / Saudara</label>
                          <p className="text-sm font-black text-[#3e2723] italic tracking-tight">Anak ke-{selectedStudent.anak_ke || '-'} dari {selectedStudent.saudara || '-'} bersaudara</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alamat Section */}
                  <div className="space-y-4 pt-4 border-t border-[#f8f3ed]">
                    <h4 className="text-[10px] font-black text-[#5d4037] uppercase tracking-[0.2em] mb-4 italic">Alamat Domisili</h4>
                    <div className="bg-[#fdfcf0] p-6 rounded-[2rem] border border-[#d7ccc8]/40 shadow-inner space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#d7ccc8]/20">
                          <MapPin className="w-5 h-5 text-[#8b5e3c]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-[#3e2723] leading-relaxed italic">{selectedStudent.alamat || '-'}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-6">
                            <div>
                              <label className="text-[9px] font-black text-[#8b5e3c]/50 uppercase tracking-widest block mb-1 italic">RT / RW</label>
                              <p className="text-xs font-black text-[#5d4037] italic">{selectedStudent.rt || '00'} / {selectedStudent.rw || '00'}</p>
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-[#8b5e3c]/50 uppercase tracking-widest block mb-1 italic">Kelurahan</label>
                              <p className="text-xs font-black text-[#5d4037] italic">{selectedStudent.kelurahan || '-'}</p>
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-[#8b5e3c]/50 uppercase tracking-widest block mb-1 italic">Kecamatan</label>
                              <p className="text-xs font-black text-[#5d4037] italic">{selectedStudent.kecamatan || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-[#f8f3ed] border-t border-[#d7ccc8]/40 flex gap-3">
              {isEditingStudent ? (
                <>
                  <button
                    onClick={() => setIsEditingStudent(false)}
                    className="flex-1 py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#fdfcf0] transition-all shadow-sm uppercase tracking-widest text-[10px]"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleUpdateStudent}
                    disabled={loading}
                    className="flex-1 py-4 bg-[#5d4037] text-white font-black rounded-2xl hover:bg-[#3e2723] shadow-xl shadow-[#d7ccc8]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Simpan Perubahan
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-full py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#fdfcf0] transition-all shadow-sm uppercase tracking-widest text-[10px]"
                >
                  Tutup Profil
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border-b-8 border-[#5d4037]"
            >
              <div className="p-8 bg-[#5d4037] text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Printer className="w-6 h-6 text-amber-200" />
                  </div>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="text-2xl font-black font-display italic leading-tight">Pilih Rentang Laporan</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-100/60 mt-1 italic">Pilih periode data yang ingin dicetak</p>
              </div>

              <div className="p-8 space-y-4">
                {[
                  { id: 'hari_ini', label: 'Hari Ini', icon: Clock },
                  { id: 'kemarin', label: 'Kemarin', icon: History },
                  { id: 'minggu_ini', label: 'Minggu Ini', icon: Calendar },
                  { id: 'bulan_ini', label: 'Bulan Ini', icon: BarChart3 }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setReportRange(range.id as any)}
                    className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${
                      reportRange === range.id 
                        ? 'bg-[#fdfcf0] border-[#5d4037] shadow-xl shadow-[#5d4037]/5' 
                        : 'bg-white border-[#f8f3ed] hover:border-[#d7ccc8]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl transition-colors ${
                        reportRange === range.id ? 'bg-[#5d4037] text-white' : 'bg-[#f8f3ed] text-[#8b5e3c]'
                      }`}>
                        <range.icon className="w-5 h-5" />
                      </div>
                      <span className={`font-black uppercase tracking-widest text-[10px] ${
                        reportRange === range.id ? 'text-[#3e2723]' : 'text-[#8b5e3c]/60'
                      }`}>
                        {range.label}
                      </span>
                    </div>
                    {reportRange === range.id && (
                      <div className="w-2 h-2 bg-[#5d4037] rounded-full animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-8 bg-[#f8f3ed] border-t border-[#d7ccc8]/40 flex gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-4 bg-white border border-[#d7ccc8]/40 text-[#5d4037] font-black rounded-2xl hover:bg-white/80 transition-all uppercase tracking-widest text-[10px]"
                >
                  Batal
                </button>
                <button
                  disabled={reportLoading}
                  onClick={handleGenerateSummaryReport}
                  className="flex-1 py-4 bg-[#5d4037] text-white font-black rounded-2xl shadow-xl shadow-black/10 hover:bg-[#3e2723] transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                >
                  {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Cetak PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
