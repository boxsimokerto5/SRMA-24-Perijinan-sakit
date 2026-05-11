import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import { ProgressRecord, AppUser, Siswa } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Activity, User, Calendar, CheckCircle2, Clock, ChevronRight, MessageSquare, ShieldCheck, Check, Download, X, Printer, FileText, Plus, Send, Loader2 } from 'lucide-react';
import { notifyAllRoles } from '../services/fcmService';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface ProgressRecordsViewProps {
  user: AppUser;
  autoOpenAdd?: boolean;
}

export default function ProgressRecordsView({ user, autoOpenAdd }: ProgressRecordsViewProps) {
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
        tgl_catatan: Timestamp.now(),
        is_acknowledged: false,
        created_at: Timestamp.now()
      });

      // Notify Wali Asuh
      notifyAllRoles(['wali_asuh'], 'Catatan Baru', `Guru ${user.name || user.email || 'Kami'} telah menambahkan catatan perkembangan untuk siswa ${newRecord.nama_siswa}.`);
      
      setIsAdding(false);
      setNewRecord({ nama_siswa: '', kelas: '', isi_catatan: '' });
      alert('Catatan perkembangan berhasil disimpan!');
    } catch (err) {
      alert('Gagal menyimpan catatan. Silakan coba lagi.');
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
    const doc = new jsPDF();
    const dateOrigin = record.tgl_catatan?.toDate ? record.tgl_catatan.toDate() : new Date();
    const dateFormatted = format(dateOrigin, 'dd MMMM yyyy');
    const timeFormatted = format(dateOrigin, 'HH:mm');
    
    // Official Kop Surat matching the screenshot
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 21, { align: 'center' });
    
    // Joint Role line (Blue color like in image)
    doc.setTextColor(67, 56, 202); 
    doc.setFontSize(12);
    doc.text('WALI KELAS / GURU MAPEL', 105, 27, { align: 'center' });
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 33, { align: 'center' });
    doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 37, { align: 'center' });
    doc.text('Email: srma24kediri@gmail.com | Kode Pos: 64152', 105, 41, { align: 'center' });

    // Double lines below header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(20, 44, 190, 44);
    doc.setLineWidth(0.2);
    doc.line(20, 45.5, 190, 45.5);

    // Document Title matching screenshot
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SURAT CATATAN PERKEMBANGAN SISWA', 105, 58, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(55, 59.5, 155, 59.5);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nomor : SRMA-C-${record.id?.slice(-6).toUpperCase()}`, 105, 65, { align: 'center' });

    // Recipient Section (Automatic "ananda" with student name)
    doc.setFontSize(11);
    doc.text('Kepada Yth.', 20, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bapak/Ibu Wali Asuh ananda ${record.nama_siswa}`, 20, 85);
    doc.text('SRMA 24 Kediri', 20, 90);
    doc.setFont('helvetica', 'normal');
    doc.text('di Tempat', 20, 95);

    // Opening matching screenshot
    doc.text('Dengan hormat,', 20, 110);
    const openingText = 'Menerangkan bahwa berdasarkan hasil pengamatan dan evaluasi belajar di SRMA 24 Kediri, terdapat catatan penting bagi siswa tersebut di bawah ini:';
    const splitOpening = doc.splitTextToSize(openingText, 170);
    doc.text(splitOpening, 20, 116);

    // Student Data Table Style
    const tableTop = 130;
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Lengkap', 30, tableTop + 5);
    doc.text('Kelas / Jurusan', 30, tableTop + 13);
    doc.text('Isi Catatan', 30, tableTop + 21);

    doc.setFont('helvetica', 'normal');
    doc.text(`: ${record.nama_siswa.toUpperCase()}`, 70, tableTop + 5);
    doc.text(`: ${record.kelas}`, 70, tableTop + 13);
    
    // Split long text for the content
    const splitContent = doc.splitTextToSize(record.isi_catatan, 110);
    doc.text(':', 70, tableTop + 21);
    doc.text(splitContent, 73, tableTop + 21);

    // Draw horizontal lines for the table look
    doc.setDrawColor(220, 220, 220);
    doc.line(30, tableTop + 8, 190, tableTop + 8);
    doc.line(30, tableTop + 16, 190, tableTop + 16);
    const tableBottom = Math.max(tableTop + 24, tableTop + 18 + (splitContent.length * 5.5));
    doc.line(30, tableBottom, 190, tableBottom);

    // Closing Paragraphs
    const closingY = tableBottom + 12;
    doc.setFontSize(10);
    const closingText1 = 'Catatan ini diberikan sebagai bentuk perhatian dan koordinasi antara Wali Kelas dan Wali Asuh demi kebaikan proses belajar siswa yang bersangkutan. Mohon untuk dapat diperhatikan dan ditindaklanjuti sebagaimana mestinya.';
    const splitClosing1 = doc.splitTextToSize(closingText1, 170);
    doc.text(splitClosing1, 20, closingY);
    
    const closingText2 = 'Demikian surat keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya. Atas perhatian Bapak/Ibu, kami sampaikan terima kasih.';
    const splitClosing2 = doc.splitTextToSize(closingText2, 170);
    doc.text(splitClosing2, 20, closingY + 20);

    // Signature Area
    const sigY = closingY + 45;
    doc.text(`Kediri, ${dateFormatted}`, 135, sigY);
    const authorRoleLabel = record.author_role === 'wali_kelas' ? 'Wali Kelas,' : 'Guru Mapel,';
    doc.text(authorRoleLabel, 135, sigY + 6);
    
    try {
      const qrData = `SRMA 24 DIGITAL HUB\nRecord ID: ${record.id}\nStudent: ${record.nama_siswa}\nAuthor: ${record.author_name}\nDate: ${dateFormatted}`;
      const qrDataUrl = await QRCode.toDataURL(qrData);
      doc.addImage(qrDataUrl, 'PNG', 145, sigY + 10, 25, 25);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`${record.author_name}`, 135, sigY + 45);
    doc.setLineWidth(0.3);
    doc.line(135, sigY + 46.5, 185, sigY + 46.5); // Underline name like in image
    
    // Bottom Disclaimer
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const disclaimerLabel = 'Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem Digital Hub SRMA 24.';
    doc.text(disclaimerLabel, 105, 280, { align: 'center' });
    doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 284, { align: 'center' });

    doc.save(`Catatan_Perkembangan_${record.nama_siswa.replace(/ /g, '_')}.pdf`);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-white relative">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight">Detail Catatan</h2>
                    <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest">{selectedRecord.nama_siswa}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Siswa / Kelas</p>
                    <p className="text-sm font-black text-slate-700">{selectedRecord.nama_siswa} (Kelas {selectedRecord.kelas})</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Tanggal</p>
                    <p className="text-sm font-black text-slate-700">
                      {selectedRecord.tgl_catatan?.toDate ? format(selectedRecord.tgl_catatan.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 italic">Isi Catatan</p>
                  <p className="text-slate-600 font-medium leading-relaxed italic whitespace-pre-wrap">
                    "{selectedRecord.isi_catatan}"
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Dibuat Oleh</p>
                      <p className="text-xs font-black text-slate-700 uppercase tracking-tighter">{selectedRecord.author_name}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${selectedRecord.is_acknowledged ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {selectedRecord.is_acknowledged ? 'Diterima' : 'Menunggu'}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => downloadPDF(selectedRecord)}
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Unduh PDF
                </button>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-8 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
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
                  onClick={() => setIsAdding(false)}
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
                    onClick={() => setIsAdding(false)}
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="px-1">
          <h2 className="text-2xl font-black text-[#5d4037] font-display tracking-tight italic flex items-center gap-3">
             <ClipboardList className="w-8 h-8 text-indigo-500" />
             Catatan Perkembangan Siswa
          </h2>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1 italic">History & Perkembangan Siswa</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {user.role !== 'wali_asuh' && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full sm:w-auto px-6 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Tambah Catatan
            </button>
          )}

          <div className="relative group min-w-[280px] w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <ClipboardList className="w-16 h-16 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] italic">Belum ada catatan perkembangan</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-[2.5rem] border ${record.is_acknowledged ? 'border-emerald-100' : 'border-indigo-100'} p-8 shadow-sm hover:shadow-xl transition-all duration-500 relative overflow-hidden group cursor-pointer`}
              onClick={() => setSelectedRecord(record)}
            >
              {record.is_acknowledged && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-2 rounded-bl-3xl flex items-center gap-2 shadow-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Diterima</span>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-8">
                <div className="shrink-0">
                  <div className={`w-20 h-20 ${record.is_acknowledged ? 'bg-emerald-50' : 'bg-indigo-50'} rounded-[2rem] flex items-center justify-center relative group-hover:scale-110 transition-transform duration-500`}>
                    <User className={`w-10 h-10 ${record.is_acknowledged ? 'text-emerald-500' : 'text-indigo-500'}`} />
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight italic mb-1 uppercase tracking-tight">
                        {record.nama_siswa}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm shadow-indigo-100">
                          Kelas {record.kelas}
                        </span>
                        <div className="w-1 h-1 bg-slate-200 rounded-full" />
                        <div className="flex items-center gap-2 text-slate-400">
                           <Calendar className="w-3.5 h-3.5" />
                           <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                             {record.tgl_catatan?.toDate ? format(record.tgl_catatan.toDate(), 'dd MMM yyyy') : '-'}
                           </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPDF(record);
                        }}
                        className="p-3 bg-white text-indigo-600 border border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-all shadow-sm"
                        title="Unduh PDF"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <div className="flex flex-col md:items-end text-slate-400 gap-1 italic text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none italic">Oleh:</p>
                        <span className="text-xs font-black text-slate-600 italic">{record.author_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 relative group-hover:bg-white transition-colors duration-500">
                    <p className="text-slate-600 font-medium leading-relaxed line-clamp-2 italic">
                      "{record.isi_catatan}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">
                      <ChevronRight className="w-3 h-3" /> Klik untuk detail
                    </div>

                    {user.role === 'wali_asuh' && !record.is_acknowledged && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(record.id!);
                        }}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all"
                      >
                        <Check className="w-3 h-3" />
                        Terima
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

