import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { AppUser, Siswa } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Trash2, 
  BookOpen, 
  Save, 
  ClipboardList, 
  Clock, 
  Activity,
  History,
  Check,
  XCircle,
  FileText,
  Printer,
  Ban,
  X
} from 'lucide-react';
import { generateAbsenHarianPDF, generateAbsenBulananPDF } from '../pdfUtils';

interface AbsenHarianViewProps {
  user: AppUser;
  students: Siswa[];
}

interface AbsenHarianRecord {
  id?: string;
  tanggal_str: string; // YYYY-MM-DD
  kelas: string;
  mapel: string;
  guru_uid: string;
  guru_name: string;
  jumlah_hadir: number;
  jumlah_absen: number;
  keterangan: string;
  students: {
    siswa_id: string;
    nama_siswa: string;
    status: 'Hadir' | 'Tidak Hadir';
  }[];
  createdAt?: any;
}

export function AbsenHarianView({ user, students }: AbsenHarianViewProps) {
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input');
  
  // Date selection states
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  });

  const [selectedRecapDate, setSelectedRecapDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  });

  // Unique list of classes from students pool
  const studentClasses = Array.from(new Set(students.map(s => s.kelas).filter(Boolean))).sort();
  const STANDARD_CLASSES = ['10-A', '10-B', '10-C', '11-A', '11-B', '11-C', '12-A', '12-B', '12-C'];
  const availableClasses = studentClasses.length > 0 ? studentClasses : STANDARD_CLASSES;

  const [selectedClass, setSelectedClass] = useState<string>(availableClasses[0] || '10-A');
  const [mapelSubject, setMapelSubject] = useState<string>(user.mapel || '');
  const [keteranganText, setKeteranganText] = useState<string>('Kegiatan Belajar Mengajar (KBM) Harian');

  // Multi-select for absent students (checked = absent, unchecked = present)
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [siswaSearchInput, setSiswaSearchInput] = useState<string>('');

  // Status and feedback states
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History logs from Firestore
  const [history, setHistory] = useState<AbsenHarianRecord[]>([]);
  const [rekapFilterClass, setRekapFilterClass] = useState<string>('semua');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Print state declarations
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7); // Format: "YYYY-MM"
  });
  const [printingRecord, setPrintingRecord] = useState<AbsenHarianRecord | null>(null);
  const [printingMonthly, setPrintingMonthly] = useState<{
    monthStr: string;
    kelas: string;
    records: AbsenHarianRecord[];
    studentsPool: Siswa[];
  } | null>(null);

  // Filter students based on selected class and search query
  const filteredStudents = students
    .filter(s => s.kelas === selectedClass)
    .filter(s => s.nama_lengkap.toLowerCase().includes(siswaSearchInput.toLowerCase()));

  // Setup Real-time history listener for currently logged in teacher
  useEffect(() => {
    if (!user.uid) return;
    const q = query(
      collection(db, 'absen_harian'),
      where('guru_uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AbsenHarianRecord));

      // Sort client-side desc by createdAt or date fallback
      records.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.tanggal_str || '').localeCompare(a.tanggal_str || '');
      });

      setHistory(records);
    }, (err) => {
      console.error("Error fetching historical database records:", err);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Reset checked list whenever target class changes
  useEffect(() => {
    setAbsentStudentIds([]);
    setSiswaSearchInput('');
  }, [selectedClass]);

  // Toggle single student absent status
  const handleToggleAbsent = (siswaId: string) => {
    setAbsentStudentIds(prev => 
      prev.includes(siswaId) 
        ? prev.filter(id => id !== siswaId)
        : [...prev, siswaId]
    );
  };

  const handleSelectAllAbsent = (shouldSelectAll: boolean) => {
    const classSiswaIds = students.filter(s => s.kelas === selectedClass).map(s => s.id).filter(Boolean) as string[];
    if (shouldSelectAll) {
      setAbsentStudentIds(classSiswaIds);
    } else {
      setAbsentStudentIds([]);
    }
  };

  // Submit and save action
  const handleSubmitAbsensi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      setErrorMsg('Silakan pilih kelas terlebih dahulu.');
      return;
    }
    if (!mapelSubject.trim()) {
      setErrorMsg('Silakan isi mata pelajaran.');
      return;
    }

    const classSiswa = students.filter(s => s.kelas === selectedClass);
    if (classSiswa.length === 0) {
      setErrorMsg(`Tidak ada siswa terdaftar di Kelas ${selectedClass} pada Pangkalan Data.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Map all students in class: Checked as 'Tidak Hadir', Unchecked as 'Hadir'
      const studentsPayload = classSiswa.map(s => ({
        siswa_id: s.id || '',
        nama_siswa: s.nama_lengkap,
        status: absentStudentIds.includes(s.id || '') ? ('Tidak Hadir' as const) : ('Hadir' as const)
      }));

      const payload: AbsenHarianRecord = {
        tanggal_str: selectedDate,
        kelas: selectedClass,
        mapel: mapelSubject.trim(),
        guru_uid: user.uid,
        guru_name: user.name,
        jumlah_hadir: studentsPayload.filter(s => s.status === 'Hadir').length,
        jumlah_absen: studentsPayload.filter(s => s.status === 'Tidak Hadir').length,
        keterangan: keteranganText.trim() || 'Kegiatan Belajar Mengajar Harian',
        students: studentsPayload
      };

      await addDoc(collection(db, 'absen_harian'), {
        ...payload,
        createdAt: serverTimestamp()
      });

      setSuccessMsg(`Absensi untuk kelas ${selectedClass} berhasil disimpan ke histori.`);
      setAbsentStudentIds([]);
      setSiswaSearchInput('');
      
      // Auto-dismiss success message and redirect slightly
      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab('rekap');
      }, 2500);

    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menyimpan absensi santri: ' + (err instanceof Error ? err.message : 'Unknown error'));
      handleFirestoreError(err, OperationType.WRITE, 'absen_harian');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete absolute record
  const handleDeleteRecord = async (recordId: string) => {
    try {
      await deleteDoc(doc(db, 'absen_harian', recordId));
      setSuccessMsg('Histori absensi berhasil dibatalkan/dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menghapus log data.');
    }
  };

  // Filter history records for currently selected recap date
  const filteredHistory = history.filter(item => {
    const isDateMatch = item.tanggal_str === selectedRecapDate;
    const isClassMatch = rekapFilterClass === 'semua' || item.kelas === rekapFilterClass;
    return isDateMatch && isClassMatch;
  });

  const formatBulanIndo = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${months[monthIdx] || ''} ${year}`;
  };

  const formatTanggalIndo = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${day} ${months[monthIdx] || ''} ${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Banner Header Style consistent with standard design */}
      <div className="bg-[#3e2723] rounded-3xl p-6 sm:p-8 md:p-10 text-white overflow-hidden shadow-xl border-b-4 border-amber-950 relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_0)] bg-[size:16px_16px]" />
        </div>
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-200 text-[8.5px] font-black uppercase tracking-[0.2em] rounded-md border border-amber-500/20 w-fit">
              <ClipboardList className="w-3.5 h-3.5 animate-pulse" />
              <span>PRESENCE RECORDING SYSTEM</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-display uppercase tracking-tight text-[#fdfcf0] italic leading-none">
              Absensi Harian Kelas
            </h2>
            <p className="text-[10px] text-amber-200/70 font-bold uppercase tracking-widest max-w-xl italic mt-1 leading-relaxed">
              Pilih kelas pembelajaran, tanda siswa tidak hadir, & generate history absensi real-time otomatis.
            </p>
          </div>

          <div className="flex gap-2 shrink-0 md:pt-2">
            <button
              onClick={() => {
                setActiveTab('input');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-5 py-2.5 rounded-2xl text-[9.5px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'input'
                  ? 'bg-amber-100 text-[#3e2723] shadow-lg shadow-black/10'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              Ambil Absensi
            </button>
            <button
              onClick={() => {
                setActiveTab('rekap');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-5 py-2.5 rounded-2xl text-[9.5px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'rekap'
                  ? 'bg-amber-100 text-[#3e2723] shadow-lg shadow-black/10'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              Rekap Harian
            </button>
          </div>
        </div>
      </div>

      {/* Alerts inside visual margins */}
      <AnimatePresence mode="wait">
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2 text-left shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold flex items-center gap-2 text-left shadow-xs"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      {activeTab === 'input' ? (
        <form onSubmit={handleSubmitAbsensi} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
          {/* Controls Input Left Panel */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-200/50 shadow-sm space-y-4">
              <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#3e2723] border-b pb-2 mb-3">
                Konfigurasi Sesi
              </h3>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                  Tanggal Kegiatan
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Class Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                  Pilih Kelas Pembelajaran
                </label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]" />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer appearance-none"
                    required
                  >
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>Kelas {cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Mapel Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                  Mata Pelajaran (MAPEL)
                </label>
                <div className="relative">
                  <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]" />
                  <input
                    type="text"
                    value={mapelSubject}
                    onChange={(e) => setMapelSubject(e.target.value)}
                    placeholder="Contoh: Fisika, Matematika"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Information Text */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                  Keterangan / Agenda Belajar
                </label>
                <textarea
                  value={keteranganText}
                  onChange={(e) => setKeteranganText(e.target.value)}
                  placeholder="Ketik topik belajarnya..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-2.5 px-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors resize-none h-20"
                />
              </div>

              {/* Quick Actions Checklist */}
              <div className="pt-2 flex gap-1.5 justify-between">
                <button
                  type="button"
                  onClick={() => handleSelectAllAbsent(true)}
                  className="text-[8.5px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 transition-colors"
                >
                  Semua Absen (Sakit/Alfa)
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSelectAllAbsent(false)}
                  className="text-[8.5px] font-black uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition-colors"
                >
                  Semua Hadir (Reset)
                </button>
              </div>
            </div>

            {/* Quick Summary Card indicator */}
            <div className="bg-gradient-to-br from-[#ebdccb]/30 to-[#fcfaf6] p-5 rounded-[2rem] border border-[#ebdccb]/50 text-left space-y-2">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-[#5d4037] flex items-center gap-1 leading-none">
                <Clock className="w-3.5 h-3.5 text-[#8b5e3c]" />
                Ringkasan Draft
              </h4>
              <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                <div className="p-3 bg-white rounded-2xl border border-stone-100 shadow-xs">
                  <span className="text-xl font-black text-emerald-600">
                    {students.filter(s => s.kelas === selectedClass).length - absentStudentIds.length}
                  </span>
                  <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mt-0.5">Siswa Hadir</p>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-stone-100 shadow-xs">
                  <span className="text-xl font-black text-rose-500">
                    {absentStudentIds.length}
                  </span>
                  <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mt-0.5">Tidak Hadir</p>
                </div>
              </div>
            </div>
          </div>

          {/* Student selection right list block */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-200/50 shadow-sm flex flex-col min-h-[500px]">
              
              {/* Header inside table */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-4">
                <div className="text-left">
                  <h3 className="font-display font-black text-sm text-[#3e2723] uppercase tracking-wide">
                    Daftar Nama Siswa ({filteredStudents.length} Terpasang)
                  </h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                    Pilih nama siswa yang tidak hadir saja.
                  </p>
                </div>

                {/* Inline Student Search Filter */}
                <div className="relative w-full sm:max-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={siswaSearchInput}
                    onChange={(e) => setSiswaSearchInput(e.target.value)}
                    placeholder="Cari nama siswa..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors"
                  />
                </div>
              </div>

              {/* Student Checklist list */}
              {filteredStudents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-stone-400">
                  <Users className="w-12 h-12 text-stone-200 mb-2.5" />
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 italic">
                    Belum ada siswa terdaftar di Kelas {selectedClass}
                  </p>
                  <span className="text-[9px] text-stone-400 max-w-xs block leading-relaxed mt-1 tracking-wider uppercase">
                    Silakan pastikan kelas pada Pangkalan Data Siswa sudah sesuai atau cocok.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 flex-1 max-h-[460px] overflow-y-auto pr-1">
                  {filteredStudents.map((siswa, idx) => {
                    const isAbsent = absentStudentIds.includes(siswa.id || '');
                    
                    return (
                      <div
                        key={siswa.id || idx}
                        onClick={() => handleToggleAbsent(siswa.id || '')}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isAbsent 
                            ? 'bg-rose-50/50 border-rose-200/60 shadow-xs' 
                            : 'bg-[#fcfaf6]/50 border-[#ebdccb]/30 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Student Avatar Icon */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isAbsent ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-[#8b5e3c]'
                          }`}>
                            {siswa.nama_lengkap.charAt(0)}
                          </div>
                          <div className="text-left">
                            <h5 className="text-xs font-black uppercase text-stone-800 leading-none">
                              {siswa.nama_lengkap}
                            </h5>
                            <span className="text-[8px] font-mono text-stone-400 uppercase tracking-widest mt-1 block">
                              NIS/NISN: {siswa.nisn || siswa.nik || '-'} • Kelas {siswa.kelas}
                            </span>
                          </div>
                        </div>

                        {/* Status indicators */}
                        {isAbsent ? (
                          <div className="flex items-center gap-1 bg-rose-100 text-rose-700 font-extrabold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-xl border border-rose-200 animate-in zoom-in-95 duration-100">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tidak Hadir</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-xl border border-emerald-200">
                            <Check className="w-3.5 h-3.5" />
                            <span>Hadir</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="border-t pt-5 mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || filteredStudents.length === 0}
                  className="bg-[#3e2723] hover:bg-[#5d4037] active:scale-[0.98] transition-transform text-amber-100 font-black text-[10.5px] uppercase tracking-widest py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" />
                      YANG MENYIMPAN...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-amber-200 animate-pulse" />
                      SIMPAN ABSENSI KELAS
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

        </form>
      ) : (
        /* REKAP TAB */
        <div className="space-y-6 text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Filter Panel Left */}
            <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-stone-200/50 shadow-xs space-y-4">
              <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#3e2723] pb-2 border-b">
                Filter Rekap Harian
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Filter Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                    Pilih Tanggal Kegiatan
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]" />
                    <input
                      type="date"
                      value={selectedRecapDate}
                      onChange={(e) => setSelectedRecapDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                    />
                  </div>
                </div>

                {/* Filter Class */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                    Kelas Harian
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b5e3c]" />
                    <select
                      value={rekapFilterClass}
                      onChange={(e) => setRekapFilterClass(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                    >
                      <option value="semua">Semua Kelas</option>
                      {availableClasses.map(cls => (
                        <option key={cls} value={cls}>Kelas {cls}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Match and summary labels inside info bar */}
              <div className="bg-[#fcfaf6] border border-[#ebdccb]/40 p-3.5 rounded-2xl flex items-center justify-between">
                <span className="text-[9px] font-black text-[#8b5e3c] uppercase tracking-widest">Sesi Ditemukan</span>
                <span className="bg-[#3e2723] text-amber-200 font-extrabold text-[10px] px-3 py-1 rounded-lg">
                  {filteredHistory.length} Log Presensi
                </span>
              </div>
            </div>

            {/* Monthly Compilation Panel Right */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#ebdccb]/20 to-white p-6 rounded-[2rem] border border-[#ebdccb]/50 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#3e2723] pb-2 border-b border-[#ebdccb]/40">
                  Kompilasi Rekap Bulanan
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  {/* Month Picker */}
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#5d4037] block">
                      Pilih Bulan Rekap
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-xs font-bold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                    />
                  </div>

                  {/* Summary context info */}
                  <div className="text-left flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-stone-500">Kelas Target:</p>
                    <p className="text-[12px] font-black text-[#3e2723] uppercase">
                      Kelas {rekapFilterClass === 'semua' ? availableClasses[0] || '10-A' : rekapFilterClass}
                    </p>
                    {rekapFilterClass === 'semua' && (
                      <p className="text-[8px] text-amber-800 font-bold block leading-none mt-0.5">
                        *Default ke {availableClasses[0] || '10-A'} (Pilih satu kelas di samping)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action trigger button */}
              <button
                type="button"
                onClick={() => {
                  const targetCls = rekapFilterClass === 'semua' ? (availableClasses[0] || '10-A') : rekapFilterClass;
                  const monthlyRecords = history.filter(
                    item => item.kelas === targetCls && item.tanggal_str.startsWith(selectedMonth)
                  );
                  const classStudents = students.filter(s => s.kelas === targetCls);
                  
                  setPrintingMonthly({
                    monthStr: selectedMonth,
                    kelas: targetCls,
                    records: monthlyRecords,
                    studentsPool: classStudents
                  });
                }}
                className="w-full bg-[#3e2723] hover:bg-[#5d4037] text-[#fdfcf0] font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] mt-3"
              >
                <Printer className="w-4 h-4 text-amber-200 animate-pulse" />
                Cetak Rekap Bulanan
              </button>
            </div>
          </div>

          {/* Records list container */}
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-[#d7ccc8]">
                <FileText className="w-12 h-12 text-[#d7ccc8]/40 mx-auto mb-4" />
                <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] italic">
                  Belum ada log absensi terdaftar untuk tanggal {selectedRecapDate}
                </p>
                <span className="text-[9px] text-stone-400/80 uppercase tracking-wider block mt-1">
                  Pilih tab "Ambil Absensi" di atas untuk menyimpan log pengajaran baru.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHistory.map((record) => (
                  <div
                    key={record.id}
                    className="bg-white rounded-[2rem] border border-stone-200/50 shadow-xs hover:shadow-sm transition-all overflow-hidden flex flex-col"
                  >
                    {/* Header Card status bar */}
                    <div className="bg-[#fcfaf6] p-4 border-b border-stone-100 flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#8b5e3c] bg-[#f8f3ed] px-2 py-0.5 rounded border border-[#ebdccb]/40">
                          {record.mapel}
                        </span>
                        <h4 className="font-display font-black text-sm text-[#3e2723] uppercase tracking-tight mt-1">
                          Kelas {record.kelas}
                        </h4>
                      </div>

                      {/* Delete buttons with inline safeguard validation */}
                      <div className="flex items-center shrink-0">
                        {confirmingDeleteId === record.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              onClick={() => {
                                handleDeleteRecord(record.id!);
                                setConfirmingDeleteId(null);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors"
                            >
                              Hapus?
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(record.id || null)}
                            className="bg-transparent hover:bg-rose-50 border border-transparent hover:border-rose-100 p-2 rounded-xl text-stone-400 hover:text-rose-600 transition-colors"
                            title="Hapus Sesi Absensi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle stats & description content */}
                    <div className="p-5 flex-1 space-y-4">
                      {/* Sub-header info */}
                      <div className="flex items-center justify-between text-[9px] text-stone-400 font-bold uppercase tracking-widest">
                        <span>Pendidik: {record.guru_name}</span>
                        <span>{record.tanggal_str}</span>
                      </div>

                      <div className="p-3 bg-[#fdfcf9] border border-[#ebdccb]/30 rounded-2xl italic text-[11px] text-[#5d4037] leading-relaxed">
                        Topik: {record.keterangan}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-b py-3 text-center">
                        <div className="bg-emerald-50 border border-emerald-100/55 p-2 rounded-xl">
                          <span className="text-base font-black text-emerald-800">{record.jumlah_hadir}</span>
                          <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider block">Hadir</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-100/55 p-2 rounded-xl">
                          <span className="text-base font-black text-rose-700">{record.jumlah_absen}</span>
                          <span className="text-[8px] font-bold text-rose-600 uppercase tracking-wider block">Tidak Hadir</span>
                        </div>
                      </div>

                      {/* Nested Student Status list (Table layout with 'Hadir' and 'Tidak Hadir' columns) */}
                      <div className="space-y-2 text-left">
                        <p className="text-[8.5px] font-black uppercase tracking-widest text-[#5d4037]">Rekap Kehadiran Santri:</p>
                        <div className="max-h-[160px] overflow-y-auto pr-1 border border-stone-100 rounded-2xl overflow-hidden shadow-xs">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-stone-200 text-[9px] font-black uppercase tracking-widest text-stone-400 bg-stone-50/60 sticky top-0">
                                <th className="text-left p-2.5">Nama Siswa</th>
                                <th className="text-center p-2.5 w-[65px]">Hadir</th>
                                <th className="text-center p-2.5 w-[85px]">Tidak Hadir</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 bg-white">
                              {record.students && record.students.map((sts, idx) => {
                                const isPresent = sts.status === 'Hadir';
                                return (
                                  <tr key={idx} className="hover:bg-amber-50/20 transition-colors">
                                    <td className="p-2 text-[11px] font-bold text-stone-800 uppercase tracking-tight max-w-[130px] truncate">
                                      {sts.nama_siswa}
                                    </td>
                                    <td className="p-2 text-center">
                                      {isPresent ? (
                                        <div className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60 w-5 h-5 rounded-md mx-auto">
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </div>
                                      ) : (
                                        <span className="text-stone-300 font-mono text-[9px]">-</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-center">
                                      {!isPresent ? (
                                        <div className="inline-flex items-center justify-center bg-rose-50 text-rose-700 border border-rose-200/60 w-5 h-5 rounded-md mx-auto">
                                          <XCircle className="w-3 h-3 text-rose-600" />
                                        </div>
                                      ) : (
                                        <span className="text-stone-300 font-mono text-[9px]">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Actions & Teacher Signature Block */}
                      <div className="pt-4 border-t border-dashed border-[#ebdccb]/50 mt-4 flex items-end justify-between gap-4 flex-wrap">
                        {/* Print Daily Action Button */}
                        <button
                          onClick={() => setPrintingRecord(record)}
                          className="flex items-center gap-2 bg-[#8b5e3c]/10 hover:bg-[#8b5e3c]/20 text-[#3e2723] hover:text-[#271815] px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-[#8b5e3c]/20"
                        >
                          <Printer className="w-4 h-4 text-[#8b5e3c]" />
                          Cetak Harian
                        </button>

                        <div className="text-right w-48 bg-[#fdfcf9] border border-[#ebdccb]/30 p-3 rounded-2xl">
                          <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">
                            Guru Mata Pelajaran,
                          </p>
                          <div className="my-3.5 h-10 border-b border-dashed border-stone-200 relative flex items-center justify-center">
                            {/* Signature mockup with elegant styling */}
                            <span className="text-[10px] text-stone-300 font-mono uppercase tracking-widest select-none italic text-center leading-none">
                              Tanda Tangan Digital
                            </span>
                          </div>
                          <p className="text-[11px] font-black uppercase text-[#3e2723] tracking-normal leading-tight">
                            {record.guru_name || user.name || 'GURU MAPEL'}
                          </p>
                          <p className="text-[8px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                            ID: {record.guru_uid.substring(0, 10).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            color: #000 !important;
            font-family: Arial, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #111 !important;
            padding: 6px 10px !important;
            font-size: 10px !important;
          }
        }
      `}} />

      {/* MODAL 1: Cetak Harian */}
      <AnimatePresence>
        {printingRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-stone-100 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#ebdccb]/40 flex flex-col max-h-[92vh]"
            >
              {/* Header Controls */}
              <div className="bg-[#3e2723] p-4 text-[#fdfcf0] flex items-center justify-between no-print shrink-0">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-200 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Preview Cetak Harian</h4>
                    <p className="text-[9px] text-[#ebdccb]/70 font-semibold uppercase tracking-widest mt-0.5">
                      Tanggal: {printingRecord.tanggal_str} • Kelas {printingRecord.kelas}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateAbsenHarianPDF(printingRecord)}
                    className="bg-amber-100 hover:bg-amber-200 text-[#3e2723] px-4 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Mulai Cetak
                  </button>
                  <button
                    onClick={() => setPrintingRecord(null)}
                    className="p-2 rounded-xl hover:bg-white/10 text-stone-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Area Container */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-stone-100 flex justify-center">
                {/* Physical sheet layout preview */}
                <div 
                  id="print-daily-section"
                  className="w-full max-w-xl bg-white p-8 md:p-12 shadow-md rounded-2xl border border-stone-200 text-stone-850 font-sans print:p-0 print:border-none print:shadow-none"
                >
                  {/* Formal Header */}
                  <div className="text-center space-y-1.5 border-b-2 border-stone-850 pb-5 mb-6">
                    <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-stone-900 leading-none text-center">
                      LAPORAN KEHADIRAN HARIAN SISWA
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 text-center">
                      PRESENCE RECORDING SYSTEM • MBM AL-QURAN
                    </p>
                    <div className="w-24 h-0.5 bg-stone-850 mx-auto mt-2" />
                  </div>

                  {/* Document Meta Information */}
                  <div className="grid grid-cols-2 gap-4 text-xs mb-6 text-left border border-stone-200 p-4 rounded-xl bg-stone-50/40">
                    <div className="space-y-1.5">
                      <p className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Tanggal Sesi:</p>
                      <p className="font-black text-stone-800">{formatTanggalIndo(printingRecord.tanggal_str)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Mata Pelajaran (MAPEL):</p>
                      <p className="font-black text-[#5d4037] uppercase">{printingRecord.mapel}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Kelas Pembelajaran:</p>
                      <p className="font-black text-stone-800 uppercase">Kelas {printingRecord.kelas}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Guru Pengampu:</p>
                      <p className="font-black text-stone-800 uppercase">{printingRecord.guru_name}</p>
                    </div>
                    <div className="col-span-2 space-y-1 mt-1 border-t pt-2.5 border-stone-200">
                      <p className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Agenda / Keterangan Pembelajaran:</p>
                      <p className="italic text-stone-700 font-medium font-sans">"{printingRecord.keterangan || 'KBM Harian Standard'}"</p>
                    </div>
                  </div>

                  {/* Attendance Log Table */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-600 text-left border-l-2 border-stone-800 pl-2">
                      DAFTAR KEHADIRAN SISWA
                    </h3>
                    <div className="border border-stone-300 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-300 text-[9px] font-black uppercase tracking-widest text-stone-600">
                            <th className="p-3 w-12 text-center border-r border-stone-300">NO</th>
                            <th className="p-3 border-r border-stone-300">NAMA SISWA</th>
                            <th className="p-3 w-28 text-center border-r border-stone-300">HADIR</th>
                            <th className="p-3 w-28 text-center">TIDAK HADIR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 text-stone-800 text-[11px] font-medium leading-none">
                          {printingRecord.students && printingRecord.students.map((sts, idx) => {
                            const isPresent = sts.status === 'Hadir';
                            return (
                              <tr key={idx} className="hover:bg-stone-50/50">
                                <td className="p-2.5 text-center font-bold text-stone-400 border-r border-stone-200">{idx + 1}</td>
                                <td className="p-2.5 font-bold uppercase tracking-tight text-stone-800 border-r border-stone-200">{sts.nama_siswa}</td>
                                <td className="p-2.5 text-center border-r border-stone-200">
                                  {isPresent ? (
                                    <span className="font-black text-emerald-600 font-sans text-xs">✓</span>
                                  ) : (
                                    <span className="text-stone-300 font-sans">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  {!isPresent ? (
                                    <span className="font-black text-rose-600 font-sans text-xs">✗ (Mangkis)</span>
                                  ) : (
                                    <span className="text-stone-300 font-sans">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stats summary table */}
                  <div className="flex justify-between items-center bg-stone-50 border border-stone-200 p-3 rounded-xl text-[10px] uppercase font-bold text-stone-500 tracking-wider mt-4">
                    <span>Jumlah Siswa Diabsen: {printingRecord.students?.length || 0}</span>
                    <div className="flex gap-4">
                      <span className="text-emerald-700">✓ Hadir: {printingRecord.jumlah_hadir}</span>
                      <span className="text-rose-700">✗ Tidak Hadir: {printingRecord.jumlah_absen}</span>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="mt-10 pt-10 border-t border-dashed border-stone-300 flex justify-end">
                    <div className="text-center w-52 space-y-1 text-xs">
                      <p className="text-stone-500 font-bold uppercase text-[9px] tracking-wider text-center">
                        Surabaya, {formatTanggalIndo(printingRecord.tanggal_str)}
                      </p>
                      <p className="text-stone-700 font-bold uppercase tracking-tight mt-0.5 text-center">
                        Guru Mata Pelajaran,
                      </p>
                      <div className="h-16 border-b border-dashed border-stone-300" />
                      <p className="text-stone-900 font-black uppercase tracking-wide pt-2.5 border-b border-stone-900 leading-none text-center">
                        {printingRecord.guru_name || user.name}
                      </p>
                      <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest pt-0.5 text-center">
                        ID: {printingRecord.guru_uid.substring(0, 10).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Cetak Bulanan */}
      <AnimatePresence>
        {printingMonthly && (() => {
          const recordedDates = Array.from(new Set(printingMonthly.records.map(r => r.tanggal_str))).sort();
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-stone-100 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-[#ebdccb]/40 flex flex-col max-h-[92vh]"
              >
                {/* Header Controls */}
                <div className="bg-[#3e2723] p-4 text-[#fdfcf0] flex items-center justify-between no-print shrink-0">
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-amber-200 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">Preview Cetak Bulanan Rekap</h4>
                      <p className="text-[9px] text-[#ebdccb]/70 font-semibold uppercase tracking-widest mt-0.5">
                        Bulan: {formatBulanIndo(printingMonthly.monthStr)} • Kelas {printingMonthly.kelas}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generateAbsenBulananPDF(printingMonthly.monthStr, printingMonthly.kelas, printingMonthly.records, printingMonthly.studentsPool, user.name)}
                      className="bg-amber-100 hover:bg-amber-200 text-[#3e2723] px-4 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Mulai Cetak
                    </button>
                    <button
                      onClick={() => setPrintingMonthly(null)}
                      className="p-2 rounded-xl hover:bg-white/10 text-stone-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Printable Landscape Sheet container */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-stone-100 flex justify-center">
                  <div 
                    id="print-monthly-section"
                    className="w-full max-w-3xl bg-white p-6 md:p-10 shadow-md rounded-2xl border border-stone-200 text-stone-850 font-sans print:p-0 print:border-none print:shadow-none"
                  >
                    {/* Formal Header */}
                    <div className="text-center space-y-1.5 border-b-2 border-stone-850 pb-4 mb-4">
                      <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-stone-900 leading-none text-center">
                        REKAPITULASI BULANAN KEHADIRAN SISWA
                      </h1>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500 text-center">
                        SISTEM PRESENSI REAL-TIME • PERIODE BULAN: {formatBulanIndo(printingMonthly.monthStr)}
                      </p>
                      <div className="w-24 h-0.5 bg-stone-800 mx-auto mt-2" />
                    </div>

                    {/* Metadata summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] mb-5 text-left border border-stone-200 p-3 rounded-xl bg-stone-50/40">
                      <div>
                        <span className="font-bold text-stone-500 uppercase text-[8.5px] tracking-wider block">Bulan Rekap:</span>
                        <span className="font-black text-stone-800 uppercase">{formatBulanIndo(printingMonthly.monthStr)}</span>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500 uppercase text-[8.5px] tracking-wider block">Kelas Pembelajaran:</span>
                        <span className="font-black text-stone-800 uppercase">Kelas {printingMonthly.kelas}</span>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500 uppercase text-[8.5px] tracking-wider block">Pendidik Pembuat:</span>
                        <span className="font-black text-[#5d4037] uppercase">{user.name}</span>
                      </div>
                    </div>

                    {/* Main monthly grid table */}
                    {printingMonthly.studentsPool.length === 0 ? (
                      <div className="py-12 border border-dashed text-center text-stone-400 rounded-xl">
                        Tidak ada siswa terdaftar pada data kelas {printingMonthly.kelas}.
                      </div>
                    ) : recordedDates.length === 0 ? (
                      <div className="py-12 border border-dashed text-center text-stone-400 rounded-xl space-y-2">
                        <p className="text-[11px] font-black uppercase text-stone-500">Log Kosong</p>
                        <p className="text-[10px] text-stone-400 text-center">Tidak ada sesi absensi yang terekam untuk Kelas {printingMonthly.kelas} pada bulan {formatBulanIndo(printingMonthly.monthStr)}.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-stone-300 rounded-xl shadow-2xs">
                        <table className="w-full text-left border-collapse text-[10px] font-medium min-w-[600px]">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-300 text-[8.5px] font-black uppercase tracking-wider text-stone-600">
                              <th className="p-2 border-r border-stone-300 text-center w-10">NO</th>
                              <th className="p-2 border-r border-stone-300">NAMA LENGKAP SISWA</th>
                              {/* Session dates header */}
                              {recordedDates.map((dateStr) => {
                                const dayStr = dateStr.slice(8, 10); // Extract date
                                const monthStr = dateStr.slice(5, 7); // Extract month
                                return (
                                  <th key={dateStr} className="p-2 border-r border-stone-300 text-center w-[45px] hover:bg-stone-100/50 transition-colors cursor-help" title={dateStr}>
                                    {dayStr}/{monthStr}
                                  </th>
                                );
                              })}
                              {/* Totals columns */}
                              <th className="p-2 border-r border-stone-300 text-center w-[55px] text-emerald-800 bg-emerald-50/50">HADIR (✓)</th>
                              <th className="p-2 text-center w-[60px] text-rose-800 bg-rose-50/50">ABSEN (🛑)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 text-stone-800 text-[10px] font-bold">
                            {printingMonthly.studentsPool.map((student, sIdx) => {
                              let totalHadir = 0;
                              let totalAbsen = 0;

                              return (
                                <tr key={student.id || sIdx} className="hover:bg-stone-50/50">
                                  {/* List number */}
                                  <td className="p-2 text-center text-stone-400 font-bold border-r border-stone-200 bg-stone-50/10">
                                    {sIdx + 1}
                                  </td>
                                  
                                  {/* Student Name */}
                                  <td className="p-2 uppercase font-black tracking-tight text-stone-800 border-r border-stone-200 max-w-[150px] truncate">
                                    {student.nama_lengkap}
                                  </td>
                                  
                                  {/* Ticks and stop icons for each date */}
                                  {recordedDates.map((dateStr) => {
                                    // Identify current record for dateStr
                                    const record = printingMonthly.records.find(r => r.tanggal_str === dateStr);
                                    if (!record) {
                                      return (
                                        <td key={dateStr} className="p-2 text-center border-r border-stone-200 text-stone-300 font-mono">
                                          -
                                        </td>
                                      );
                                    }

                                    const studentMatch = record.students?.find(
                                      s => s.siswa_id === student.id || s.nama_siswa.toLowerCase() === student.nama_lengkap.toLowerCase()
                                    );
                                    
                                    if (!studentMatch) {
                                      return (
                                        <td key={dateStr} className="p-2 text-center border-r border-stone-200 text-stone-300 font-mono">
                                          -
                                        </td>
                                      );
                                    }

                                    const isPresent = studentMatch.status === 'Hadir';
                                    if (isPresent) totalHadir++;
                                    else totalAbsen++;

                                    return (
                                      <td key={dateStr} className="p-2 text-center border-r border-stone-200">
                                        {isPresent ? (
                                          <span className="font-extrabold text-[#2e7d32] text-xs">✓</span>
                                        ) : (
                                          <span className="font-extrabold text-[#c62828] text-xs" title="Tidak Hadir / Stop">🛑</span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* Attendee Counters inside row end cells */}
                                  <td className="p-2 text-center border-r border-stone-200 font-black text-emerald-700 bg-emerald-50/15">
                                    {totalHadir} Sesi
                                  </td>
                                  <td className="p-2 text-center font-black text-rose-700 bg-rose-50/15">
                                    {totalAbsen} Sesi
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Quick description info */}
                    <div className="flex justify-between items-center bg-stone-50 border border-stone-200 p-3 rounded-xl text-[8.5px] uppercase font-black text-stone-400 tracking-wider mt-4">
                      <span>Total Sesi Terkompilasi: {recordedDates.length} Hari</span>
                      <span>Hadir = ✓ Cetak Hijau • Tidak Hadir = 🛑 Logo Stop</span>
                    </div>

                    {/* Teacher signature section */}
                    <div className="mt-10 pt-8 border-t border-dashed border-stone-300 flex justify-end">
                      <div className="text-center w-52 space-y-1 text-xs">
                        <p className="text-stone-500 font-bold uppercase text-[9px] tracking-wider text-center">
                          Surabaya, Akhir {formatBulanIndo(printingMonthly.monthStr)}
                        </p>
                        <p className="text-stone-700 font-bold uppercase tracking-tight mt-0.5 text-center font-bold">
                          Guru Mata Pelajaran,
                        </p>
                        <div className="h-16 border-b border-dashed border-stone-300" />
                        <p className="text-stone-900 font-black uppercase tracking-wide pt-2.5 border-b border-stone-900 leading-none text-center">
                          {user.name}
                        </p>
                        <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest pt-0.5 text-center">
                          PENDIDIK RESMI
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
