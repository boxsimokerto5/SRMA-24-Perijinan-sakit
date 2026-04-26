import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { UserRole, AppUser, IzinSakit, WALI_KELAS_LIST, Memorandum, normalizeKelas, LaptopRequest, HPRequest, AppNotification, Announcement, Siswa } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2, Plus, MapPin, ClipboardList, CheckCircle2, MessageSquare, Send, Mail, ShieldCheck, Clock, BarChart3, Search, ChevronRight, Activity, Menu, IdCard, Laptop, Users, CheckSquare as CheckSquareIcon, Square, Tablet, GraduationCap, LayoutDashboard, Database, LogOut } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import MadingSekolahView from './MadingSekolahView';
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
                      <div className="bg-white p-3 rounded-2xl shadow-xl shadow-black/10">
                        <GraduationCap className="w-6 h-6 text-[#075e6e]" />
                      </div>
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

      {/* Top Header */}
      <header className={`sticky top-0 z-50 transition-all ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'} backdrop-blur-xl border-b ${isDarkMode ? 'border-slate-800' : 'border-indigo-100/60'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#075e6e]">
              {viewTitles[viewMode] || 'SRMA 24'}
            </h1>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 space-y-8">
        {viewMode === 'profil' && <ProfileView user={user} />}
        {viewMode === 'mading' && <MadingSekolahView user={user} />}

        {viewMode === 'kartu_siswa' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-6">
            <div className="px-1">
              <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Data Siswa</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Daftar Lengkap Siswa</p>
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
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kelas</p>
                      <p className="text-xs font-bold text-slate-600">{student.kelas || '-'}</p>
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

      {viewMode === 'pinjam_laptop' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="px-1">
            <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Permohonan Laptop</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pinjaman Laptop untuk Siswa</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
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
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-slate-50 text-slate-500 border border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    Kelas {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Daftar Siswa Kelas {laptopKelas}</label>
                <button 
                  onClick={handleSelectAllInClass}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
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
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {selectedStudentsForLaptop.includes(student.nama_lengkap) ? (
                      <CheckSquareIcon className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                    <span className="text-sm font-bold">{student.nama_lengkap}</span>
                  </button>
                ))}
                {students.filter(s => s.kelas === laptopKelas).length === 0 && (
                  <div className="col-span-full py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tidak ada siswa di kelas ini</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa Terpilih</p>
                  <p className="text-xl font-black text-indigo-600">{selectedStudentsForLaptop.length} <span className="text-xs text-slate-400">Siswa</span></p>
                </div>
                <button
                  onClick={handleSubmitLaptopRequest}
                  disabled={isSubmittingLaptop || selectedStudentsForLaptop.length === 0}
                  className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {isSubmittingLaptop ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
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
            <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Permohonan HP</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pinjaman HP untuk Siswa</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
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
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-slate-50 text-slate-500 border border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    Kelas {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Daftar Siswa Kelas {hpKelas}</label>
                <button 
                  onClick={handleSelectAllInClassHP}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
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
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {selectedStudentsForHP.includes(student.nama_lengkap) ? (
                      <CheckSquareIcon className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                    <span className="text-sm font-bold">{student.nama_lengkap}</span>
                  </button>
                ))}
                {students.filter(s => s.kelas === hpKelas).length === 0 && (
                  <div className="col-span-full py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tidak ada siswa di kelas ini</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa Terpilih</p>
                  <p className="text-xl font-black text-indigo-600">{selectedStudentsForHP.length} <span className="text-xs text-slate-400">Siswa</span></p>
                </div>
                <button
                  onClick={handleSubmitHPRequest}
                  disabled={isSubmittingHP || selectedStudentsForHP.length === 0}
                  className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {isSubmittingHP ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
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
          {/* Greeting Section */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-slate-900 font-display">
                Selamat {new Date().getHours() < 12 ? 'Pagi' : new Date().getHours() < 15 ? 'Siang' : new Date().getHours() < 18 ? 'Sore' : 'Malam'}, 
                <span className="text-sky-600"> {user.name}</span>
              </h2>
              <p className="text-sm font-bold text-slate-500 mt-1">
                sebagai Guru Mapel {user.mapel || '(Mata Pelajaran Belum Diatur)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Petunjuk Penggunaan */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 font-display">Petunjuk Penggunaan Aplikasi</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Panduan Singkat Guru Mapel</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shadow-sm shrink-0">1</div>
                <div>
                  <p className="text-xs font-black text-slate-900">Pantau Perizinan Sakit</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">Gunakan menu "Perizinan Sakit" untuk melihat siswa yang sedang izin sakit resmi dari dokter.</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shadow-sm shrink-0">2</div>
                <div>
                  <p className="text-xs font-black text-slate-900">Pinjam Fasilitas</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">Gunakan menu Pinjam Laptop/HP untuk mengajukan penggunaan fasilitas sekolah saat KBM.</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shadow-sm shrink-0">3</div>
                <div>
                  <p className="text-xs font-black text-slate-900">Cek Data Siswa</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">Cari data lengkap siswa seperti NIK atau Alamat pada menu Kartu Siswa jika diperlukan.</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shadow-sm shrink-0">4</div>
                <div>
                  <p className="text-xs font-black text-slate-900">Menu Memorandum</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">Selalu cek menu Memorandum untuk pengumuman atau instruksi resmi dari pimpinan sekolah.</p>
                </div>
              </div>
            </div>
          </div>

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
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Pinjam Laptop - {req.kelas}</h4>
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

                <div className="py-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daftar Siswa</p>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    {req.daftar_siswa.join(', ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                  </div>
                  <button
                    onClick={() => handleLaptopRequestPDF(req)}
                    disabled={laptopPdfLoading === req.id}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {laptopPdfLoading === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    Cetak PDF
                  </button>
                </div>
              </motion.div>
            ))}
            {laptopRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Laptop className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada riwayat permohonan</p>
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
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Tablet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Pinjam HP - {req.kelas}</h4>
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

                <div className="py-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daftar Siswa</p>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    {req.daftar_siswa.join(', ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {req.tgl_request && format(req.tgl_request.toDate(), 'dd MMM yyyy')}
                  </div>
                  <button
                    onClick={() => handleHPRequestPDF(req)}
                    disabled={hpPdfLoading === req.id}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {hpPdfLoading === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    Cetak PDF
                  </button>
                </div>
              </motion.div>
            ))}
            {hpRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Tablet className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada riwayat permohonan</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'riwayat_sakit' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-6">
              <div className="px-1">
                <h2 className="text-3xl font-black text-slate-900 font-display tracking-tight">Perizinan Sakit</h2>
                <div className="mt-6 flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-slate-200/60 shadow-sm w-fit">
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
                          ? 'bg-[#0ea5e9] text-white shadow-lg shadow-sky-100'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative group px-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-sky-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau nomor surat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200/60 rounded-[2.5rem] shadow-sm focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all outline-none text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredPermits.filter(p => p.tipe === 'sakit').map((permit) => (
                  <motion.div
                    key={permit.id}
                    layout
                    whileHover={{ scale: 1.01 }}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-sky-300 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${
                        permit.status === 'approved' ? 'bg-emerald-500 shadow-emerald-100' : 
                        permit.status === 'pending_kelas' ? 'bg-amber-500 shadow-amber-100' : 'bg-sky-500 shadow-sky-100'
                      }`}>
                        {permit.nama_siswa.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 font-display">{permit.nama_siswa}</h4>
                          <span className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded text-[8px] font-black uppercase tracking-tighter border border-sky-100">
                            {permit.kelas}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {permit.nomor_surat} • {permit.tgl_surat?.toDate ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${
                          permit.status === 'approved' ? 'text-emerald-600' :
                          permit.status === 'pending_kelas' ? 'text-amber-600' : 'text-sky-600'
                        }`}>
                          {permit.status === 'approved' ? 'Disetujui' : 
                           permit.status === 'pending_kelas' ? 'Perlu Persetujuan' : 'Diterima'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">Status Izin</p>
                      </div>
                      <button
                        onClick={() => setSelectedPermit(permit)}
                        className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all group-hover:scale-110"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Input Catatan Guru Mapel</h3>
              </div>
              <button onClick={() => setShowCatatanForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitCatatan} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      placeholder="Nama lengkap siswa"
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
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kelas</label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all text-sm"
                  >
                    {WALI_KELAS_LIST.map(wk => (
                      <option key={wk.kelas} value={wk.kelas}>{wk.kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Isi Catatan / Perkembangan</label>
                  <div className="relative">
                    <Activity className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      required
                      value={isiCatatan}
                      onChange={(e) => setIsiCatatan(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm min-h-[120px]"
                      placeholder="Tuliskan perkembangan atau catatan penting siswa..."
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Kirim ke Wali Asuh</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Removed Redundant Section */}

      {viewMode === 'perizinan' && (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCatatanForm(true)}
          className="fixed bottom-24 right-6 bg-indigo-950 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 z-30 transition-all"
        >
          <Plus className="w-6 h-6" />
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
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedMemo(memo)}
                className="group flex items-center gap-5 p-5 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer"
              >
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Mail className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate font-display">{memo.perihal}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari: {memo.pengirim_name}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-indigo-600 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada memorandum</p>
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
              {(selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged') && (
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

      {confirmApproveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
    </div>
  </div>
  );
}
