import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, DormitoryLoss, Siswa, LossStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateLossesReportPDF } from '../pdfUtils';
import { 
  Plus, Search, Printer, Edit2, Trash2, Calendar, 
  User, CheckCircle2, FileText, AlertCircle, X, ChevronRight, HelpCircle, MapPin, Package, RefreshCw,
  Clock, Shield, Info
} from 'lucide-react';

interface DormitoryLossesViewProps {
  user: AppUser;
  students: Siswa[];
}

export default function DormitoryLossesView({ user, students }: DormitoryLossesViewProps) {
  const [records, setRecords] = useState<DormitoryLoss[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modals activation states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DormitoryLoss | null>(null);
  const [detailRecord, setDetailRecord] = useState<DormitoryLoss | null>(null);

  // Form input fields
  const [inputSiswaName, setInputSiswaName] = useState('');
  const [inputKelas, setInputKelas] = useState('');
  const [inputTanggal, setInputTanggal] = useState('');
  const [inputNamaBarang, setInputNamaBarang] = useState('');
  const [inputDeskripsiBarang, setInputDeskripsiBarang] = useState('');
  const [inputLokasiTerakhir, setInputLokasiTerakhir] = useState('');
  const [inputStatus, setInputStatus] = useState<LossStatus>('Belum Ditemukan');
  const [inputPerkembangan, setInputPerkembangan] = useState('');

  // Autocomplete/Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Siswa[]>([]);

  // Filtering states
  const [filterSearch, setFilterSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState<'Semua' | LossStatus>('Semua');
  const [filterTime, setFilterTime] = useState<'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');

  const classesList = ['Semua', ...Array.from(new Set(students.map(s => s.kelas).filter(Boolean)))].sort();
  const statusesList: LossStatus[] = ['Belum Ditemukan', 'Ditemukan', 'Telah Diganti'];

  // Subscribe to dormitory_losses database collection
  useEffect(() => {
    // Both roles can see everything, but standard has author role restrictions if applicable.
    // Wait, the prompt says "buat menu baru di halaman wali asuh dan wali asrma bernama Kehilangan di Asrama"
    // And for Student counseling it was: "hanya tampil di masing masing user yang menginput, kecuali user wali asuh yang proseshidup1101@gmail.com, user itu dapat melihat semua inputan"
    // Since "Kehilangan" is a shared asrama issue, any user should be able to view all missing records so they can help find them!
    // But we can let them see all, or only theirs unless superuser. Let's look at the requirement:
    // "Sekrang tetap dengan nuansa coklat itu, buat menu baru di halaman wali asuh dan wali asrma bernama Kehilangan di Asrama..."
    // The requirement is that it is a common tracking list in dormitory. Let's make it show all losses so that both "wali asuh" and "wali asrma" can cooperate.
    const q = query(collection(db, 'dormitory_losses'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DormitoryLoss));

      // Sort by loss date desc
      const sorted = docsData.sort((a, b) => {
        const tA = a.tgl_kehilangan?.toDate ? a.tgl_kehilangan.toDate().getTime() : 0;
        const tB = b.tgl_kehilangan?.toDate ? b.tgl_kehilangan.toDate().getTime() : 0;
        return tB - tA;
      });

      setRecords(sorted);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'dormitory_losses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle student suggestions filter
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

  // Submit new loss incident
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSiswaName || !inputKelas || !inputTanggal || !inputNamaBarang || !inputDeskripsiBarang || !inputLokasiTerakhir) {
      alert('Mohon lengkapi semua data wajib!');
      return;
    }

    setLoading(true);
    try {
      const dateVal = new Date(inputTanggal);
      const newLoss: Omit<DormitoryLoss, 'id'> = {
        siswa_name: inputSiswaName,
        kelas: inputKelas,
        tgl_kehilangan: Timestamp.fromDate(dateVal),
        nama_barang: inputNamaBarang,
        deskripsi_barang: inputDeskripsiBarang,
        lokasi_terakhir: inputLokasiTerakhir,
        status: inputStatus,
        perkembangan: inputPerkembangan || 'Belum ada perkembangan terbaru.',
        author_name: user.name,
        author_uid: user.uid,
        author_role: user.role,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'dormitory_losses'), newLoss);
      
      // Clear form inputs
      setInputSiswaName('');
      setInputKelas('');
      setInputTanggal('');
      setInputNamaBarang('');
      setInputDeskripsiBarang('');
      setInputLokasiTerakhir('');
      setInputStatus('Belum Ditemukan');
      setInputPerkembangan('');
      
      setShowCreateModal(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'dormitory_losses');
    } finally {
      setLoading(false);
    }
  };

  // Open Update Modal
  const openUpdateModal = (rec: DormitoryLoss) => {
    setSelectedRecord(rec);
    setInputStatus(rec.status);
    setInputPerkembangan(rec.perkembangan || '');
    setShowUpdateModal(true);
  };

  // Submit Incident Update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !selectedRecord.id) return;

    setLoading(true);
    try {
      const docRef = doc(db, 'dormitory_losses', selectedRecord.id);
      await updateDoc(docRef, {
        status: inputStatus,
        perkembangan: inputPerkembangan || 'Belum ada perkembangan terbaru.'
      });

      setShowUpdateModal(false);
      setSelectedRecord(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'dormitory_losses');
    } finally {
      setLoading(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan kehilangan ini?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'dormitory_losses', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'dormitory_losses');
    } finally {
      setLoading(false);
    }
  };

  // Filter records in memory
  const filteredRecords = records.filter(rec => {
    // Search match
    const searchLower = filterSearch.toLowerCase();
    const matchSearch = 
      (rec.siswa_name || '').toLowerCase().includes(searchLower) ||
      (rec.nama_barang || '').toLowerCase().includes(searchLower) ||
      (rec.lokasi_terakhir || '').toLowerCase().includes(searchLower);

    // Class match
    const matchClass = filterKelas === 'Semua' || rec.kelas === filterKelas;

    // Status match
    const matchStatus = filterStatus === 'Semua' || rec.status === filterStatus;

    // Time filter
    let matchTime = true;
    if (rec.tgl_kehilangan) {
      const date = rec.tgl_kehilangan.toDate();
      const now = new Date();
      if (filterTime === 'hari_ini') {
        matchTime = date.toDateString() === now.toDateString();
      } else if (filterTime === 'minggu_ini') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchTime = date >= weekAgo;
      } else if (filterTime === 'bulan_ini') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchTime = date >= monthAgo;
      }
    }

    return matchSearch && matchClass && matchStatus && matchTime;
  });

  // Print Weekly
  const handlePrintWeekly = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const filtered = filteredRecords.filter(rec => {
      if (!rec.tgl_kehilangan) return false;
      const recDate = rec.tgl_kehilangan.toDate();
      return recDate >= weekAgo;
    });

    generateLossesReportPDF(filtered, 'Rekap Mingguan (7 Hari Terakhir)', user.name);
  };

  // Print Monthly
  const handlePrintMonthly = () => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const filtered = filteredRecords.filter(rec => {
      if (!rec.tgl_kehilangan) return false;
      const recDate = rec.tgl_kehilangan.toDate();
      return recDate >= monthAgo;
    });

    generateLossesReportPDF(filtered, 'Rekap Bulanan (30 Hari Terakhir)', user.name);
  };

  const getStatusBadgeStyles = (status: LossStatus) => {
    switch (status) {
      case 'Belum Ditemukan':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
      case 'Ditemukan':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30';
      case 'Telah Diganti':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800';
    }
  };

  return (
    <div id="dormitory-losses-container" className="space-y-6">
      {/* HEADER COKLAR RAPI */}
      <div id="losses-header" className="bg-[#3e2723] text-[#ebdccb] p-6 rounded-xl border border-[#5d4037] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#5d4037]/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kehilangan di Asrama</h1>
            <p className="text-sm text-[#d7ccc8] mt-1">Pencatatan laporan barang hilang, pelacakan status penemuan, dan tindak lanjut update asrama.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-print-weekly"
              onClick={handlePrintWeekly}
              className="px-4 py-2 bg-[#5d4037] hover:bg-[#4e342e] text-[#ebdccb] text-sm font-semibold rounded-lg border border-[#6d4c41]/50 flex items-center gap-2 transition duration-200 shadow"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Mingguan</span>
            </button>
            <button
              id="btn-print-monthly"
              onClick={handlePrintMonthly}
              className="px-4 py-2 bg-[#5d4037] hover:bg-[#4e342e] text-[#ebdccb] text-sm font-semibold rounded-lg border border-[#6d4c41]/50 flex items-center gap-2 transition duration-200 shadow"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Bulanan</span>
            </button>
            <button
              id="btn-add-loss"
              onClick={() => {
                // Set default input time to format local datetime YYYY-MM-DDTHH:MM
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                setInputTanggal(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-[#ebdccb] hover:bg-[#dfd0be] text-[#3e2723] text-sm font-bold rounded-lg flex items-center gap-2 transition duration-200 shadow-md"
            >
              <Plus className="w-4 h-4 text-[#3e2723]" />
              <span>Input Kejadian</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div id="losses-filters" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Cari barang, siswa, lokasi..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
            >
              {classesList.map(item => (
                <option key={item} value={item}>Kelas: {item}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
            >
              <option value="Semua">Status: Semua</option>
              {statusesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Time Filter */}
          <div>
            <select
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value as any)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
            >
              <option value="semua">Waktu: Semua</option>
              <option value="hari_ini">Hari Ini</option>
              <option value="minggu_ini">7 Hari Terakhir</option>
              <option value="bulan_ini">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* LOSSES LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#3e2723]" />
          <span className="text-sm">Memuat catatan kehilangan...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Package className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
          <h2 className="text-md font-semibold text-zinc-650 dark:text-zinc-300 mt-4">Belum Ada Catatan Kehilangan</h2>
          <p className="text-sm text-zinc-400 mt-1">Gunakan tombol 'Input Kejadian' untuk mendaftarkan barang hilang di asrama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRecords.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => {
                  setDetailRecord(item);
                  setShowDetailModal(true);
                }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-[#ebdccb]/80 transition duration-200"
              >
                <div className="p-5 space-y-4">
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
                          {item.kelas}
                        </span>
                        <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.tgl_kehilangan?.toDate ? item.tgl_kehilangan.toDate().toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-zinc-400" />
                        {item.siswa_name}
                      </h3>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeStyles(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Core description details */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg space-y-2 text-sm border border-zinc-150 dark:border-zinc-850/50">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-[#5d4037] dark:text-[#a1887f] w-24 shrink-0">Nama Barang:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{item.nama_barang}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-[#5d4037] dark:text-[#a1887f] w-24 shrink-0">Lokasi Hilang:</span>
                      <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        {item.lokasi_terakhir}
                      </span>
                    </div>
                    <div className="flex flex-col pt-1.5 border-t border-zinc-200 dark:border-zinc-800 mt-1">
                      <span className="font-semibold text-zinc-400 text-xs uppercase tracking-wider mb-1">Deskripsi</span>
                      <p className="text-zinc-650 dark:text-zinc-300 italic text-xs line-clamp-3">
                        "{item.deskripsi_barang}"
                      </p>
                    </div>
                  </div>

                  {/* Tindak Lanjut / Perkembangan */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Perkembangan/Tindak Lanjut:</span>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-amber-50/20 dark:bg-zinc-950/20 p-2.5 rounded-lg border border-amber-500/10 line-clamp-2">
                      {item.perkembangan || 'Belum ada catatan tindak lanjut terbaru.'}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">
                    Oleh: <span className="font-semibold">{item.author_name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openUpdateModal(item);
                      }}
                      className="px-3 py-1.5 bg-[#ebdccb] hover:bg-[#dfd0be] text-[#3e2723] font-bold rounded flex items-center gap-1 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Update Kejadian</span>
                    </button>
                    {(user.uid === item.author_uid || user.email === 'proseshidup1101@gmail.com' || user.email === 'boxsimokerto5@gmail.com' || user.role === 'wali_asrama' || user.role === 'wali_asuh') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecord(item.id!);
                        }}
                        className="p-1.5 text-red-650 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
                      >
                        <Trash2 className="w-3.7 h-3.7" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-5 bg-[#3e2723] text-[#ebdccb] flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#ebdccb]" />
                  <span>Input Kejadian Kehilangan</span>
                </h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-[#ebdccb]/70 hover:text-[#ebdccb] rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto">
                {/* Siswa & Autocomplete */}
                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350 flex items-center gap-1">
                    Nama Siswa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inputSiswaName}
                    onChange={(e) => handleSiswaNameChange(e.target.value)}
                    placeholder="Ketik nama siswa..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-15 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 divide-y divide-zinc-100 dark:divide-zinc-900">
                      {suggestions.map(s => (
                        <button
                          key={s.nik}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900 flex justify-between items-center"
                        >
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{s.nama_lengkap}</span>
                          <span className="text-zinc-400 font-medium">{s.kelas}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Kelas */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Kelas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inputKelas}
                    onChange={(e) => setInputKelas(e.target.value)}
                    placeholder="Contoh: X-A"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                {/* Tanngal Kehilangan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Tanggal & Estimasi Jam Kehilangan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={inputTanggal}
                    onChange={(e) => setInputTanggal(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                {/* Nama Barang */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inputNamaBarang}
                    onChange={(e) => setInputNamaBarang(e.target.value)}
                    placeholder="Contoh: Dompet Kulit Hitam, HP Samsung, dll"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                {/* Lokasi Terakhir */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Lokasi Terakhir / Estimasi Hilang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inputLokasiTerakhir}
                    onChange={(e) => setInputLokasiTerakhir(e.target.value)}
                    placeholder="Contoh: Kamar 12, Loker Kelas, Masjid Barat"
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                {/* Deskripsi Barang */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Ciri-Ciri / Deskripsi Barang <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={inputDeskripsiBarang}
                    onChange={(e) => setInputDeskripsiBarang(e.target.value)}
                    placeholder="Sebutkan ciri spesifik barang (warna, merk, isi, gantungan kunci, dll)..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                {/* Perkembangan Awal / Status Pencarian */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Tindak Lanjut / Penanganan Awal (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={inputPerkembangan}
                    onChange={(e) => setInputPerkembangan(e.target.value)}
                    placeholder="Contoh: Melakukan pengecekan CCTV koridor, mengumumkan di mading..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 rounded-lg text-sm text-zinc-650 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-[#3e2723] hover:bg-[#4e342e] text-[#ebdccb] text-sm font-bold rounded-lg transition shadow disabled:opacity-50"
                  >
                    Simpan Kejadian
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UPDATE MODAL (Maret update kejadian) */}
      <AnimatePresence>
        {showUpdateModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 bg-[#3e2723] text-[#ebdccb] flex items-center justify-between">
                <h3 className="font-bold text-md flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#ebdccb]" />
                  <span>Update Kejadian Kehilangan</span>
                </h3>
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="p-1 text-[#ebdccb]/70 hover:text-[#ebdccb] rounded transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                {/* Info summary */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg text-xs space-y-1">
                  <div>Siswa: <span className="font-bold">{selectedRecord.siswa_name} ({selectedRecord.kelas})</span></div>
                  <div>Barang: <span className="font-semibold text-[#5d4037] dark:text-[#a1887f]">{selectedRecord.nama_barang}</span></div>
                </div>

                {/* Status selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Status Penemuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={inputStatus}
                    onChange={(e) => setInputStatus(e.target.value as LossStatus)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  >
                    {statusesList.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* Perkembangan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-350">
                    Catatan Perkembangan / Solusi Terbaru <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={inputPerkembangan}
                    onChange={(e) => setInputPerkembangan(e.target.value)}
                    placeholder="Sebutkan status pencarian terbaru, penanganan, atau tindak lanjut ganti rugi..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3e2723]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(false)}
                    className="px-4 py-2 border border-zinc-250 dark:border-zinc-850 rounded text-zinc-650 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-[#ebdccb] hover:bg-[#dfd0be] text-[#3e2723] font-bold rounded shadow transition disabled:opacity-50"
                  >
                    Update Catatan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL MODAL (Rapi, Cokelat, Proporsional, Informasional) */}
      <AnimatePresence>
        {showDetailModal && detailRecord && (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header Cokelat Khas SRMA 24 */}
              <div className="p-5 bg-[#3e2723] text-[#ebdccb] flex items-center justify-between border-b border-[#5d4037]/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#5d4037]/50 rounded-lg border border-[#6d4c41]/30">
                    <Package className="w-5 h-5 text-amber-200 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Detail Kejadian Kehilangan</h3>
                    <p className="text-xs text-[#d7ccc8] mt-0.5">ID Laporan: #{detailRecord.id?.slice(0, 8) || 'Draft'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 text-[#ebdccb]/85 hover:text-[#ebdccb] hover:bg-[#5d4037]/50 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
                {/* Siswa & Status Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50 dark:bg-zinc-950 p-4 rounded-xl border border-stone-200/60 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-[#ebdccb] text-[#3e2723] rounded-lg">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-stone-800 dark:text-zinc-150 text-base">{detailRecord.siswa_name}</span>
                        <span className="px-2 py-0.5 text-xs font-bold bg-[#3e2723] text-[#ebdccb] rounded">Kelas {detailRecord.kelas}</span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-[#a1887f] mt-0.5">Asrama Bimbingan Siswa Mandiri</p>
                    </div>
                  </div>
                  
                  <span className={`self-start sm:self-center px-3 py-1.5 text-xs font-semibold rounded-full border shadow-xs ${getStatusBadgeStyles(detailRecord.status)}`}>
                    {detailRecord.status}
                  </span>
                </div>

                {/* Grid Rincian Waktu & Lokasi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Estimasi Kehilangan */}
                  <div className="p-4 bg-[#fdfbf7] dark:bg-zinc-950 rounded-xl border border-[#ebdccb]/30 dark:border-zinc-800 space-y-1">
                    <span className="text-xs font-bold text-[#5d4037] dark:text-[#a1887f] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Estimasi Waktu Hilang
                    </span>
                    <p className="font-semibold text-stone-800 dark:text-zinc-200 text-sm">
                      {detailRecord.tgl_kehilangan?.toDate ? (
                        <>
                          {detailRecord.tgl_kehilangan.toDate().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </>
                      ) : '-'}
                    </p>
                    {detailRecord.tgl_kehilangan?.toDate && (
                      <p className="text-xs text-stone-500 font-mono">
                        Pukul: {detailRecord.tgl_kehilangan.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    )}
                  </div>

                  {/* Lokasi Terakhir */}
                  <div className="p-4 bg-[#fdfbf7] dark:bg-zinc-950 rounded-xl border border-[#ebdccb]/30 dark:border-zinc-800 space-y-1">
                    <span className="text-xs font-bold text-[#5d4037] dark:text-[#a1887f] uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Lokasi Terakhir
                    </span>
                    <p className="font-semibold text-stone-800 dark:text-zinc-200 text-sm">
                      {detailRecord.lokasi_terakhir}
                    </p>
                    <p className="text-xs text-stone-500">
                      Area lingkungan asrama kediri
                    </p>
                  </div>
                </div>

                {/* Deskripsi & Detail Barang rincian */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#5d4037] dark:text-[#a1887f]" />
                    <span className="text-xs font-bold text-stone-500 dark:text-[#a1887f] uppercase tracking-wider">Identifikasi Barang</span>
                  </div>
                  
                  <div className="bg-[#fcfaf2]/50 dark:bg-zinc-950 rounded-xl p-4 border border-stone-200 dark:border-zinc-800 space-y-3">
                    <div className="space-y-1">
                      <span className="text-xs text-[#8d6e63] font-semibold">Nama Barang</span>
                      <h4 className="font-extrabold text-stone-850 dark:text-white text-base leading-snug">
                        {detailRecord.nama_barang}
                      </h4>
                    </div>
                    
                    <div className="h-px bg-stone-200 dark:bg-zinc-800" />
                    
                    <div className="space-y-1">
                      <span className="text-xs text-[#8d6e63] font-semibold">Ciri-Ciri & Deskripsi Spesifik</span>
                      <p className="text-sm text-stone-750 dark:text-zinc-350 italic leading-relaxed whitespace-pre-line bg-white dark:bg-zinc-900 border border-stone-150 p-3 rounded-lg">
                        "{detailRecord.deskripsi_barang}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Perkembangan & Tindak Lanjut Terkini */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-500 dark:text-[#a1887f] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-650" />
                    Perkembangan & Rencana Tindak Lanjut
                  </span>
                  
                  <div className="bg-[#fbf8f3] dark:bg-zinc-950/60 p-4 rounded-xl border-l-4 border-amber-500/60 shadow-xs space-y-2">
                    <p className="text-sm text-stone-800 dark:text-zinc-300 leading-relaxed font-semibold">
                      {detailRecord.perkembangan || 'Belum ada perkembangan terbaru.'}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap text-xs text-stone-500">
                      <span>Status pencarian dikawal oleh:</span>
                      <span className="font-bold underline text-[#5d4037] dark:text-amber-200">{detailRecord.author_role === 'wali_asrama' || detailRecord.author_role === 'wali_asuh' ? 'Wali Asrama/Asuh' : detailRecord.author_role}</span>
                    </div>
                  </div>
                </div>

                {/* Metadata Laporan / Pelapor */}
                <div className="bg-stone-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-stone-200/50 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start gap-4 text-xs select-none">
                  <div className="space-y-1.5">
                    <div className="text-stone-400 font-bold uppercase tracking-wider">REKAP PELAPOR</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-stone-700 dark:text-zinc-300 font-semibold">{detailRecord.author_name}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 rounded-md text-[10px] uppercase font-bold">
                      {detailRecord.author_role}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 sm:text-right">
                    <div className="text-stone-400 font-bold uppercase tracking-wider">WAKTU REKAMAN</div>
                    <div className="text-stone-650 dark:text-zinc-400 font-mono flex items-center gap-1 sm:justify-end">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {detailRecord.createdAt?.toDate ? detailRecord.createdAt.toDate().toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                    </div>
                    {detailRecord.createdAt?.toDate && (
                      <div className="text-[10px] text-stone-400">
                        Jam: {detailRecord.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-stone-50 dark:bg-zinc-950/60 border-t border-stone-150 dark:border-zinc-850 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const formattedDetails = `LAPORAN KEHILANGAN DORMITORY\n============================\nSiswa: ${detailRecord.siswa_name} (Kelas ${detailRecord.kelas})\nNama Barang: ${detailRecord.nama_barang}\nLokasi Terakhir: ${detailRecord.lokasi_terakhir}\nStatus: ${detailRecord.status}\n\nDeskripsi: "${detailRecord.deskripsi_barang}"\n\nTindak Lanjut: "${detailRecord.perkembangan || '-'}"\n\nDilaporkan Oleh: ${detailRecord.author_name} (${detailRecord.author_role})`;
                    navigator.clipboard.writeText(formattedDetails);
                    alert('Detail laporan berhasil disalin!');
                  }}
                  className="px-4 py-2 border border-stone-300 bg-white dark:bg-zinc-900 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-400" />
                  <span>Salin Detail</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      openUpdateModal(detailRecord);
                    }}
                    className="px-4 py-2 bg-[#ebdccb] hover:bg-[#dfd0be] text-[#3e2723] text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Update</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-5 py-2 bg-[#3e2723] hover:bg-[#4e342e] text-[#ebdccb] text-sm font-bold rounded-lg transition shadow-md"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
