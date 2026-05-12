import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  Timestamp, 
  deleteDoc, 
  doc,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, EvaluationNote } from '../types';
import { 
  ClipboardCheck, 
  Plus, 
  Calendar, 
  Clock, 
  Trash2, 
  Search, 
  Filter,
  ChevronDown,
  History,
  FileText,
  Printer,
  ChevronRight,
  User
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

interface EvaluationNotesViewProps {
  user: AppUser;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function EvaluationNotesView({ user }: EvaluationNotesViewProps) {
  const [notes, setNotes] = useState<EvaluationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<DateFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeStr, setTimeStr] = useState(format(new Date(), 'HH:mm'));
  const [asrama, setAsrama] = useState('');

  useEffect(() => {
    const path = 'evaluation_notes';
    const q = query(
      collection(db, path),
      orderBy('date', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EvaluationNote));
      setNotes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !asrama.trim()) return;

    setIsSubmitting(true);
    const path = 'evaluation_notes';
    try {
      const combinedDate = new Date(`${dateStr}T${timeStr}`);
      
      await addDoc(collection(db, path), {
        description: description.trim(),
        date: Timestamp.fromDate(combinedDate),
        author_name: user.name || user.email,
        author_uid: user.uid,
        asrama: asrama.trim(),
        createdAt: serverTimestamp()
      });

      setDescription('');
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    const path = `evaluation_notes/${noteId}`;
    try {
      await deleteDoc(doc(db, 'evaluation_notes', noteId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const generatePDF = async (period: 'week' | 'month') => {
    const doc = new jsPDF();
    const now = new Date();
    const start = period === 'week' ? startOfWeek(now) : startOfMonth(now);
    const end = endOfDay(now);

    const dataToPrint = notes.filter(note => 
      isWithinInterval(note.date.toDate(), { start, end })
    ).sort((a, b) => a.date.toMillis() - b.date.toMillis());

    if (dataToPrint.length === 0) {
      alert('Tidak ada data untuk periode ini.');
      return;
    }

    // Generate QR Code for Signature
    const signatureName = user.name || user.email;
    const qrDataUrl = await QRCode.toDataURL(signatureName);

    // Header / KOP
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('ASRAMA SRMA 24 KEDIRI', 105, 15, { align: 'center' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN EVALUASI WALI ASRAMA', 105, 25, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Periode: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, 105, 33, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(20, 36, 190, 36);

    // Table
    const tableData = dataToPrint.map(note => [
      format(note.date.toDate(), 'dd/MM/yy', { locale: id }),
      format(note.date.toDate(), 'HH:mm'),
      note.asrama,
      note.description,
      'Semua Anak' // Default remark as requested
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Tanggal', 'Jam', 'Asrama/Regu', 'Catatan Evaluasi', 'Keterangan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 15 },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25 }
      }
    });

    // Signature
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, finalY);
    
    const signatureX = 150;
    doc.text('Mengetahui,', signatureX, finalY, { align: 'center' });
    doc.text('Wali Asrama', signatureX, finalY + 5, { align: 'center' });
    
    // Add QR Code Signature
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, finalY + 8, 25, 25);
    
    doc.setFontSize(10);
    doc.text(signatureName, signatureX, finalY + 40, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Digital Signature (Verified)', signatureX, finalY + 44, { align: 'center' });

    doc.save(`Laporan_Evaluasi_${period}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const filteredNotes = notes.filter(note => {
    const noteDate = note.date.toDate();
    const now = new Date();

    if (filter === 'today') {
      return isWithinInterval(noteDate, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (filter === 'yesterday') {
      const yesterday = subDays(now, 1);
      return isWithinInterval(noteDate, { start: startOfDay(yesterday), end: endOfDay(yesterday) });
    }
    if (filter === 'week') {
      return isWithinInterval(noteDate, { start: startOfWeek(now), end: endOfDay(now) });
    }
    if (filter === 'month') {
      return isWithinInterval(noteDate, { start: startOfMonth(now), end: endOfDay(now) });
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Sleek Compact Header */}
      <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none">Catatan Evaluasi</h1>
                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                  Resmi
                </span>
              </div>
              <p className="text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest">
                Harian & Periodik Wali Asrama
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Print Dropdown Replacement (Buttons for Week/Month) */}
            <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 mr-2">
              <button 
                onClick={() => generatePDF('week')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                title="Cetak Minggu Ini"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Minggu</span>
                </div>
              </button>
              <div className="w-[1px] bg-slate-700 mx-1 self-stretch" />
              <button 
                onClick={() => generatePDF('month')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                title="Cetak Bulan Ini"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Bulan</span>
                </div>
              </button>
            </div>

            {user.role === 'wali_asrama' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className={`group px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                  showForm 
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20'
                }`}
              >
                {showForm ? 'Batal' : (
                  <>
                    <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                    Input
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Input Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-xl border border-blue-50">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Deskripsi Evaluasi</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Apa saja evaluasi yang dilakukan hari ini? Tulis detailnya di sini..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-700 min-h-[120px] placeholder:text-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Asrama / Regu</label>
                  <input
                    type="text"
                    required
                    value={asrama}
                    onChange={(e) => setAsrama(e.target.value)}
                    placeholder="Contoh: Asrama A / Regu Garuda"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-700 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tanggal</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        required
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-700 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Jam</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="time"
                        required
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-700 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 text-xs"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Evaluasi'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & History Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-700 tracking-tight">Riwayat Catatan</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peninjauan Evaluasi Berkala</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar">
          {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filter === f 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'today' ? 'Hari Ini' : f === 'yesterday' ? 'Kemarin' : f === 'week' ? 'Minggu Ini' : 'Bulan Ini'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat Catatan...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-dashed border-slate-200 opacity-50">
            <FileText className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tidak ada catatan ditemukan</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className={`bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden cursor-pointer ${
                  expandedId === note.id ? 'ring-2 ring-blue-100 border-blue-200' : ''
                }`}
                onClick={() => setExpandedId(expandedId === note.id ? null : (note.id || null))}
              >
                <div className="flex gap-4">
                  {/* Left Column - Meta Info Slim */}
                  <div className="w-24 shrink-0 flex flex-col gap-2">
                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                      <div className="text-[14px] font-black text-slate-700 leading-none">
                        {format(note.date.toDate(), 'dd', { locale: id })}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                        {format(note.date.toDate(), 'MMM yy', { locale: id })}
                      </div>
                    </div>
                    <div className="bg-blue-50/50 rounded-xl p-2 border border-blue-100/50 text-center">
                      <Clock className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
                      <div className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                        {format(note.date.toDate(), 'HH:mm')}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Content Slim */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest border border-blue-100 text-[8px] sm:text-[9px]">
                          {note.asrama}
                        </span>
                        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          <User className="w-2.5 h-2.5" />
                          <span>{note.author_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {expandedId !== note.id && note.description.length > 100 && (
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                            Selengkapnya <ChevronRight className="w-2.5 h-2.5" />
                          </span>
                        )}

                        {(user.uid === note.author_uid || user.role === 'kepala_sekolah') && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {deletingId === note.id ? (
                              <div className="flex items-center gap-1 animate-in slide-in-from-right-1">
                                <button 
                                  onClick={() => note.id && handleDelete(note.id)}
                                  className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100"
                                >
                                  HAPUS
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="text-[8px] font-black text-slate-300 hover:text-slate-500"
                                >
                                  BATAL
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(note.id || null)}
                                className="p-1 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className={`text-slate-700 font-semibold leading-relaxed text-xs whitespace-pre-wrap break-words transition-all duration-300 ${
                      expandedId === note.id ? '' : 'line-clamp-2'
                    }`}>
                      {note.description}
                    </p>

                    {expandedId === note.id && (
                       <motion.div 
                         initial={{ opacity: 0, height: 0 }}
                         animate={{ opacity: 1, height: 'auto' }}
                         className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between"
                       >
                         <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">
                           Detail Evaluasi Periodik
                         </span>
                         <button 
                           onClick={() => setExpandedId(null)}
                           className="text-[8px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1"
                         >
                            Tutup <ChevronDown className="w-2.5 h-2.5 rotate-180" />
                         </button>
                       </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
