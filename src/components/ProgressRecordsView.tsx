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
              <div className="bg-[#3e2723] p-8 text-white relative">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-[#d7ccc8] rounded-2xl flex items-center justify-center shadow-lg">
                    <FileText className="w-8 h-8 text-[#3e2723]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight uppercase">Detail Catatan</h2>
                    <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em]">{selectedRecord.nama_siswa}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#f8f3ed] rounded-2xl border border-[#d7ccc8]/30">
                    <p className="text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-1 italic">Siswa / Kelas</p>
                    <p className="text-sm font-black text-[#3e2723]">{selectedRecord.nama_siswa} (Kelas {selectedRecord.kelas})</p>
                  </div>
                  <div className="p-4 bg-[#f8f3ed] rounded-2xl border border-[#d7ccc8]/30">
                    <p className="text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-1 italic">Tanggal</p>
                    <p className="text-sm font-black text-[#3e2723]">
                      {selectedRecord.tgl_catatan?.toDate ? format(selectedRecord.tgl_catatan.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-[#d7ccc8]/50 shadow-inner">
                  <p className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-3 italic">Isi Catatan</p>
                  <p className="text-[#3e2723] font-medium leading-relaxed italic whitespace-pre-wrap">
                    "{selectedRecord.isi_catatan}"
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f8f3ed]/50 rounded-2xl border border-[#d7ccc8]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-[#d7ccc8]/30">
                      <User className="w-6 h-6 text-[#3e2723]/40" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-[#3e2723]/40 uppercase tracking-widest leading-none">Dibuat Oleh</p>
                      <p className="text-xs font-black text-[#3e2723] uppercase tracking-tighter">{selectedRecord.author_name}</p>
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

              <div className="p-8 bg-[#f8f3ed] border-t border-[#d7ccc8]/30 flex gap-4">
                <button 
                  onClick={() => downloadPDF(selectedRecord)}
                  className="flex-1 bg-[#3e2723] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all flex items-center justify-center gap-2 italic"
                >
                  <Download className="w-4 h-4" />
                  Unduh PDF
                </button>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-8 bg-white text-[#3e2723]/40 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-[#d7ccc8]/30 hover:bg-[#f8f3ed] transition-all italic"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Style matching Pinjam HP / Catatan Kejadian */}
      <div className="bg-[#3e2723] rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-[#5d4037] relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <ClipboardList className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Catatan Perkembangan</h1>
                <span className="bg-[#d7ccc8]/20 text-[#d7ccc8] px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-[#d7ccc8]/20">
                  MONITORING
                </span>
              </div>
              <p className="text-stone-400 text-[10px] font-semibold mt-1 uppercase tracking-widest italic">
                Log Perkembangan & Aktivitas Siswa
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-[#5d4037] p-1 rounded-2xl border border-[#3e2723] mr-2">
              <button 
                onClick={() => generateProgressRecordReportPDF(records, 'minggu', user.name)}
                className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter italic">Minggu</span>
                </div>
              </button>
              <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
              <button 
                onClick={() => generateProgressRecordReportPDF(records, 'bulan', user.name)}
                className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
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
                className={`group px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                  isAdding 
                  ? 'bg-[#5d4037] text-stone-300 hover:bg-[#3e2723]' 
                  : 'bg-[#3e2723] text-white hover:bg-black shadow-black/20 border border-[#d7ccc8]/20'
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
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-white relative">
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    onCloseAdd?.();
                  }}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight">Tambah Catatan</h2>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Catatan Perkembangan Baru</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 italic">Nama Siswa</label>
                    <input
                      type="text"
                      required
                      value={newRecord.nama_siswa}
                      onChange={(e) => handleStudentSearch(e.target.value)}
                      onFocus={() => {
                        if (newRecord.nama_siswa.length > 1) setShowSuggestions(true);
                      }}
                      placeholder="Masukkan nama lengkap siswa..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                    />
                    
                    <AnimatePresence>
                      {showSuggestions && studentSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-[110] left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto"
                        >
                          {studentSuggestions.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => selectStudent(student)}
                              className="w-full px-6 py-3 text-left hover:bg-indigo-50 flex flex-col transition-colors border-b border-slate-50 last:border-0"
                            >
                              <span className="text-sm font-bold text-slate-700">{student.nama_lengkap}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Kelas {student.kelas}</span>
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
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 italic">Kelas</label>
                    <input
                      type="text"
                      required
                      value={newRecord.kelas}
                      onChange={(e) => setNewRecord({...newRecord, kelas: e.target.value})}
                      placeholder="Contoh: X-1, XI-IPA..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 italic">Isi Catatan</label>
                    <textarea
                      required
                      value={newRecord.isi_catatan}
                      onChange={(e) => setNewRecord({...newRecord, isi_catatan: e.target.value})}
                      placeholder="Tuliskan catatan perkembangan di sini..."
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-600 leading-relaxed italic resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Simpan Catatan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      onCloseAdd?.();
                    }}
                    className="px-8 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all font-display"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-[2.5rem] border border-[#d7ccc8]/20 shadow-sm space-y-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
          <input
            type="text"
            placeholder="Cari nama siswa atau isi catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-[#f8f3ed]/30 border border-[#d7ccc8]/30 rounded-2xl focus:ring-4 focus:ring-[#3e2723]/5 focus:border-[#3e2723] transition-all outline-none text-sm font-bold text-[#3e2723] placeholder:text-stone-300"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-20 bg-[#f8f3ed]/30 rounded-[3rem] border-2 border-dashed border-[#d7ccc8]/30">
                <ClipboardList className="w-12 h-12 text-[#d7ccc8] mx-auto mb-4" />
                <p className="text-[#3e2723]/40 font-bold uppercase tracking-widest text-xs italic">Belum ada catatan perkembangan</p>
              </div>
            ) : (
              filteredRecords.map((record, idx) => (
                <motion.div
                  key={record.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelectedRecord(record)}
                  className={`group relative bg-white rounded-[2rem] p-4 border transition-all hover:shadow-xl hover:shadow-[#3e2723]/5 cursor-pointer ${
                    !record.is_acknowledged ? 'border-[#3e2723]/20 bg-[#fefdfc]' : 'border-stone-100/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Compact Date Box */}
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border shrink-0 transition-all ${
                      !record.is_acknowledged 
                        ? 'bg-[#3e2723] border-[#3e2723] text-white shadow-lg shadow-[#3e2723]/10' 
                        : 'bg-stone-50 border-stone-100 text-stone-300'
                    }`}>
                      <div className="text-[14px] font-black leading-none mb-0.5 italic">
                        {record.tgl_catatan?.toDate ? format(record.tgl_catatan.toDate(), 'dd') : '-'}
                      </div>
                      <div className="text-[7px] font-black uppercase tracking-widest opacity-60">
                        {record.tgl_catatan?.toDate ? format(record.tgl_catatan.toDate(), 'MMM') : '-'}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-[15px] font-black text-[#3e2723] font-display italic group-hover:text-black transition-colors truncate uppercase">
                          {record.nama_siswa}
                        </h4>
                        <span className="px-1.5 py-0.5 bg-[#f8f3ed] text-[#3e2723] text-[7px] font-black uppercase tracking-widest rounded-md border border-[#d7ccc8]/30">
                          {record.kelas}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 px-1 border-l border-stone-100 ml-1">
                        <p className="text-[10px] font-semibold text-stone-400 italic truncate tracking-tight">
                          {record.isi_catatan}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3 pr-2">
                       <div className="text-right hidden sm:block">
                          <p className="text-[8px] font-black text-stone-300 uppercase tracking-widest leading-none">Oleh</p>
                          <p className="text-[9px] font-black text-[#3e2723] italic uppercase truncate max-w-[80px]">{record.author_name}</p>
                       </div>
                       
                       {!record.is_acknowledged && user.role === 'wali_asuh' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(record.id!);
                            }}
                            className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                       ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                            record.is_acknowledged 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                            : 'bg-stone-50 border-stone-100 text-stone-300'
                          }`}>
                            <CheckCircle2 className="w-4 h-4 opacity-70" />
                          </div>
                       )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

