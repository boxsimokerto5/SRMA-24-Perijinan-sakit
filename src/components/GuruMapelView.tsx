import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { UserRole, AppUser, IzinSakit, WALI_KELAS_LIST, Memorandum, normalizeKelas, LaptopRequest, HPRequest, AppNotification, Announcement, Siswa } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2, Plus, MapPin, ClipboardList, CheckCircle2, MessageSquare, Send, Mail, ShieldCheck, Clock, BarChart3, Search, ChevronRight, Activity, Menu, IdCard, Laptop, Users, CheckSquare as CheckSquareIcon, Square, Tablet, GraduationCap, LayoutDashboard, Database, LogOut, BookOpen } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';
import { getDocs } from 'firebase/firestore';

interface GuruMapelViewProps {
  user: AppUser;
  activeTab: string;
}

export default function GuruMapelView({ user, activeTab }: GuruMapelViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [showCatatanForm, setShowCatatanForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [viewMode, setViewMode] = useState<string>('perizinan');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const viewTitles: Record<string, string> = {
    perizinan: 'Perizinan',
    kartu_siswa: 'Data Siswa',
    pinjam_laptop: 'Peminjaman Laptop',
    pinjam_hp: 'Peminjaman HP',
    memos: 'Memorandum',
    profil: 'Profil Saya',
    mading: 'Mading Sekolah',
    riwayat_sakit: 'Perizinan Sakit'
  };
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);

  const [students, setStudents] = useState<Siswa[]>([]);
  const [filteredStudentsList, setFilteredStudentsList] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [isiCatatan, setIsiCatatan] = useState('');

  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [selectedStudentsForLaptop, setSelectedStudentsForLaptop] = useState<string[]>([]);
  const [laptopKelas, setLaptopKelas] = useState('X-1');
  const [isSubmittingLaptop, setIsSubmittingLaptop] = useState(false);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);

  const [hpRequests, setHpRequests] = useState<HPRequest[]>([]);
  const [selectedStudentsForHP, setSelectedStudentsForHP] = useState<string[]>([]);
  const [hpKelas, setHpKelas] = useState('X-1');
  const [isSubmittingHP, setIsSubmittingHP] = useState(false);
  const [hpPdfLoading, setHpPdfLoading] = useState<string | null>(null);

  const CLASSES = ['X-1', 'X-2', 'X-3', 'X-4', 'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XII-1', 'XII-2', 'XII-3', 'XII-4'];

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

  // Find current teacher's class - For Subject Teacher we might show all or handle differently, 
  // but keeping same logic as per "exactly like"
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
    setShowSuggestions(false);
  };

  // Close suggestions on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowSuggestions(false);
      }
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
      setPermits(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'izin_sakit');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'guru_mapel'),
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
      collection(db, 'laptop_requests'),
      where('guru_uid', '==', user.uid),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest));
      setLaptopRequests(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'laptop_requests');
    });
    return () => unsubscribe();
  }, [user.uid]);

  React.useEffect(() => {
    const q = query(
      collection(db, 'hp_requests'),
      where('guru_uid', '==', user.uid),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HPRequest));
      setHpRequests(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'hp_requests');
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleApprove = async (permitId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'approved',
        wali_kelas_uid: user.uid,
      });

      // Notify relevant roles
      notifyAllRoles(['dokter', 'wali_asuh', 'kepala_sekolah'], 'Izin Disetujui', `Izin sakit siswa telah disetujui oleh Guru Mapel ${user.name}.`);
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
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'catatan',
        nomor_surat: `SRMA-GM-${Date.now().toString().slice(-6)}`,
        nama_siswa: namaSiswa,
        kelas: kelas,
        isi_catatan: isiCatatan,
        tgl_surat: serverTimestamp(),
        nama_wali_kelas: user.name, // Still using this field for compatibility
        wali_kelas_uid: user.uid,
        status: 'pending_ack',
      });

      // Notify relevant roles
      notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Catatan Siswa Baru', `Guru Mapel ${user.name} mengirimkan catatan penting untuk siswa ${namaSiswa}.`);

      setShowCatatanForm(false);
      setNamaSiswa('');
      setIsiCatatan('');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim catatan');
    } finally {
      setLoading(false);
    }
  };

  const handleLaptopRequestPDF = async (request: LaptopRequest) => {
    setLaptopPdfLoading(request.id!);
    try {
      await generateLaptopRequestPDF(request);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setLaptopPdfLoading(null);
    }
  };

  const handleToggleStudentSelection = (studentName: string) => {
    setSelectedStudentsForLaptop(prev => 
      prev.includes(studentName) 
        ? prev.filter(name => name !== studentName)
        : [...prev, studentName]
    );
  };

  const handleSelectAllInClass = () => {
    const studentsInClass = students
      .filter(s => s.kelas === laptopKelas)
      .map(s => s.nama_lengkap);
    
    // If all are already selected, deselect them
    const allSelected = studentsInClass.every(name => selectedStudentsForLaptop.includes(name));
    
    if (allSelected) {
      setSelectedStudentsForLaptop(prev => prev.filter(name => !studentsInClass.includes(name)));
    } else {
      setSelectedStudentsForLaptop(prev => Array.from(new Set([...prev, ...studentsInClass])));
    }
  };

  const handleSubmitLaptopRequest = async () => {
    if (selectedStudentsForLaptop.length === 0) {
      alert('Pilih setidaknya satu siswa.');
      return;
    }

    setIsSubmittingLaptop(true);
    try {
      const docRef = await addDoc(collection(db, 'laptop_requests'), {
        nomor_surat: `REQ-LP-${user.uid.substring(0, 4)}-${Date.now().toString().slice(-4)}`,
        tgl_request: serverTimestamp(),
        guru_name: user.name,
        guru_uid: user.uid,
        mapel: user.mapel || 'Guru Mapel',
        kelas: laptopKelas,
        daftar_siswa: selectedStudentsForLaptop,
        status: 'pending'
      });

      // Notify Wali Asuh and Kepala Sekolah
      await notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Permohonan Pinjam Laptop', `Guru Mapel ${user.name} mengajukan peminjaman laptop untuk ${selectedStudentsForLaptop.length} siswa kelas ${laptopKelas}.`);

      alert('Permohonan berhasil dikirim!');
      setSelectedStudentsForLaptop([]);
      setViewMode('perizinan');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim permohonan');
    } finally {
      setIsSubmittingLaptop(false);
    }
  };

  const handleHPRequestPDF = async (request: HPRequest) => {
    setHpPdfLoading(request.id!);
    try {
      await generateHPRequestPDF(request);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setHpPdfLoading(null);
    }
  };

  const handleToggleStudentSelectionHP = (studentName: string) => {
    setSelectedStudentsForHP(prev => 
      prev.includes(studentName) 
        ? prev.filter(name => name !== studentName)
        : [...prev, studentName]
    );
  };

  const handleSelectAllInClassHP = () => {
    const studentsInClass = students
      .filter(s => s.kelas === hpKelas)
      .map(s => s.nama_lengkap);
    
    // If all are already selected, deselect them
    const allSelected = studentsInClass.every(name => selectedStudentsForHP.includes(name));
    
    if (allSelected) {
      setSelectedStudentsForHP(prev => prev.filter(name => !studentsInClass.includes(name)));
    } else {
      setSelectedStudentsForHP(prev => Array.from(new Set([...prev, ...studentsInClass])));
    }
  };

  const handleSubmitHPRequest = async () => {
    if (selectedStudentsForHP.length === 0) {
      alert('Pilih setidaknya satu siswa.');
      return;
    }

    setIsSubmittingHP(true);
    try {
      const docRef = await addDoc(collection(db, 'hp_requests'), {
        nomor_surat: `REQ-HP-${user.uid.substring(0, 4)}-${Date.now().toString().slice(-4)}`,
        tgl_request: serverTimestamp(),
        guru_name: user.name,
        guru_uid: user.uid,
        mapel: user.mapel || 'Guru Mapel',
        kelas: hpKelas,
        daftar_siswa: selectedStudentsForHP,
        status: 'pending'
      });

      // Notify Wali Asuh and Kepala Sekolah
      await notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Permohonan Pinjam HP', `Guru Mapel ${user.name} mengajukan peminjaman HP untuk ${selectedStudentsForHP.length} siswa kelas ${hpKelas}.`);

      alert('Permohonan berhasil dikirim!');
      setSelectedStudentsForHP([]);
      setViewMode('perizinan');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim permohonan');
    } finally {
      setIsSubmittingHP(false);
    }
  };

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status === 'pending_kelas').length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length
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
    'Print Surat Izin & Memorandum',
    'Permohonan Pinjam Laptop & HP',
    'Berbagi Catatan di Mading Sekolah'
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#3e2723]' : 'bg-[#f8f3ed]'}`}>
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
              className="fixed inset-y-0 left-0 w-[280px] bg-[#5d4037] text-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  <div className="bg-[#3e2723] rounded-3xl p-5 mb-8 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-4 relative z-10">
                      <Logo size="sm" showText={false} className="shadow-xl" />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-base leading-tight tracking-tight uppercase italic">SRMA 24 KEDIRI</span>
                        <span className="text-[10px] font-bold text-amber-200/60 uppercase tracking-widest mt-0.5 opacity-70 italic">SEKOLAH RAKYAT</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <p className="text-[10px] font-black text-amber-200/40 uppercase tracking-[0.2em] mb-4 px-2">NAVIGASI UTAMA</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'perizinan', label: 'Dashboard', icon: LayoutDashboard },
                          { id: 'mading', label: 'Mading Sekolah', icon: BookOpen },
                          { id: 'riwayat_sakit', label: 'Perizinan Sakit', icon: Activity },
                          { id: 'pinjam_laptop', label: 'Pinjam Laptop', icon: Laptop },
                          { id: 'pinjam_hp', label: 'Pinjam HP', icon: Tablet },
                          { id: 'kartu_siswa', label: 'Kartu Siswa', icon: IdCard },
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
                                ? 'bg-white text-[#5d4037] shadow-xl shadow-black/10 translate-x-2' 
                                : 'bg-transparent text-white/70 hover:bg-[#3e2723] hover:text-white'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${viewMode === item.id ? 'text-[#5d4037]' : 'text-white/40'}`} />
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
                <p className="text-[10px] font-black text-amber-200/40 uppercase tracking-[0.2em] mb-4 px-2 italic">Pengaturan</p>
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-4 px-6 py-4 bg-[#3e2723] text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg border border-white/5 active:scale-95"
                >
                  <LogOut className="w-5 h-5 text-amber-200" />
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-[#3e2723]/90' : 'bg-white/90'} backdrop-blur-xl border-b ${isDarkMode ? 'border-[#d7ccc8]/10' : 'border-[#d7ccc8]/40'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-3 bg-[#f8f3ed] text-[#5d4037] rounded-2xl border border-[#d7ccc8]/40 shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#5d4037] italic">
              {viewTitles[viewMode] || 'SRMA 24'}
            </h1>
          </div>
        </div>
      </header>

      <div className={`p-4 sm:p-6 ${viewMode === 'mading' ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-24 space-y-8`}>
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}

        {viewMode === 'kartu_siswa' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-6">
            <div className="px-1">
              <h2 className="text-2xl font-black text-[#3e2723] font-display tracking-tight italic">Data Siswa</h2>
              <p className="text-xs font-black text-[#8b5e3c]/60 uppercase tracking-widest mt-1 italic">Daftar Lengkap Siswa</p>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b5e3c]/40 group-focus-within:text-[#5d4037] transition-colors" />
              <input
                type="text"
                placeholder="Cari nama atau NIK siswa..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-[#d7ccc8]/40 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-[#5d4037]/10 focus:border-[#5d4037] transition-all outline-none text-sm font-medium text-[#3e2723] placeholder:text-[#8b5e3c]/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <motion.div
                  key={student.id}
                  whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                  onClick={() => setSelectedStudent(student)}
                  className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm flex flex-col gap-4 group cursor-pointer hover:border-[#8b5e3c] transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#f8f3ed] rounded-full -mr-12 -mt-12 group-hover:bg-[#5d4037] transition-colors duration-500" />
                  
                  <div className="flex items-center gap-4 relative">
                    <div className="w-16 h-16 bg-[#f8f3ed] rounded-2xl flex items-center justify-center text-[#5d4037] font-black text-xl shadow-inner group-hover:scale-110 transition-all duration-500 border border-[#d7ccc8]/20">
                      {student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black text-[#3e2723] truncate font-display group-hover:text-[#8b5e3c] transition-colors italic">{student.nama_lengkap || 'Tanpa Nama'}</h3>
                      <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">NIK: {student.nik}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between relative">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kelas</p>
                      <p className="text-xs font-bold text-slate-600">{student.kelas || '-'}</p>
                    </div>
                    <div className="p-2 bg-[#fdfcf0] rounded-xl text-[#d7ccc8] group-hover:text-white group-hover:bg-[#5d4037] transition-all shadow-sm border border-[#d7ccc8]/40">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {filteredStudents.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-[#d7ccc8]">
                  <Search className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                  <p className="text-[#8b5e3c]/40 font-black uppercase tracking-widest text-[10px] italic">Siswa tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'pinjam_laptop' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#3e2723] font-display tracking-tight italic">Permohonan Laptop</h2>
            <p className="text-xs font-black text-[#8b5e3c]/60 uppercase tracking-widest mt-1 italic">Pinjaman Laptop untuk Siswa</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest ml-1">Pilih Kelas</label>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setLaptopKelas(c);
                      setSelectedStudentsForLaptop([]);
                    }}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      laptopKelas === c
                        ? 'bg-[#5d4037] text-white shadow-lg shadow-black/10'
                        : 'bg-[#fdfcf0] text-[#8b5e3c] border border-[#d7ccc8]/20 hover:border-[#8b5e3c]/40'
                    }`}
                  >
                    Kelas {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest">Daftar Siswa Kelas {laptopKelas}</label>
                <button 
                  onClick={handleSelectAllInClass}
                  className="text-[10px] font-black text-[#5d4037] uppercase tracking-widest hover:underline"
                >
                  Pilih Semua
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {students.filter(s => s.kelas === laptopKelas).map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleToggleStudentSelection(student.nama_lengkap)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                      selectedStudentsForLaptop.includes(student.nama_lengkap)
                        ? 'bg-[#f8f3ed] border-[#5d4037] text-[#3e2723]'
                        : 'bg-[#fdfcf0] border-[#d7ccc8]/20 text-[#8b5e3c] hover:border-[#8b5e3c]/40'
                    }`}
                  >
                    {selectedStudentsForLaptop.includes(student.nama_lengkap) ? (
                      <CheckSquareIcon className="w-5 h-5 text-[#5d4037]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#d7ccc8]" />
                    )}
                    <span className="text-sm font-black italic">{student.nama_lengkap}</span>
                  </button>
                ))}
                {students.filter(s => s.kelas === laptopKelas).length === 0 && (
                  <div className="col-span-full py-10 text-center bg-[#fdfcf0] rounded-2xl border border-dashed border-[#d7ccc8]">
                    <p className="text-[#8b5e3c]/40 font-black text-[10px] uppercase tracking-widest italic">Tidak ada siswa di kelas ini</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-[#d7ccc8]/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest italic">Siswa Terpilih</p>
                  <p className="text-xl font-black text-[#5d4037] italic">{selectedStudentsForLaptop.length} <span className="text-xs text-[#8b5e3c]/40 uppercase italic tracking-tighter">Siswa</span></p>
                </div>
                <button
                  onClick={handleSubmitLaptopRequest}
                  disabled={isSubmittingLaptop || selectedStudentsForLaptop.length === 0}
                  className="px-8 py-4 bg-[#5d4037] text-white font-black rounded-2xl shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {isSubmittingLaptop ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-amber-200" />
                  )}
                  Kirim Permohonan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'pinjam_hp' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#3e2723] font-display tracking-tight italic">Permohonan HP</h2>
            <p className="text-xs font-black text-[#8b5e3c]/60 uppercase tracking-widest mt-1 italic">Pinjaman HP untuk Siswa</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest ml-1">Pilih Kelas</label>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setHpKelas(c);
                      setSelectedStudentsForHP([]);
                    }}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      hpKelas === c
                        ? 'bg-[#5d4037] text-white shadow-lg shadow-black/10'
                        : 'bg-[#fdfcf0] text-[#8b5e3c] border border-[#d7ccc8]/20 hover:border-[#8b5e3c]/40'
                    }`}
                  >
                    Kelas {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest">Daftar Siswa Kelas {hpKelas}</label>
                <button 
                  onClick={handleSelectAllInClassHP}
                  className="text-[10px] font-black text-[#5d4037] uppercase tracking-widest hover:underline"
                >
                  Pilih Semua
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {students.filter(s => s.kelas === hpKelas).map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleToggleStudentSelectionHP(student.nama_lengkap)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                      selectedStudentsForHP.includes(student.nama_lengkap)
                        ? 'bg-[#f8f3ed] border-[#5d4037] text-[#3e2723]'
                        : 'bg-[#fdfcf0] border-[#d7ccc8]/20 text-[#8b5e3c] hover:border-[#8b5e3c]/40'
                    }`}
                  >
                    {selectedStudentsForHP.includes(student.nama_lengkap) ? (
                      <CheckSquareIcon className="w-5 h-5 text-[#5d4037]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#d7ccc8]" />
                    )}
                    <span className="text-sm font-black italic">{student.nama_lengkap}</span>
                  </button>
                ))}
                {students.filter(s => s.kelas === hpKelas).length === 0 && (
                  <div className="col-span-full py-10 text-center bg-[#fdfcf0] rounded-2xl border border-dashed border-[#d7ccc8]">
                    <p className="text-[#8b5e3c]/40 font-black text-[10px] uppercase tracking-widest italic">Tidak ada siswa di kelas ini</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-[#d7ccc8]/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest italic">Siswa Terpilih</p>
                  <p className="text-xl font-black text-[#5d4037] italic">{selectedStudentsForHP.length} <span className="text-xs text-[#8b5e3c]/40 uppercase italic tracking-tighter">Siswa</span></p>
                </div>
                <button
                  onClick={handleSubmitHPRequest}
                  disabled={isSubmittingHP || selectedStudentsForHP.length === 0}
                  className="px-8 py-4 bg-[#5d4037] text-white font-black rounded-2xl shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {isSubmittingHP ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-amber-200" />
                  )}
                  Kirim Permohonan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Section */}
      {viewMode === 'perizinan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-gradient-to-br from-[#5d4037] to-[#3e2723] p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden group border-b-4 border-black/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
            <div className="relative z-10">
                      <h1 className="text-3xl font-black font-display tracking-tight mb-2 italic">Halo, {user.name || user.email}</h1>
              <p className="text-lg font-black text-amber-100 flex items-center gap-2 mb-6 italic">
                <ShieldCheck className="w-5 h-5 text-amber-200" />
                {getRoleLabel(user.role || 'guru_mapel')} • {user.mapel || 'Guru Mapel'}
              </p>
              
              <div className="bg-black/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#d7ccc8] mb-4 flex items-center gap-2 italic">
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
                      className="flex items-center gap-3 text-sm font-black text-white/90 italic"
                    >
                      <div className="w-2 h-2 bg-amber-200 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                      {f}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 group"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-4xl font-black font-display tracking-tight text-[#3e2723] italic">{stats.total}</h3>
                  <div className="bg-[#f8f3ed] p-2.5 rounded-2xl border border-[#d7ccc8]/20">
                    <ClipboardList className="w-6 h-6 text-[#5d4037]" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-[#8b5e3c]/40 italic">Total<br />Perizinan</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 group"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-4xl font-black font-display tracking-tight text-[#3e2723] italic">{stats.selesai}</h3>
                  <div className="bg-[#f8f3ed] p-2.5 rounded-2xl border border-[#d7ccc8]/20">
                    <CheckCircle2 className="w-6 h-6 text-[#5d4037]" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-[#8b5e3c]/40 italic">Izin<br />Selesai</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 group"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-4xl font-black font-display tracking-tight text-[#3e2723] italic">{stats.pending}</h3>
                  <div className="bg-[#f8f3ed] p-2.5 rounded-2xl border border-[#d7ccc8]/20">
                    <Clock className="w-6 h-6 text-[#5d4037]" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-[#8b5e3c]/40 italic">Perlu<br />Persetujuan</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 group"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-4xl font-black font-display tracking-tight text-[#3e2723] italic">{stats.memos}</h3>
                  <div className="bg-[#f8f3ed] p-2.5 rounded-2xl border border-[#d7ccc8]/20">
                    <Mail className="w-6 h-6 text-[#5d4037]" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-[#8b5e3c]/40 italic">Memo<br />Kepala Sekolah</p>
              </div>
            </motion.div>
          </div>

          {/* Petunjuk Penggunaan */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#fdfcf0] text-[#5d4037] rounded-2xl border border-[#d7ccc8]/20 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3e2723] font-display italic tracking-tight">Petunjuk Penggunaan Aplikasi</h3>
                <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest italic">Panduan Singkat Guru Mapel</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/20 flex gap-4 items-start shadow-sm hover:border-[#8b5e3c]/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#5d4037] shadow-sm shrink-0 border border-[#d7ccc8]/20 italic">1</div>
                <div>
                  <p className="text-xs font-black text-[#3e2723] italic">Pantau Perizinan Sakit</p>
                  <p className="text-[10px] text-[#8b5e3c] leading-relaxed mt-1 font-medium">Gunakan menu "Perizinan Sakit" untuk melihat siswa yang sedang izin sakit resmi dari dokter.</p>
                </div>
              </div>
              <div className="p-5 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/20 flex gap-4 items-start shadow-sm hover:border-[#8b5e3c]/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#5d4037] shadow-sm shrink-0 border border-[#d7ccc8]/20 italic">2</div>
                <div>
                  <p className="text-xs font-black text-[#3e2723] italic">Pinjam Fasilitas</p>
                  <p className="text-[10px] text-[#8b5e3c] leading-relaxed mt-1 font-medium">Gunakan menu Pinjam Laptop/HP untuk mengajukan penggunaan fasilitas sekolah saat KBM.</p>
                </div>
              </div>
              <div className="p-5 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/20 flex gap-4 items-start shadow-sm hover:border-[#8b5e3c]/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#5d4037] shadow-sm shrink-0 border border-[#d7ccc8]/20 italic">3</div>
                <div>
                  <p className="text-xs font-black text-[#3e2723] italic">Cek Data Siswa</p>
                  <p className="text-[10px] text-[#8b5e3c] leading-relaxed mt-1 font-medium">Cari data lengkap siswa seperti NIK atau Alamat pada menu Kartu Siswa jika diperlukan.</p>
                </div>
              </div>
              <div className="p-5 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/20 flex gap-4 items-start shadow-sm hover:border-[#8b5e3c]/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#5d4037] shadow-sm shrink-0 border border-[#d7ccc8]/20 italic">4</div>
                <div>
                  <p className="text-xs font-black text-[#3e2723] italic">Menu Memorandum</p>
                  <p className="text-[10px] text-[#8b5e3c] leading-relaxed mt-1 font-medium">Selalu cek menu Memorandum untuk pengumuman atau instruksi resmi dari pimpinan sekolah.</p>
                </div>
              </div>
            </div>
          </div>

          {memos.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Mail className="w-5 h-5 text-[#5d4037]" />
                <h3 className="text-sm font-black text-[#3e2723] uppercase tracking-widest italic tracking-tight">Memorandum Intern</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {memos.map(memo => (
                  <motion.div 
                    key={memo.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                    onClick={() => setSelectedMemo(memo)}
                    className="bg-white p-5 rounded-[2rem] border border-[#d7ccc8]/40 shadow-sm hover:shadow-md hover:border-[#8b5e3c] transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#fdfcf0] text-[#5d4037] rounded-2xl group-hover:scale-110 transition-transform border border-[#d7ccc8]/20">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#3e2723] font-display group-hover:text-[#5d4037] transition-colors italic">{memo.perihal}</h4>
                        <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest mt-0.5 italic">{format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                    <div className="p-2 bg-[#fdfcf0] rounded-xl text-[#d7ccc8] group-hover:text-[#5d4037] transition-all border border-[#d7ccc8]/10">
                      <Plus className="w-4 h-4" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* New Catatan Button */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCatatanForm(true)}
            className="fixed bottom-24 right-6 bg-indigo-950 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 z-30 transition-all"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-widest">Buat Catatan Baru</span>
          </motion.button>
        </div>
      )}

      {/* Facility History Section - Refactored */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-black text-slate-900 font-display">
            {viewMode === 'pinjam_laptop' ? 'Riwayat Laptop Saya' : 'Riwayat HP Saya'}
          </h3>
          {/* Removed History Tabs */}
        </div>

        {/* perizinan history removed from this section */}

        {viewMode === 'pinjam_laptop' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {laptopRequests.map(req => (
              <motion.div
                key={req.id}
                layout
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#f8f3ed] text-[#5d4037] rounded-2xl border border-[#d7ccc8]/30">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-[#3e2723] font-display italic">Pinjam Laptop - {req.kelas}</h4>
                      <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">{req.nomor_surat}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    req.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-[#fdfcf0] text-[#8b5e3c] border-[#d7ccc8]/40'
                  }`}>
                    {req.status}
                  </div>
                </div>

                <div className="py-1">
                  <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest mb-2">Daftar Siswa</p>
                  <p className="text-sm font-bold text-[#5d4037] leading-relaxed">
                    {req.daftar_siswa.join(', ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#f8f3ed] flex items-center justify-between">
                  <div className="text-[10px] text-[#8b5e3c]/60 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                  </div>
                  <button
                    onClick={() => handleLaptopRequestPDF(req)}
                    disabled={laptopPdfLoading === req.id}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#3e2723] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-black/10"
                  >
                    {laptopPdfLoading === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5 text-amber-200" />
                    )}
                    Cetak PDF
                  </button>
                </div>
              </motion.div>
            ))}
            {laptopRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-[#d7ccc8]">
                <Laptop className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                <p className="text-[#8b5e3c]/40 font-black uppercase tracking-widest text-[10px] italic">Belum ada riwayat permohonan</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'pinjam_hp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hpRequests.map(req => (
              <motion.div
                key={req.id}
                layout
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#f8f3ed] text-[#5d4037] rounded-2xl border border-[#d7ccc8]/30">
                      <Tablet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-[#3e2723] font-display italic">Pinjam HP - {req.kelas}</h4>
                      <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">{req.nomor_surat}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    req.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-[#fdfcf0] text-[#8b5e3c] border-[#d7ccc8]/40'
                  }`}>
                    {req.status}
                  </div>
                </div>

                <div className="py-1">
                  <p className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest mb-2">Daftar Siswa</p>
                  <p className="text-sm font-bold text-[#5d4037] leading-relaxed">
                    {req.daftar_siswa.join(', ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#f8f3ed] flex items-center justify-between">
                  <div className="text-[10px] text-[#8b5e3c]/60 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                  </div>
                  <button
                    onClick={() => handleHPRequestPDF(req)}
                    disabled={hpPdfLoading === req.id}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#3e2723] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-black/10"
                  >
                    {hpPdfLoading === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5 text-amber-200" />
                    )}
                    Cetak PDF
                  </button>
                </div>
              </motion.div>
            ))}
            {hpRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-[#d7ccc8]">
                <Tablet className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                <p className="text-[#8b5e3c]/40 font-black uppercase tracking-widest text-[10px] italic">Belum ada riwayat permohonan</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'riwayat_sakit' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-6">
              <div className="px-1">
                <h2 className="text-3xl font-black text-[#3e2723] font-display tracking-tight italic">Perizinan Sakit</h2>
                <div className="mt-6 flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-[#d7ccc8]/40 shadow-sm w-fit">
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
                      className={`px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                        timeFilter === cat.id
                          ? 'bg-[#5d4037] text-white shadow-lg shadow-black/10'
                          : 'text-[#8b5e3c] hover:text-[#5d4037] hover:bg-[#f8f3ed]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative group px-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b5e3c]/40 group-focus-within:text-[#5d4037] transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau nomor surat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white border border-[#d7ccc8]/40 rounded-[2.5rem] shadow-sm focus:ring-4 focus:ring-[#5d4037]/10 focus:border-[#5d4037] transition-all outline-none text-sm font-medium text-[#3e2723] placeholder:text-[#8b5e3c]/30"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredPermits.filter(p => p.tipe === 'sakit').map((permit) => (
                  <motion.div
                    key={permit.id}
                    layout
                    whileHover={{ scale: 1.01, x: 4 }}
                    className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[#8b5e3c] transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${
                        permit.status === 'approved' ? 'bg-emerald-500 shadow-emerald-100' : 
                        permit.status === 'pending_kelas' ? 'bg-amber-500 shadow-amber-100' : 'bg-[#5d4037] shadow-black/10'
                      }`}>
                        {permit.nama_siswa.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-[#3e2723] font-display italic">{permit.nama_siswa}</h4>
                          <span className="px-2 py-0.5 bg-[#f8f3ed] text-[#5d4037] rounded text-[8px] font-black uppercase tracking-tighter border border-[#d7ccc8]/20">
                            {permit.kelas}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest mt-0.5 italic">
                          {permit.nomor_surat} • {permit.tgl_surat?.toDate ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${
                          permit.status === 'approved' ? 'text-emerald-600' :
                          permit.status === 'pending_kelas' ? 'text-amber-600' : 'text-[#5d4037]'
                        }`}>
                          {permit.status === 'approved' ? 'Disetujui' : 
                           permit.status === 'pending_kelas' ? 'Perlu Persetujuan' : 'Diterima'}
                        </p>
                        <p className="text-[10px] font-bold text-[#8b5e3c]/40 uppercase">Status Izin</p>
                      </div>
                      <button
                        onClick={() => setSelectedPermit(permit)}
                        className="p-3 bg-[#fdfcf0] text-[#8b5e3c] rounded-2xl hover:bg-[#f8f3ed] hover:text-[#5d4037] transition-all group-hover:scale-110"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {filteredPermits.filter(p => p.tipe === 'sakit').length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada riwayat perizinan sakit</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Removed pangkalan_data view */}
      
      {showCatatanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3e2723]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#d7ccc8]/40 bg-[#fdfcf0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f8f3ed] rounded-xl border border-[#d7ccc8]/30">
                  <MessageSquare className="w-5 h-5 text-[#5d4037]" />
                </div>
                <h3 className="font-black text-[#3e2723] uppercase tracking-tight italic">Input Catatan Guru Mapel</h3>
              </div>
              <button onClick={() => setShowCatatanForm(false)} className="p-2 hover:bg-[#f8f3ed] rounded-full transition-colors text-[#8b5e3c]">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitCatatan} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest mb-2">Nama Siswa</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]/40" />
                    <input
                      type="text"
                      required
                      value={namaSiswa}
                      onChange={(e) => handleNamaSiswaChange(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[#fdfcf0] border border-[#d7ccc8]/30 rounded-2xl focus:ring-4 focus:ring-[#5d4037]/5 outline-none transition-all text-sm font-medium text-[#3e2723]"
                      placeholder="Nama lengkap siswa"
                    />
                    <AnimatePresence>
                      {showSuggestions && filteredStudentsList.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white border border-[#d7ccc8]/20 rounded-2xl shadow-xl overflow-hidden"
                        >
                          {filteredStudentsList.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => selectStudent(student)}
                              className="w-full px-4 py-3 text-left hover:bg-[#fdfcf0] flex items-center justify-between group transition-colors"
                            >
                              <div>
                                <p className="text-sm font-bold text-[#3e2723]">{student.nama_lengkap}</p>
                                <p className="text-[10px] text-[#8b5e3c]/60 uppercase tracking-wider">{student.kelas}</p>
                              </div>
                              <Check className="w-4 h-4 text-[#5d4037] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest mb-2">Kelas</label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full px-4 py-4 bg-[#fdfcf0] border border-[#d7ccc8]/30 rounded-2xl focus:ring-4 focus:ring-[#5d4037]/5 outline-none appearance-none transition-all text-sm font-black text-[#3e2723]"
                  >
                    {WALI_KELAS_LIST.map(wk => (
                      <option key={wk.kelas} value={wk.kelas}>{wk.kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest mb-2">Isi Catatan / Perkembangan</label>
                  <div className="relative">
                    <Activity className="absolute left-4 top-4 w-4 h-4 text-[#8b5e3c]/40" />
                    <textarea
                      required
                      value={isiCatatan}
                      onChange={(e) => setIsiCatatan(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[#fdfcf0] border border-[#d7ccc8]/30 rounded-2xl focus:ring-4 focus:ring-[#5d4037]/5 outline-none transition-all text-sm min-h-[120px] font-medium text-[#3e2723]"
                      placeholder="Tuliskan perkembangan atau catatan penting siswa..."
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#5d4037] hover:bg-[#3e2723] text-white font-black rounded-2xl shadow-xl shadow-black/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 text-amber-200" /> Kirim ke Wali Asuh</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Removed Redundant Section */}

      {viewMode === 'perizinan' && (
        <motion.button 
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCatatanForm(true)}
          className="fixed bottom-24 right-6 bg-[#3e2723] text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 z-30 transition-all border-b-4 border-black/20"
        >
          <Plus className="w-6 h-6 text-amber-200" />
          <span className="text-xs font-black uppercase tracking-widest">Buat Catatan Baru</span>
        </motion.button>
      )}

      {/* Duplicate block removed from here */}

      {/* Profile View */}
      {viewMode === 'profil' && <ProfileView user={user} />}

      {/* Memorandum View */}
      {viewMode === 'memorandum' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 gap-4">
            {memos.map(memo => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.01, x: 4 }}
                onClick={() => setSelectedMemo(memo)}
                className="group flex items-center gap-5 p-5 bg-white rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 hover:border-[#8b5e3c] transition-all cursor-pointer"
              >
                <div className="w-16 h-16 bg-[#fdfcf0] text-[#8b5e3c]/40 rounded-3xl flex items-center justify-center shrink-0 group-hover:bg-[#f8f3ed] group-hover:text-[#5d4037] transition-colors border border-[#d7ccc8]/20">
                  <Mail className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-[#3e2723] truncate font-display italic">{memo.perihal}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Dari: {memo.pengirim_name}</span>
                    <span className="text-[#d7ccc8]/40">•</span>
                    <span className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest italic">
                      {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-[#fdfcf0] rounded-xl text-[#d7ccc8] group-hover:text-[#5d4037] transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-[#d7ccc8]">
                <Mail className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                <p className="text-[#8b5e3c]/40 font-black uppercase tracking-widest text-[10px] italic">Belum ada memorandum</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
      
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Kelas/Guru</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

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

            <div className="p-6 bg-[#fdfcf0] border-t border-[#d7ccc8]/40 flex gap-3">
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
                  className="flex-1 py-4 bg-[#5d4037] text-white font-black rounded-2xl hover:bg-[#3e2723] shadow-xl shadow-black/10 transition-all flex items-center justify-center gap-2"
                >
                  {pdfLoading === selectedPermit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4 text-amber-200" /> Cetak PDF</>}
                </button>
              )}
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#f8f3ed] transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmApproveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#3e2723]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center text-[#3e2723]">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black mb-2 font-display italic">Konfirmasi Setujui</h3>
              <p className="text-[#8b5e3c] text-sm font-medium">
                Apakah Anda yakin ingin menyetujui perizinan sakit siswa ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="p-6 bg-[#fdfcf0] border-t border-[#d7ccc8]/40 flex gap-3">
              <button
                onClick={() => setConfirmApproveId(null)}
                className="flex-1 py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#f8f3ed] transition-all"
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

      {selectedMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3e2723]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#d7ccc8]/40 bg-[#fdfcf0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f8f3ed] rounded-xl border border-[#d7ccc8]/30">
                  <Mail className="w-5 h-5 text-[#5d4037]" />
                </div>
                <div>
                  <h3 className="font-black text-[#3e2723] uppercase tracking-tight italic">Memorandum Intern</h3>
                  <p className="text-[10px] text-[#8b5e3c]/60 font-mono uppercase tracking-wider">{selectedMemo.nomor_memo}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMemo(null)} className="p-2 hover:bg-[#f8f3ed] rounded-full transition-colors text-[#8b5e3c]">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Dari</label>
                  <p className="font-black text-[#3e2723] flex items-center gap-1.5 font-display italic">
                    <ShieldCheck className="w-4 h-4 text-[#5d4037]" /> {selectedMemo.pengirim_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Tanggal</label>
                  <p className="font-black text-[#3e2723] font-display italic">
                    {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Perihal</label>
                <p className="text-xl font-black text-[#3e2723] leading-tight font-display italic">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-[#d7ccc8]/20 text-[#3e2723]">
                <label className="text-[10px] font-black text-[#8b5e3c]/40 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-[#fdfcf0] rounded-2xl border border-[#d7ccc8]/30">
                  <p className="text-sm text-[#5d4037] leading-relaxed whitespace-pre-wrap font-medium">{selectedMemo.isi}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#f8f3ed] border-t border-[#d7ccc8]/40 flex gap-3">
              <button
                onClick={() => setSelectedMemo(null)}
                className="flex-1 py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#f8f3ed] transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generateMemorandumPDF(selectedMemo);
                  setSelectedMemo(null);
                }}
                className="flex-1 py-4 bg-[#5d4037] text-white font-black rounded-2xl hover:bg-[#3e2723] shadow-xl shadow-black/10 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-amber-200" /> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
