import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, StudentCounseling, Siswa } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateCounselingReportPDF } from '../pdfUtils';
import { 
  Plus, Search, Printer, Edit2, Trash2, Calendar, BookOpen, 
  User, CheckCircle, FileText, AlertCircle, X, ChevronRight, HelpCircle
} from 'lucide-react';

interface StudentCounselingViewProps {
  user: AppUser;
  students: Siswa[];
}

export default function StudentCounselingView({ user, students }: StudentCounselingViewProps) {
  const [records, setRecords] = useState<StudentCounseling[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StudentCounseling | null>(null);

  // Input states
  const [inputSiswaName, setInputSiswaName] = useState('');
  const [inputKelas, setInputKelas] = useState('');
  const [inputTanggal, setInputTanggal] = useState('');
  const [inputKategori, setInputKategori] = useState('Akademik');
  const [inputPermasalahan, setInputPermasalahan] = useState('');
  const [inputSolusi, setInputSolusi] = useState('');
  const [inputPerkembangan, setInputPerkembangan] = useState('');

  // Suggestions states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Siswa[]>([]);

  // Filter states
  const [filterSearch, setFilterSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterTime, setFilterTime] = useState<'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');

  // Custom print helper states
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonthlyMonth, setSelectedMonthlyMonth] = useState(new Date().toISOString().slice(0, 7));

  const categories = ["Akademik", "Kedisiplinan", "Sosial", "Emosional", "Karakter", "Lainnya"];
  
  // Dynamic list of unique classes for filter dropdown
  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas).filter(Boolean)))].sort();

  // Load and subscribe to counseling records
  useEffect(() => {
    let q;
    if (user.email === 'proseshidup1101@gmail.com' || user.email === 'boxsimokerto5@gmail.com') {
      q = query(collection(db, 'student_counselings'));
    } else {
      q = query(
        collection(db, 'student_counselings'),
        where('author_uid', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StudentCounseling));
      
      // Sort client-side of records by Date
      const sorted = docsData.sort((a, b) => {
        const tA = a.tgl_konseling?.toDate ? a.tgl_konseling.toDate().getTime() : 0;
        const tB = b.tgl_konseling?.toDate ? b.tgl_konseling.toDate().getTime() : 0;
        return tB - tA;
      });

      setRecords(sorted);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'student_counselings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle student name typing & auto-suggestions
  const handleSiswaNameChange = (val: string) => {
    setInputSiswaName(val);
    if (val.trim().length > 1) {
      const filtered = students.filter(s => 
        (s.nama_lengkap || '').toLowerCase().includes(val.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectStudent = (siswa: Siswa) => {
    setInputSiswaName(siswa.nama_lengkap || '');
    setInputKelas(siswa.kelas || '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Create submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSiswaName || !inputKelas || !inputTanggal || !inputPermasalahan || !inputSolusi || !inputPerkembangan) {
      alert('Mohon lengkapi semua field!');
      return;
    }

    setLoading(true);
    try {
      const dateVal = new Date(inputTanggal);
      const newRecord = {
        siswa_name: inputSiswaName,
        kelas: inputKelas,
        tgl_konseling: Timestamp.fromDate(dateVal),
        kategori: inputKategori,
        permasalahan: inputPermasalahan,
        solusi: inputSolusi,
        perkembangan: inputPerkembangan,
        author_name: user.name,
        author_uid: user.uid,
        author_email: user.email
      };

      await addDoc(collection(db, 'student_counselings'), newRecord);
      
      // Clear form
      setInputSiswaName('');
      setInputKelas('');
      setInputTanggal('');
      setInputKategori('Akademik');
      setInputPermasalahan('');
      setInputSolusi('');
      setInputPerkembangan('');
      
      setShowCreateModal(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'student_counselings');
    } finally {
      setLoading(false);
    }
  };

  // Edit action opener
  const openEditModal = (rec: StudentCounseling) => {
    setSelectedRecord(rec);
    setInputSiswaName(rec.siswa_name);
    setInputKelas(rec.kelas);
    
    const d = rec.tgl_konseling?.toDate ? rec.tgl_konseling.toDate() : new Date();
    // format to YYYY-MM-DDTHH:MM local datetime input format
    const pad = (num: number) => String(num).padStart(2, '0');
    const localDateTimeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    
    setInputTanggal(localDateTimeStr);
    setInputKategori(rec.kategori);
    setInputPermasalahan(rec.permasalahan);
    setInputSolusi(rec.solusi);
    setInputPerkembangan(rec.perkembangan);
    
    setShowEditModal(true);
  };

  // Edit submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !selectedRecord.id) return;
    if (!inputSiswaName || !inputKelas || !inputTanggal || !inputPermasalahan || !inputSolusi || !inputPerkembangan) {
      alert('Mohon lengkapi semua field!');
      return;
    }

    setLoading(true);
    try {
      const dateVal = new Date(inputTanggal);
      const updatedData = {
        siswa_name: inputSiswaName,
        kelas: inputKelas,
        tgl_konseling: Timestamp.fromDate(dateVal),
        kategori: inputKategori,
        permasalahan: inputPermasalahan,
        solusi: inputSolusi,
        perkembangan: inputPerkembangan
      };

      await updateDoc(doc(db, 'student_counselings', selectedRecord.id), updatedData);
      setShowEditModal(false);
      setSelectedRecord(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `student_counselings/${selectedRecord.id}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete handler
  const handleDeleteRecord = async (rec: StudentCounseling) => {
    if (!rec.id) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus catatan konseling untuk ${rec.siswa_name}?`)) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'student_counselings', rec.id));
        if (selectedRecord?.id === rec.id) {
          setShowDetailModal(false);
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `student_counselings/${rec.id}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Format Date for displaying
  const formatDateStr = (ts: Timestamp) => {
    if (!ts) return '-';
    const d = ts.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  // Filters logic
  const filteredRecords = records.filter(rec => {
    // Search
    const searchMatch = !filterSearch || 
      rec.siswa_name.toLowerCase().includes(filterSearch.toLowerCase()) ||
      rec.author_name.toLowerCase().includes(filterSearch.toLowerCase());

    // Class
    const classMatch = filterKelas === 'Semua' || rec.kelas === filterKelas;
    
    // Category
    const categoryMatch = filterKategori === 'Semua' || rec.kategori === filterKategori;

    // Time filter
    let timeMatch = true;
    if (filterTime !== 'semua' && rec.tgl_konseling) {
      const recDate = rec.tgl_konseling.toDate();
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (filterTime === 'hari_ini') {
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        timeMatch = recDate >= now && recDate <= todayEnd;
      } else if (filterTime === 'minggu_ini') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        timeMatch = recDate >= weekAgo;
      } else if (filterTime === 'bulan_ini') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        timeMatch = recDate >= monthAgo;
      }
    }

    return searchMatch && classMatch && categoryMatch && timeMatch;
  });

  // Export Weekly PDF
  const handlePrintWeekly = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Filter records of the last 7 days from the records space (respecting current search/filter states too)
    const filtered = filteredRecords.filter(rec => {
      if (!rec.tgl_konseling) return false;
      const recDate = rec.tgl_konseling.toDate();
      return recDate >= weekAgo;
    });

    generateCounselingReportPDF(filtered, 'Rekap Mingguan (7 Hari Terakhir)', user.name);
  };

  // Export Monthly PDF
  const handlePrintMonthly = () => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Filter records of the last 30 days from the records space
    const filtered = filteredRecords.filter(rec => {
      if (!rec.tgl_konseling) return false;
      const recDate = rec.tgl_konseling.toDate();
      return recDate >= monthAgo;
    });

    generateCounselingReportPDF(filtered, 'Rekap Bulanan (30 Hari Terakhir)', user.name);
  };

  const formatDateShort = (d: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  };

  // Export Selected Daily PDF
  const handlePrintDaily = () => {
    if (!selectedDailyDate) {
      alert('Pilih tanggal terlebih dahulu!');
      return;
    }
    
    const targetDate = new Date(selectedDailyDate);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const dailyFiltered = records.filter(rec => {
      if (!rec.tgl_konseling) return false;
      const recDate = rec.tgl_konseling.toDate();
      return recDate >= startOfDay && recDate <= endOfDay;
    });

    if (dailyFiltered.length === 0) {
      alert(`Tidak ada catatan konseling pada tanggal ${formatDateShort(targetDate)}`);
      return;
    }

    const formattedDateLabel = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(targetDate);

    generateCounselingReportPDF(dailyFiltered, `Harian (${formattedDateLabel})`, user.name);
  };

  // Export Selected Monthly PDF
  const handlePrintSelectedMonth = () => {
    if (!selectedMonthlyMonth) {
      alert('Pilih bulan terlebih dahulu!');
      return;
    }

    const [year, month] = selectedMonthlyMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const monthlyFiltered = records.filter(rec => {
      if (!rec.tgl_konseling) return false;
      const recDate = rec.tgl_konseling.toDate();
      return recDate >= startOfMonth && recDate <= endOfMonth;
    });

    if (monthlyFiltered.length === 0) {
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      alert(`Tidak ada catatan konseling pada bulan ${monthNames[month - 1]} ${year}`);
      return;
    }

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const formattedMonthLabel = `${monthNames[month - 1]} ${year}`;

    generateCounselingReportPDF(monthlyFiltered, `Bulanan (${formattedMonthLabel})`, user.name);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Akademik': return 'bg-amber-100/50 text-[#5d4037] border-[#ebdccb] dark:bg-[#5d4037]/20 dark:text-amber-200 dark:border-amber-900/30';
      case 'Kedisiplinan': return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
      case 'Sosial': return 'bg-orange-50 text-orange-850 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-900/30';
      case 'Emosional': return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30';
      case 'Karakter': return 'bg-yellow-50 text-amber-850 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-300 dark:border-yellow-905/30';
      default: return 'bg-stone-100 text-stone-850 border-stone-200 dark:bg-stone-850 dark:text-stone-300 dark:border-stone-700';
    }
  };

  return (
    <div className="space-y-6 font-display text-stone-850">
      {/* Upper header action box in warm boxed brown motif */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#3e2723] text-stone-200 p-6 rounded-lg shadow-md border border-[#5d4037] relative overflow-hidden">
        {/* Absolute design accents similar to other menus */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-xl font-black uppercase tracking-wider italic text-amber-200 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-300 pointer-events-none" />
            Konseling Siswa
          </h2>
          <p className="text-stone-300 text-[11px] font-medium tracking-wide mt-1 uppercase opacity-90">
            {(user.email === 'proseshidup1101@gmail.com' || user.email === 'boxsimokerto5@gmail.com') 
              ? 'Mode Super-Admin: Menampilkan seluruh instrumen bimbingan asrama' 
              : 'Pusat Manajemen Konseling dan Evaluasi Sosial Bimbingan Siswa Mandiri'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10 self-start xl:self-auto">
          {/* Print Weekly Button */}
          <button 
            onClick={handlePrintWeekly}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#ebdccb] hover:bg-stone-100 text-[#3e2723] font-black text-[9.5px] uppercase tracking-wider transition-all active:scale-95 shadow border border-[#5d4037]/10"
          >
            <Printer className="w-3.5 h-3.5 text-[#3e2723]/85" />
            Rekap Minggu Ini
          </button>
          
          {/* Print Monthly Button */}
          <button 
            onClick={handlePrintMonthly}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#ebdccb] hover:bg-stone-100 text-[#3e2723] font-black text-[9.5px] uppercase tracking-wider transition-all active:scale-95 shadow border border-[#5d4037]/10"
          >
            <Printer className="w-3.5 h-3.5 text-[#3e2723]/85" />
            Rekap Bulan Ini
          </button>

          {/* Create Button */}
          <button 
            onClick={() => {
              setInputSiswaName('');
              setInputKelas('');
              setInputTanggal(new Date().toISOString().slice(0, 16));
              setInputKategori('Akademik');
              setInputPermasalahan('');
              setInputSolusi('');
              setInputPerkembangan('');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-black text-[9.5px] uppercase tracking-wider transition-all active:scale-95 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Kasus / Konseling
          </button>
        </div>
      </div>

      {/* Panel Download Laporan Rekap PDF Kustom */}
      <div className="bg-[#fcfaf6] dark:bg-stone-900 duration-300 p-5 rounded-lg border border-[#3e2723]/15 dark:border-white/5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rekap Harian */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#3e2723] dark:text-amber-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600 animate-pulse" />
            Cetak Rekap Harian (Pilihan Tanggal)
          </h4>
          <div className="flex flex-wrap gap-2.5 items-center">
            <input 
              type="date"
              value={selectedDailyDate}
              onChange={(e) => setSelectedDailyDate(e.target.value)}
              className="px-3 py-2 text-[11px] rounded bg-white dark:bg-stone-950 text-stone-800 dark:text-white border border-stone-250 dark:border-stone-800 outline-none focus:border-[#3e2723] font-bold tracking-wider"
            />
            <button
              onClick={handlePrintDaily}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-950 text-[#3e2723] dark:text-amber-205 font-black text-[9.5px] uppercase tracking-widest rounded flex items-center gap-1.5 border border-amber-200/40 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Rekap Harian
            </button>
          </div>
        </div>

        {/* Rekap Bulanan */}
        <div className="space-y-3 border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800 md:pl-6 pt-4 md:pt-0">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#3e2723] dark:text-amber-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600 animate-pulse" />
            Cetak Rekap Bulanan (Pilihan Bulan)
          </h4>
          <div className="flex flex-wrap gap-2.5 items-center">
            <input 
              type="month"
              value={selectedMonthlyMonth}
              onChange={(e) => setSelectedMonthlyMonth(e.target.value)}
              className="px-3 py-2 text-[11px] rounded bg-white dark:bg-stone-950 text-stone-800 dark:text-white border border-stone-250 dark:border-stone-800 outline-none focus:border-[#3e2723] font-bold tracking-wider"
            />
            <button
              onClick={handlePrintSelectedMonth}
              className="px-4 py-2 bg-[#3e2723] hover:bg-[#5d4037] text-amber-205 font-black text-[9.5px] uppercase tracking-widest rounded flex items-center gap-1.5 transition-all cursor-pointer shadow"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              Cetak Rekap Bulanan
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel designed in high contrast square borders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-stone-55/40 dark:bg-slate-900/60 p-4 rounded-lg border border-[#3e2723]/10 dark:border-white/5 shadow-inner">
        {/* Search input in dark gold box */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="CARI SISWA / KONSELOR..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-850 dark:text-stone-100 text-[10px] uppercase font-black tracking-widest placeholder-stone-400 outline-none focus:border-[#3e2723] transition-all"
          />
        </div>

        {/* Class dropdown */}
        <div>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="w-full px-3 py-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-850 dark:text-stone-100 text-[10px] uppercase font-black tracking-widest outline-none focus:border-[#3e2723] transition-all"
          >
            {classes.map(cl => (
              <option key={cl} value={cl}>{cl === 'Semua' ? 'SEMUA KELAS' : `KELAS ${cl}`}</option>
            ))}
          </select>
        </div>

        {/* Category dropdown */}
        <div>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="w-full px-3 py-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-850 dark:text-stone-100 text-[10px] uppercase font-black tracking-widest outline-none focus:border-[#3e2723] transition-all"
          >
            <option value="Semua">SEMUA KATEGORI</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Period dropdown */}
        <div>
          <select
            value={filterTime}
            onChange={(e) => setFilterTime(e.target.value as any)}
            className="w-full px-3 py-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-850 dark:text-stone-100 text-[10px] uppercase font-black tracking-widest outline-none focus:border-[#3e2723] transition-all"
          >
            <option value="semua">SEMUA WAKTU</option>
            <option value="hari_ini">HARI INI</option>
            <option value="minggu_ini">7 HARI TERAKHIR</option>
            <option value="bulan_ini">30 HARI TERAKHIR</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-stone-50 dark:bg-slate-900 rounded-lg border border-stone-200 dark:border-white/5">
          <div className="w-10 h-10 border-4 border-[#3e2723]/20 border-t-[#3e2723] rounded-full animate-spin" />
          <p className="text-stone-500 mt-4 text-[11px] font-mono font-black uppercase tracking-wider">Membuka rekaman bimbingan...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 py-24 bg-[#fcfaf6] dark:bg-stone-900/40 rounded-lg border border-[#3e2723]/10 dark:border-white/5 text-center">
          <div className="p-3 bg-[#ebdccb]/60 rounded mb-4">
            <HelpCircle className="w-8 h-8 text-[#3e2723]" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#3e2723] dark:text-amber-200">Belum Ada Informasi Konseling</h3>
          <p className="text-stone-400 dark:text-stone-500 text-[10px] tracking-wide uppercase max-w-sm mt-1.5">
            Tidak ditemukan lembaran yang sesuai dengan filter filter koordinat pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => {
                setSelectedRecord(item);
                setShowDetailModal(true);
              }}
              className="group cursor-pointer flex flex-col justify-between bg-[#fcfaf6] hover:bg-stone-100/50 dark:bg-stone-900 dark:hover:bg-stone-850/50 p-5 rounded-lg border border-[#3e2723]/10 dark:border-white/5 hover:border-[#3e2723] transition-all shadow-sm"
            >
              <div className="space-y-3.5">
                {/* Upper info ribbon */}
                <div className="flex justify-between items-start gap-2 border-b border-stone-200/40 pb-2.5">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-[#5d4037] dark:text-amber-200 uppercase tracking-widest block font-mono">
                      KELAS {item.kelas}
                    </span>
                    <h4 className="text-sm font-black text-[#3e2723] dark:text-white leading-tight uppercase font-display">
                      {item.siswa_name}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider shrink-0 ${getCategoryColor(item.kategori)}`}>
                    {item.kategori}
                  </span>
                </div>

                {/* Case / Permasalahan Preview */}
                <div className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed line-clamp-3 bg-[#ebdccb]/15 dark:bg-stone-950 p-3 rounded border border-[#3e2723]/5">
                  <span className="font-black text-[#3e2723] dark:text-amber-100 text-[9px] block uppercase tracking-wider mb-1">
                    Kasus Utama:
                  </span>
                  {item.permasalahan}
                </div>

                {/* Solutions Snippet */}
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                    Solusi Terpilih:
                  </span>
                  <p className="text-[11px] text-[#5d4037] dark:text-stone-400 line-clamp-2 italic leading-relaxed">
                    "{item.solusi}"
                  </p>
                </div>
              </div>

              {/* Lower Info Ribbon */}
              <div className="flex items-center justify-between border-t border-[#3e2723]/5 dark:border-white/5 pt-3.5 mt-3.5 text-[9px]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#ebdccb] dark:bg-[#3e2723] flex items-center justify-center text-[#3e2723] dark:text-amber-200 font-mono text-[9px] uppercase font-black">
                    {item.author_name ? item.author_name.slice(0, 2) : 'WS'}
                  </div>
                  <div className="flex flex-col select-none">
                    <span className="font-extrabold text-[#3e2723] dark:text-stone-300 leading-none">
                      {item.author_name}
                    </span>
                    <span className="text-[8px] text-stone-400 mt-0.5">
                      Konselor
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-stone-400 dark:text-stone-500 font-mono">
                  <Calendar className="w-3 h-3 shrink-0" />
                  {formatDateStr(item.tgl_konseling)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL popup in Boxy Chocolate Motif */}
      <AnimatePresence>
        {showDetailModal && selectedRecord && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-lg shadow-2xl overflow-hidden border border-[#5d4037]"
            >
              <div className="p-5 md:p-6 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
                {/* Header panel */}
                <div className="flex justify-between items-start gap-4 border-b border-[#3e2723]/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-[#f5ebe0] text-[#3e2723] border border-[#ebdccb] text-[9px] font-black uppercase tracking-wider">
                        Kelas {selectedRecord.kelas}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${getCategoryColor(selectedRecord.kategori)}`}>
                        {selectedRecord.kategori}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-[#3e2723] dark:text-white uppercase font-display tracking-tight leading-tight">
                      {selectedRecord.siswa_name}
                    </h3>
                  </div>

                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-1 px-2 text-[10px] font-bold text-stone-500 hover:text-red-600 dark:hover:text-red-400 border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 rounded transition-all"
                  >
                    CLOSE
                  </button>
                </div>

                {/* Details stack in crisp flat boxes */}
                <div className="space-y-4 text-[11px]">
                  {/* Kasus / Masalah Block */}
                  <div className="p-4 rounded bg-[#f5ebe0]/30 dark:bg-stone-950 border border-[#ebdccb] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-red-700 font-black uppercase tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Permasalahan / Kasus
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedRecord.permasalahan}
                    </p>
                  </div>

                  {/* Bimbingan / Solusi Block */}
                  <div className="p-4 rounded bg-amber-50/40 dark:bg-stone-950 border border-amber-200/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[#3e2723] dark:text-amber-200 font-black uppercase tracking-wider">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      Intervensi Bimbingan / Solusi
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedRecord.solusi}
                    </p>
                  </div>

                  {/* Catatan Perkembangan Block */}
                  <div className="p-4 rounded bg-[#ebdccb]/15 dark:bg-stone-950 border border-[#ebdccb]/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[#5d4037] dark:text-stone-300 font-black uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-stone-600" />
                      Catatan Evaluasi Perkembangan
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedRecord.perkembangan}
                    </p>
                  </div>
                </div>

                {/* Author Info & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#3e2723]/10 pt-4">
                  {/* Creator name */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-[#ebdccb] dark:bg-[#3e2723] flex items-center justify-center font-black text-[#3e2723] dark:text-amber-200 text-[10px]">
                      {selectedRecord.author_name ? selectedRecord.author_name.slice(0, 2) : 'WS'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-[#3e2723] dark:text-stone-200 uppercase leading-none">
                        Dibuat oleh {selectedRecord.author_name}
                      </span>
                      <span className="text-[8.5px] text-stone-400 mt-0.5 font-mono">
                        TERTANGGAL {formatDateStr(selectedRecord.tgl_konseling)}
                      </span>
                    </div>
                  </div>

                  {/* Creator permissions controls */}
                  {(selectedRecord.author_uid === user.uid || user.email === 'proseshidup1101@gmail.com' || user.email === 'boxsimokerto5@gmail.com') && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto text-[9.5px]">
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          openEditModal(selectedRecord);
                        }}
                        className="p-2 px-3 text-[#3e2723] bg-[#ebdccb] hover:bg-stone-200 rounded font-black uppercase tracking-widest flex items-center gap-1 transition-all border border-[#ebdccb]"
                      >
                        <Edit2 className="w-3 h-3" />
                        Ubah data
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(selectedRecord)}
                        className="p-2 px-3 text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-300 rounded font-black uppercase tracking-widest flex items-center gap-1 transition-all border border-red-200/20"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE MODAL popup inside crisp brown boxes */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-lg shadow-2xl overflow-hidden border border-[#3e2723]"
            >
              <div className="p-5 md:p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-[#3e2723]/10 pb-3">
                  <h3 className="text-sm font-black text-[#3e2723] dark:text-amber-200 uppercase tracking-widest font-display">
                    TAMBAH DIAGNOSIS / KONSELING
                  </h3>
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 px-2 text-[9px] font-bold text-stone-500 hover:text-red-600 rounded bg-stone-50 border border-stone-200"
                  >
                    CLOSE
                  </button>
                </div>

                <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-[10px] tracking-wider uppercase font-black text-stone-500">
                  {/* Select Student and Suggestions layout */}
                  <div className="relative">
                    <label className="block mb-1 font-black text-stone-500 dark:text-stone-400">
                      Nama Siswa
                    </label>
                    <input
                      type="text"
                      required
                      value={inputSiswaName}
                      onChange={(e) => handleSiswaNameChange(e.target.value)}
                      placeholder="Masukkan nama lengkap siswa..."
                      className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                    />

                    {/* Suggestions list dropdown */}
                    <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          className="absolute left-0 right-0 top-[102%] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded shadow-xl overflow-hidden z-25 max-h-48 overflow-y-auto custom-scrollbar"
                        >
                          {suggestions.map(s => (
                            <button
                              type="button"
                              key={s.id || s.nama_lengkap}
                              onClick={() => handleSelectStudent(s)}
                              className="w-full text-left px-4 py-2.5 text-[11px] hover:bg-[#ebdccb]/30 text-stone-700 dark:text-stone-300 font-bold flex items-center justify-between border-b border-stone-100 dark:border-white/5 last:border-0"
                            >
                              <span>{s.nama_lengkap}</span>
                              <span className="text-[9px] bg-stone-50 dark:bg-stone-950 border px-2 py-0.5 rounded">Kelas {s.kelas}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Class entry */}
                  <div>
                    <label className="block mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      required
                      value={inputKelas}
                      onChange={(e) => setInputKelas(e.target.value)}
                      placeholder="Contoh: 10-A, 11-B..."
                      className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Counseling date */}
                    <div>
                      <label className="block mb-1">
                        Tanggal & Waktu Konseling
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={inputTanggal}
                        onChange={(e) => setInputTanggal(e.target.value)}
                        className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                      />
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block mb-1">
                        Kategori Konseling
                      </label>
                      <select
                        value={inputKategori}
                        onChange={(e) => setInputKategori(e.target.value)}
                        className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-bold tracking-widest transition-all"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Problem text description */}
                  <div>
                    <label className="block mb-1">
                      Keterangan Masalah / Kasus
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputPermasalahan}
                      onChange={(e) => setInputPermasalahan(e.target.value)}
                      placeholder="Detail keluhan, masalah akademik, sosial, atau emosional siswa..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Solutions list description */}
                  <div>
                    <label className="block mb-1">
                      Tindakan Bimbingan / Solusi
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputSolusi}
                      onChange={(e) => setInputSolusi(e.target.value)}
                      placeholder="Sebutkan kesepakatan solusi bimbingan yang disetujui..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Follow up progress notes */}
                  <div>
                    <label className="block mb-1">
                      Tindak Lanjut / Catatan Perkembangan
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputPerkembangan}
                      onChange={(e) => setInputPerkembangan(e.target.value)}
                      placeholder="Rekomendasi tindak lanjut bagi pembimbing asrama..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded bg-stone-50 dark:bg-stone-950 hover:bg-stone-100 text-stone-500 font-black text-[9.5px] uppercase tracking-widest border border-stone-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-[#3e2723] hover:bg-[#5d4037] text-amber-200 font-black text-[9.5px] uppercase tracking-widest shadow"
                    >
                      PENCATATAN
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL popup inside crisp brown boxes */}
      <AnimatePresence>
        {showEditModal && selectedRecord && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-lg shadow-2xl overflow-hidden border border-[#3e2723]"
            >
              <div className="p-5 md:p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-[#3e2723]/10 pb-3">
                  <h3 className="text-sm font-black text-[#3e2723] dark:text-amber-200 uppercase tracking-widest font-display">
                    UBAH CATATAN KONSELING SISWA
                  </h3>
                  <button 
                    onClick={() => setShowEditModal(false)}
                    className="p-1 px-2 text-[9px] font-bold text-stone-500 hover:text-red-600 rounded bg-stone-50 border border-stone-200"
                  >
                    CLOSE
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-3.5 text-[10px] tracking-wider uppercase font-black text-stone-500">
                  {/* Select Student and Suggestions layout */}
                  <div className="relative">
                    <label className="block mb-1 font-black text-stone-500 dark:text-stone-400">
                      Nama Siswa
                    </label>
                    <input
                      type="text"
                      required
                      value={inputSiswaName}
                      onChange={(e) => handleSiswaNameChange(e.target.value)}
                      placeholder="Masukkan nama lengkap siswa..."
                      className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                    />

                    {/* Suggestions list dropdown */}
                    <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          className="absolute left-0 right-0 top-[102%] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded shadow-xl overflow-hidden z-25 max-h-48 overflow-y-auto custom-scrollbar"
                        >
                          {suggestions.map(s => (
                            <button
                              type="button"
                              key={s.id || s.nama_lengkap}
                              onClick={() => handleSelectStudent(s)}
                              className="w-full text-left px-4 py-2.5 text-[11px] hover:bg-[#ebdccb]/30 text-stone-700 dark:text-stone-300 font-bold flex items-center justify-between border-b border-stone-100 dark:border-white/5 last:border-0"
                            >
                              <span>{s.nama_lengkap}</span>
                              <span className="text-[9px] bg-stone-50 dark:bg-stone-950 border px-2 py-0.5 rounded">Kelas {s.kelas}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Class entry */}
                  <div>
                    <label className="block mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      required
                      value={inputKelas}
                      onChange={(e) => setInputKelas(e.target.value)}
                      placeholder="Contoh: 10-A, 11-B..."
                      className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Counseling date */}
                    <div>
                      <label className="block mb-1">
                        Tanggal & Waktu Konseling
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={inputTanggal}
                        onChange={(e) => setInputTanggal(e.target.value)}
                        className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all"
                      />
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block mb-1">
                        Kategori Konseling
                      </label>
                      <select
                        value={inputKategori}
                        onChange={(e) => setInputKategori(e.target.value)}
                        className="w-full px-3 py-2.5 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-bold tracking-widest transition-all"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Problem text description */}
                  <div>
                    <label className="block mb-1">
                      Keterangan Masalah / Kasus
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputPermasalahan}
                      onChange={(e) => setInputPermasalahan(e.target.value)}
                      placeholder="Detail keluhan, akademik, sosial, atau emosional..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Solutions list description */}
                  <div>
                    <label className="block mb-1">
                      Tindakan Bimbingan / Solusi
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputSolusi}
                      onChange={(e) => setInputSolusi(e.target.value)}
                      placeholder="Langkah bimbingan yang disepakati..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Follow up progress notes */}
                  <div>
                    <label className="block mb-1">
                      Tindak Lanjut / Catatan Perkembangan
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={inputPerkembangan}
                      onChange={(e) => setInputPerkembangan(e.target.value)}
                      placeholder="Saran tindak lanjut bagi perkembangan sosial spiritual..."
                      className="w-full p-3 rounded bg-stone-50 dark:bg-stone-950 text-stone-850 dark:text-white text-[11px] outline-none border border-stone-200 dark:border-stone-800 focus:border-[#3e2723] font-semibold tracking-normal transition-all resize-none"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-4 py-2 rounded bg-stone-50 dark:bg-stone-950 hover:bg-stone-100 text-stone-500 font-black text-[9.5px] uppercase tracking-widest border border-stone-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-[#3e2723] hover:bg-[#5d4037] text-amber-200 font-black text-[9.5px] uppercase tracking-widest shadow"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
