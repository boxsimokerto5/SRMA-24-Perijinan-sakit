import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, Memorandum, normalizeKelas } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2, Plus, MapPin, ClipboardList, CheckCircle2, MessageSquare, Send, Mail, ShieldCheck, Clock, BarChart3, Search, ChevronRight, Activity, Menu, IdCard } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import { motion, AnimatePresence } from 'motion/react';
import { getDocs } from 'firebase/firestore';
import { Siswa } from '../types';

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
  const [showCatatanForm, setShowCatatanForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [viewMode, setViewMode] = useState<'perizinan' | 'kartu_siswa'>('kartu_siswa');
  const [showMenu, setShowMenu] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);

  const [students, setStudents] = useState<Siswa[]>([]);
  const [filteredStudentsList, setFilteredStudentsList] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [isiCatatan, setIsiCatatan] = useState('');

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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'memorandums');
    });
    return () => unsubscribe();
  }, []);

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
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'catatan',
        nomor_surat: `SRMA-C-${Date.now().toString().slice(-6)}`,
        nama_siswa: namaSiswa,
        kelas: kelas,
        isi_catatan: isiCatatan,
        tgl_surat: serverTimestamp(),
        nama_wali_kelas: user.name,
        wali_kelas_uid: user.uid,
        status: 'pending_ack',
      });

      // Notify relevant roles
      notifyAllRoles(['wali_asuh', 'kepala_sekolah'], 'Catatan Siswa Baru', `Wali Kelas ${user.name} mengirimkan catatan penting untuk siswa ${namaSiswa}.`);

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

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status === 'pending_kelas').length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length
  };

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  if (activeTab === 'statistik') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Statistik Wali Kelas</h2>
            <p className="text-sm text-slate-500">Data kesehatan siswa di kelas Anda.</p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 text-center py-20">
          <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-slate-900 font-bold text-xl">Statistik Segera Hadir</h3>
          <p className="text-slate-500 mt-2">Fitur analisis mendalam sedang dalam pengembangan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      {/* Welcome & Menu Section */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Halo, {user.name.split(' ')[0]}!</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Wali Kelas {myClass}</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/60 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-4 z-50 overflow-hidden"
                >
                  <div className="px-6 py-2 mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menu Navigasi</p>
                  </div>
                  <button
                    onClick={() => { setViewMode('perizinan'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'perizinan' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'perizinan' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    Dashboard & Riwayat
                  </button>
                  <button
                    onClick={() => { setViewMode('kartu_siswa'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'kartu_siswa' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'kartu_siswa' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    Data Siswa Kelas {myClass}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {viewMode === 'kartu_siswa' ? (
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
      ) : (
        <>
      {/* Dashboard Grid - Bento Style */}
      <div className="grid grid-cols-2 gap-4">
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

      {showCatatanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Input Catatan Siswa</h3>
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

        {permits.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada data perizinan</p>
          </div>
        )}
      </div>
      </>
      )}

      {/* Floating Action Button (FAB) */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowCatatanForm(true)}
        className="fixed bottom-24 right-6 bg-indigo-950 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 z-30 transition-all"
      >
        <Plus className="w-6 h-6" />
        <span className="text-xs font-black uppercase tracking-widest">Buat Catatan Baru</span>
      </motion.button>      {/* Modal Detail Perizinan */}
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
    </div>
  );
}
