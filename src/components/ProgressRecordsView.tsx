import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { ProgressRecord, AppUser, Siswa } from '../types';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Activity, User, CheckCircle2, Clock, Check, Download, X, Printer, FileText, Plus, Send, Loader2 } from 'lucide-react';
import { notifyAllRoles } from '../services/fcmService';

import { generateProgressRecordPDF, generateProgressRecordReportPDF } from '../pdfUtils';
import { id } from 'date-fns/locale';

interface ProgressRecordsViewProps {
  user: AppUser;
  autoOpenAdd?: boolean;
  onCloseAdd?: () => void;
}

export default function ProgressRecordsView({ user, autoOpenAdd, onCloseAdd }: ProgressRecordsViewProps) {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ProgressRecord | null>(null);
  const [isAdding, setIsAdding] = useState(autoOpenAdd || false);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});
  const [timeFilter, setTimeFilter] = useState<'semua' | 'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini'>('semua');
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSuggestions, setStudentSuggestions] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newRecord, setNewRecord] = useState({
    nama_siswa: '',
    kelas: '',
    isi_catatan: ''
  });

  const toggleExpandRecord = (recordId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedRecords(prev => ({
      ...prev,
      [recordId]: !prev[recordId]
    }));
  };

  useEffect(() => {
    if (autoOpenAdd) {
      setIsAdding(true);
    }
  }, [autoOpenAdd]);

  useEffect(() => {
    // Fetch all students for suggestions
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'siswa'), orderBy('nama_lengkap', 'asc'));
        const snapshot = await getDocs(q);
        const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
        setStudents(studentData);
      } catch (err) {
        console.error('Error fetching students:', err);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'progress_records'),
      orderBy('tgl_catatan', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgressRecord));
      setRecords(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'progress_records');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.role, user.uid]);

  const handleStudentSearch = (value: string) => {
    setNewRecord({ ...newRecord, nama_siswa: value });
    if (value.length > 1) {
      const filtered = students.filter(s => 
        (s.nama_lengkap || '').toLowerCase().includes(value.toLowerCase())
      );
      setStudentSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setStudentSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectStudent = (student: Siswa) => {
    setNewRecord({
      ...newRecord,
      nama_siswa: student.nama_lengkap,
      kelas: student.kelas || ''
    });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.nama_siswa || !newRecord.kelas || !newRecord.isi_catatan) {
      alert('Mohon lengkapi semua field (Nama, Kelas, dan Isi Catatan)');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'progress_records'), {
        ...newRecord,
        author_uid: user.uid,
        author_name: user.name || user.email || 'Guru',
        author_role: user.role,
        tgl_catatan: serverTimestamp(),
        is_acknowledged: false,
      });

      // Notify Wali Asuh
      notifyAllRoles(['wali_asuh'], 'Catatan Baru', `Guru ${user.name || user.email || 'Kami'} telah menambahkan catatan perkembangan untuk siswa ${newRecord.nama_siswa}.`);
      
      setIsAdding(false);
      onCloseAdd?.();
      setNewRecord({ nama_siswa: '', kelas: '', isi_catatan: '' });
      alert('Catatan perkembangan berhasil disimpan!');
    } catch (err) {
      console.error('Progress record creation failed:', err);
      alert(`Gagal menyimpan catatan: ${err instanceof Error ? err.message : String(err)}. Silakan coba lagi.`);
      handleFirestoreError(err, OperationType.CREATE, 'progress_records');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (recordId: string) => {
    try {
      await updateDoc(doc(db, 'progress_records', recordId), {
        is_acknowledged: true
      });
      
      const record = records.find(r => r.id === recordId);
      if (record) {
        notifyAllRoles(['guru_mapel', 'wali_kelas'], 'Catatan Direspon', `Wali Asuh telah menerima catatan untuk siswa ${record.nama_siswa}.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `progress_records/${recordId}`);
    }
  };

  const downloadPDF = async (record: ProgressRecord) => {
    await generateProgressRecordPDF(record);
  };

  const getRecordDate = (r: ProgressRecord): Date => {
    if (r.tgl_catatan && typeof r.tgl_catatan.toDate === 'function') {
      return r.tgl_catatan.toDate();
    }
    return new Date();
  };

  // Pre-calculate filter category counts
  const countAll = records.length;
  const countHariIni = records.filter(r => isToday(getRecordDate(r))).length;
  const countKemarin = records.filter(r => isYesterday(getRecordDate(r))).length;
  const countMingguIni = records.filter(r => isThisWeek(getRecordDate(r))).length;
  const countBulanIni = records.filter(r => isThisMonth(getRecordDate(r))).length;

  const filteredRecords = records.filter(r => {
    // Search filter
    const matchesSearch = searchTerm ? (
      r.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.author_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.isi_catatan || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) : true;
    if (!matchesSearch) return false;

    // Time filter
    const recordDate = getRecordDate(r);
    if (timeFilter === 'hari_ini') return isToday(recordDate);
    if (timeFilter === 'kemarin') return isYesterday(recordDate);
    if (timeFilter === 'minggu_ini') return isThisWeek(recordDate);
    if (timeFilter === 'bulan_ini') return isThisMonth(recordDate);
    return true; // 'semua'
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="w-8 h-8 text-[#8b5e3c] animate-spin mb-3" />
        <p className="text-[#8b5e3c] text-[10px] uppercase tracking-widest font-black animate-pulse">Memuat Catatan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 text-left">
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-200/50"
            >
              <div className="bg-[#3e2723] p-4 text-white relative">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-amber-200" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#d7ccc8]/20 border border-white/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-200" />
                  </div>
                  <div className="text-left font-sans">
                    <h2 className="text-sm font-black italic tracking-tight uppercase leading-none">Detail Catatan</h2>
                    <p className="text-stone-305 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic text-stone-300">{selectedRecord.nama_siswa}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto font-sans text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#fcfaf6] rounded-xl border border-stone-100">
                    <p className="text-[7px] font-bold text-stone-400 uppercase tracking-widest mb-0.5 italic">Siswa / Kelas</p>
                    <p className="text-[10px] font-black text-[#3e2723] uppercase italic">{selectedRecord.nama_siswa} (Kelas {selectedRecord.kelas})</p>
                  </div>
                  <div className="p-3 bg-[#fcfaf6] rounded-xl border border-stone-100">
                    <p className="text-[7px] font-bold text-stone-400 uppercase tracking-widest mb-0.5 italic">Tanggal Catatan</p>
                    <p className="text-[10px] font-black text-[#3e2723] uppercase italic">
                      {selectedRecord.tgl_catatan?.toDate ? format(selectedRecord.tgl_catatan.toDate(), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 relative shadow-inner">
                  <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 italic">Isi Catatan Perkembangan:</p>
                  <p className="text-[10px] font-semibold text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                    "{selectedRecord.isi_catatan}"
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#fcfaf6] rounded-xl border border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center border border-stone-100 shrink-0">
                      <User className="w-4 h-4 text-[#8b5e3c]" />
                    </div>
                    <div>
                      <p className="text-[7px] font-bold text-stone-400 uppercase tracking-widest leading-none">Dibuat Oleh</p>
                      <p className="text-[9.5px] font-black text-[#3e2723] uppercase tracking-tight mt-0.5 italic">{selectedRecord.author_name}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-wider italic ${
                    selectedRecord.is_acknowledged 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedRecord.is_acknowledged ? 'Diterima Wali Asuh' : 'Menunggu Respon'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2">
                <button 
                  onClick={() => downloadPDF(selectedRecord)}
                  className="flex-1 bg-[#3e2723] hover:bg-[#5d4037] text-amber-200 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all italic active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  UNDUH PDF
                </button>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 bg-white text-stone-400 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider border border-stone-200 hover:bg-stone-100 transition-all italic active:scale-95"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Style with Brown theme */}
      <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-md overflow-hidden border border-[#5d4037] relative">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shrink-0 -rotate-2">
              <ClipboardList className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Catatan Perkembangan</h1>
                <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10 italic">
                  Siswa
                </span>
              </div>
              <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-85">
                Monitoring Log Catatan Guru Mapel ke Wali Asuh / Wali Asrama
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#5d4037] p-1 rounded-xl border border-[#3e2723] shadow-inner">
              <button 
                onClick={() => {
                  const filtered = records.filter(r => isThisWeek(getRecordDate(r)));
                  generateProgressRecordReportPDF(filtered, 'minggu', user.name);
                }}
                className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
              >
                <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                <span className="text-[7.5px] font-black uppercase tracking-wider italic">MINGGU</span>
              </button>
              <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
              <button 
                onClick={() => {
                  const filtered = records.filter(r => isThisMonth(getRecordDate(r)));
                  generateProgressRecordReportPDF(filtered, 'bulan', user.name);
                }}
                className="px-2.5 py-1 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn border border-transparent"
              >
                <Printer className="w-3 h-3 text-amber-200/50 group-hover/btn:text-amber-200 transition-colors" />
                <span className="text-[7.5px] font-black uppercase tracking-wider italic">BULAN</span>
              </button>
            </div>

            {user.role !== 'wali_asuh' && (
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="px-3.5 py-2 rounded-lg font-black text-[8px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-amber-600 hover:bg-amber-700 text-white italic shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Catat Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                onCloseAdd?.();
              }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-200/50"
            >
              <div className="bg-[#3e2723] p-4 text-white relative">
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    onCloseAdd?.();
                  }}
                  className="absolute top-4 right-4 p-1 text-amber-250 hover:bg-white/10 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-amber-200" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#d7ccc8]/20 border border-white/10 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5 text-amber-200" />
                  </div>
                  <div className="text-left font-sans">
                    <h2 className="text-sm font-black italic tracking-tight uppercase leading-none">Tambah Catatan</h2>
                    <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic">Perkembangan Baru Siswa</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-left font-sans">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Nama Siswa</label>
                    <input
                      type="text"
                      required
                      value={newRecord.nama_siswa}
                      onChange={(e) => handleStudentSearch(e.target.value)}
                      onFocus={() => {
                        if (newRecord.nama_siswa.length > 1) setShowSuggestions(true);
                      }}
                      placeholder="Masukkan nama lengkap siswa..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[10px] font-semibold text-slate-700 italic placeholder:text-stone-300 shadow-inner"
                    />
                    
                    <AnimatePresence>
                      {showSuggestions && studentSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute z-[110] left-0 right-0 mt-1 bg-white rounded-lg shadow-md border border-stone-100 overflow-hidden max-h-40 overflow-y-auto"
                        >
                          {studentSuggestions.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => selectStudent(student)}
                              className="w-full px-3.5 py-2 text-left hover:bg-stone-50 flex flex-col transition-colors border-b border-stone-50 last:border-0"
                            >
                              <span className="text-[10px] font-black text-[#3e2723] italic">{student.nama_lengkap}</span>
                              <span className="text-[8px] font-bold text-stone-400 uppercase italic">Kelas {student.kelas}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Kelas</label>
                    <input
                      type="text"
                      required
                      value={newRecord.kelas}
                      onChange={(e) => setNewRecord({...newRecord, kelas: e.target.value})}
                      placeholder="Contoh: X-1, XI-IPA..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[10px] font-semibold text-slate-700 italic placeholder:text-stone-300 shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 italic">Isi Catatan</label>
                    <textarea
                      required
                      value={newRecord.isi_catatan}
                      onChange={(e) => setNewRecord({...newRecord, isi_catatan: e.target.value})}
                      placeholder="Tuliskan catatan perkembangan di sini..."
                      rows={4}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg outline-none focus:bg-white focus:border-[#3e2723] transition-all text-[10px] font-semibold text-slate-600 leading-normal italic resize-none placeholder:text-stone-300 shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-[#3e2723] hover:bg-[#5d4037] text-amber-200 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 italic active:scale-95 shadow-sm"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Catatan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      onCloseAdd?.();
                    }}
                    className="px-4 bg-stone-50 text-stone-400 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider border border-stone-200 hover:bg-stone-100 transition-all italic active:scale-95"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Time Categories & Search Container */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Category Time Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
          {[
            { id: 'semua', label: 'Semua', count: countAll },
            { id: 'hari_ini', label: 'Hari Ini', count: countHariIni },
            { id: 'kemarin', label: 'Kemarin', count: countKemarin },
            { id: 'minggu_ini', label: 'Minggu Ini', count: countMingguIni },
            { id: 'bulan_ini', label: 'Bulan Ini', count: countBulanIni }
          ].map((cat) => {
            const isActive = timeFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setTimeFilter(cat.id as any)}
                type="button"
                className={`px-3.5 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all italic border-b-2 ${
                  isActive 
                    ? 'bg-[#3e2723] text-amber-200 border-black shadow-md scale-[1.02]' 
                    : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100/70'
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-48 group shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
          <input
            type="text"
            placeholder="Cari Catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#fcfaf6] border border-stone-100 rounded-lg pl-8 pr-3 py-2 text-[8px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-[#3e2723] transition-all italic text-[#3e2723] placeholder:text-stone-300 shadow-inner"
          />
        </div>
      </div>

      {/* Records Dense Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredRecords.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-xl border-2 border-dashed border-stone-100 text-center flex flex-col items-center justify-center px-6">
              <ClipboardList className="w-12 h-12 text-stone-100 mb-4 opacity-50" />
              <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest italic leading-none mb-2">Data Nihil</h3>
              <p className="text-[9px] font-semibold text-stone-450 uppercase tracking-widest leading-relaxed max-w-xs italic text-stone-400 text-center">Belum ada catatan perkembangan siswa pada kategori ini.</p>
            </div>
          ) : (
            filteredRecords.map((record, idx) => {
              const recordDate = getRecordDate(record);
              const isExpanded = !!expandedRecords[record.id || ''];
              const textLimit = 120;
              const bodyText = record.isi_catatan || '';
              const isTruncated = bodyText.length > textLimit;
              const displayText = isExpanded ? bodyText : (isTruncated ? `${bodyText.substring(0, textLimit)}...` : bodyText);

              return (
                <motion.div
                  key={record.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => setSelectedRecord(record)}
                  className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between h-full font-sans"
                >
                  <div className={`absolute top-0 right-0 w-1 h-full transition-all duration-300 ${
                    record.is_acknowledged ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />

                  <div className="flex flex-col gap-3 w-full">
                    {/* Header: Student Profile Info */}
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#fcfaf6] flex items-center justify-center text-[#3e2723] font-black italic border border-stone-100 group-hover:bg-[#3e2723] group-hover:text-amber-200 transition-all shrink-0 text-[10px]">
                          {record.nama_siswa?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-xs text-[#3e2723] uppercase italic leading-tight truncate">
                              {record.nama_siswa}
                            </h4>
                            <span className="bg-[#5d4037] text-amber-200 text-[6px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                              {record.kelas}
                            </span>
                          </div>
                          <p className="text-[7.5px] font-bold text-stone-400 uppercase mt-1 italic truncate">
                            Oleh: {record.author_name} ({record.author_role === 'guru_mapel' ? 'Guru Mapel' : record.author_role === 'wali_kelas' ? 'Wali Kelas' : 'Pimpinan'})
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Record Body Text */}
                    <div className="bg-[#fcfaf6] p-2.5 rounded-lg border border-stone-50/85 text-left relative">
                      <p className="text-[7.5px] font-bold text-stone-400 uppercase tracking-widest mb-1 italic">Catatan Guru:</p>
                      <p className="text-[9.5px] font-semibold text-slate-700 italic leading-normal">
                        "{displayText}"
                      </p>
                      {isTruncated && (
                        <button
                          onClick={(e) => toggleExpandRecord(record.id!, e)}
                          className="text-[#5d4037] hover:text-[#3e2723] font-bold text-[7px] uppercase tracking-widest italic mt-2 inline-block bg-stone-150 bg-stone-100 hover:bg-[#ebdccb]/60 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {isExpanded ? 'Sembunyikan' : 'Selengkapnya'}
                        </button>
                      )}
                    </div>

                    {/* Footer Area with Datetime & Acknowledge Status / Response Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-auto">
                      <div className="flex items-center gap-1 text-[7.5px] font-bold text-stone-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{format(recordDate, 'dd MMM yyyy • HH:mm', { locale: id })}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!record.is_acknowledged && user.role === 'wali_asuh' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(record.id!);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-705 px-2 py-0.5 rounded text-[6.5px] font-bold uppercase text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm italic"
                          >
                            Terima
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-wider italic ${
                            record.is_acknowledged 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {record.is_acknowledged ? 'Diterima' : 'Menunggu'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
