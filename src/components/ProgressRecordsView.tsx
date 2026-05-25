import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { ProgressRecord, AppUser, Siswa } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Activity, User, Calendar, CheckCircle2, Clock, ChevronRight, MessageSquare, ShieldCheck, Check, Download, X, Printer, FileText, Plus, Send, Loader2 } from 'lucide-react';
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
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSuggestions, setStudentSuggestions] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newRecord, setNewRecord] = useState({
    nama_siswa: '',
    kelas: '',
    isi_catatan: ''
  });

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
    let q;
    q = query(
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

  const filteredRecords = records.filter(r => 
    r.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.author_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.isi_catatan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Activity className="w-12 h-12 text-indigo-400 animate-pulse mb-4" />
        <p className="text-slate-400 font-bold animate-pulse">Memuat Catatan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white relative">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg border border-white/5">
                    <FileText className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight uppercase">Detail Catatan</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] italic">{selectedRecord.nama_siswa}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Siswa / Kelas</p>
                    <p className="text-sm font-black text-slate-900">{selectedRecord.nama_siswa} (Kelas {selectedRecord.kelas})</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Tanggal</p>
                    <p className="text-sm font-black text-slate-900">
                      {selectedRecord.tgl_catatan?.toDate ? format(selectedRecord.tgl_catatan.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 italic">Isi Catatan</p>
                  <p className="text-slate-600 font-medium leading-relaxed italic whitespace-pre-wrap">
                    "{selectedRecord.isi_catatan}"
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Dibuat Oleh</p>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">{selectedRecord.author_name}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    selectedRecord.is_acknowledged 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {selectedRecord.is_acknowledged ? 'Diterima' : 'Menunggu'}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => downloadPDF(selectedRecord)}
                  className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-black transition-all flex items-center justify-center gap-2 italic"
                >
                  <Download className="w-4 h-4" />
                  Unduh PDF
                </button>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-8 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all italic"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Style matching Slate Theme */}
      <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-slate-950 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-white/5 shrink-0">
              <ClipboardList className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Catatan Perkembangan</h1>
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                  MONITORING
                </span>
              </div>
              <p className="text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest italic">
                Log Perkembangan & Aktivitas Siswa
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 mr-2">
              <button 
                onClick={() => generateProgressRecordReportPDF(records, 'minggu', user.name)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter italic">Minggu</span>
                </div>
              </button>
              <div className="w-[1px] bg-slate-700 mx-1 self-stretch" />
              <button 
                onClick={() => generateProgressRecordReportPDF(records, 'bulan', user.name)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter italic">Bulan</span>
                </div>
              </button>
            </div>

            {user.role !== 'wali_asuh' && (
              <button
                onClick={() => setIsAdding(!isAdding)}
                className={`group px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-black/20 ${
                  isAdding 
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 border-b-4 border-blue-800 italic'
                }`}
              >
                {isAdding ? 'Batal' : (
                  <>
                    <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                    Catat Baru
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-10 text-white relative">
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    onCloseAdd?.();
                  }}
                  className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-slate-800 rounded-[1.5rem] flex items-center justify-center shadow-2xl border border-white/5">
                    <Plus className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight uppercase leading-none">Tambah Catatan</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">Perkembangan Baru</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 italic">Nama Siswa</label>
                    <input
                      type="text"
                      required
                      value={newRecord.nama_siswa}
                      onChange={(e) => handleStudentSearch(e.target.value)}
                      onFocus={() => {
                        if (newRecord.nama_siswa.length > 1) setShowSuggestions(true);
                      }}
                      placeholder="Masukkan nama lengkap siswa..."
                      className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold text-slate-700 italic placeholder:text-slate-300"
                    />
                    
                    <AnimatePresence>
                      {showSuggestions && studentSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-[110] left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto"
                        >
                          {studentSuggestions.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => selectStudent(student)}
                              className="w-full px-8 py-4 text-left hover:bg-slate-50 flex flex-col transition-colors border-b border-slate-50 last:border-0"
                            >
                              <span className="text-sm font-black text-slate-900 italic">{student.nama_lengkap}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase italic">Kelas {student.kelas}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {showSuggestions && (
                      <div 
                        className="fixed inset-0 z-[105]" 
                        onClick={() => setShowSuggestions(false)}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 italic">Kelas</label>
                    <input
                      type="text"
                      required
                      value={newRecord.kelas}
                      onChange={(e) => setNewRecord({...newRecord, kelas: e.target.value})}
                      placeholder="Contoh: X-1, XI-IPA..."
                      className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold text-slate-700 italic placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 italic">Isi Catatan</label>
                    <textarea
                      required
                      value={newRecord.isi_catatan}
                      onChange={(e) => setNewRecord({...newRecord, isi_catatan: e.target.value})}
                      placeholder="Tuliskan catatan perkembangan di sini..."
                      rows={6}
                      className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-600 leading-relaxed italic resize-none placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 border-b-4 border-blue-800 italic"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    Simpan Catatan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      onCloseAdd?.();
                    }}
                    className="px-10 bg-white text-slate-400 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest border-2 border-slate-100 hover:bg-slate-50 transition-all italic"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
          <input
            type="text"
            placeholder="Cari nama siswa atau isi catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none text-sm font-bold text-slate-900 italic placeholder:text-slate-300"
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <ClipboardList className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] italic">Belum ada catatan perkembangan</p>
              </div>
            ) : (
              filteredRecords.map((record, idx) => {
                const recordDate = record.tgl_catatan?.toDate ? record.tgl_catatan.toDate() : new Date();
                const isExpanded = !!expandedRecords[record.id || ''];
                const textLimit = 150;
                const bodyText = record.isi_catatan || '';
                const isTruncated = bodyText.length > textLimit;
                const displayText = isExpanded ? bodyText : (isTruncated ? `${bodyText.substring(0, textLimit)}...` : bodyText);

                return (
                  <motion.div
                    key={record.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedRecord(record)}
                    className={`group relative w-full max-w-2xl mx-auto bg-[#fdfaf5] rounded-[1.25rem] shadow-sm hover:shadow-md border p-5 flex flex-col justify-between space-y-3.5 transition-all duration-300 cursor-pointer ${
                      !record.is_acknowledged 
                        ? 'border-[#8d6e63] bg-[#faf6f0] ring-1 ring-[#8d6e63]/20' 
                        : 'border-[#ebdccb] hover:border-[#8d6e63]/70'
                    }`}
                  >
                    {/* Header: Author & Student metadata */}
                    <div className="flex items-center justify-between gap-4 w-full border-b border-[#ebdccb]/60 pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Styled Initial Avatar */}
                        <div className="w-8 h-8 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-xs">
                          {record.nama_siswa?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-[#3e2723] text-xs leading-tight italic truncate uppercase">
                              {record.nama_siswa}
                            </h4>
                            <span className="bg-[#3e2723] text-amber-200 text-[6.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                              {record.kelas}
                            </span>
                          </div>
                          
                          {/* Sender Info details */}
                          <div className="flex items-center gap-1.5 mt-1 font-sans text-[8px] font-bold text-[#8d6e63]/80 uppercase tracking-wider">
                            <User className="w-2.5 h-2.5 text-[#5d4037]/75" />
                            <span>Pengirim: <strong className="text-[#3e2723] font-extrabold">{record.author_name}</strong></span>
                            <span className="text-stone-300 font-normal">|</span>
                            <span className="bg-[#f5ebe0] text-[#5d4037] text-[6.5px] px-1 py-0.5 rounded border border-[#ebdccb]/40">
                              {record.author_role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Hand Quick Status Check / Action */}
                      <div className="shrink-0 flex items-center gap-2">
                        {!record.is_acknowledged && user.role === 'wali_asuh' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(record.id!);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 bg-[#5d4037] hover:bg-[#3e2723] rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-1"
                            title="Terima Catatan"
                          >
                            <Check className="w-3 h-3" />
                            <span>Terima</span>
                          </button>
                        ) : (
                          <div className={`flex items-center gap-1 py-1 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                            record.is_acknowledged 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{record.is_acknowledged ? 'Diterima' : 'Menunggu'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Catatan Body text area */}
                    <div className="text-left py-0.5">
                      <p className="text-[#3e2723] text-[11px] md:text-xs font-semibold leading-relaxed italic whitespace-pre-wrap">
                        "{displayText}"
                      </p>
                      
                      {isTruncated && (
                        <button
                          onClick={(e) => toggleExpandRecord(record.id!, e)}
                          className="text-[#5d4037] hover:text-[#3e2723] font-black text-[8px] uppercase tracking-widest italic mt-2.5 inline-flex items-center gap-1 bg-[#f5ebe0] hover:bg-[#ebdccb] px-2.5 py-1 rounded transition-all select-none border border-[#e4d5c9]"
                        >
                          {isExpanded ? 'Sembunyikan' : 'Selengkapnya'}
                        </button>
                      )}
                    </div>

                    {/* Integrated 7:16 exact date time block */}
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-[#8d6e63] tracking-widest pt-2.5 border-t border-[#ebdccb]/40">
                      <Clock className="w-3.5 h-3.5 text-[#3e2723]/60 shrink-0" />
                      <span className="font-medium">
                        {format(recordDate, 'EEEE, d MMMM yyyy • HH:mm:ss', { locale: id })} WIB
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

