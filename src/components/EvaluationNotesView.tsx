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
import { generateEvaluationNotesReportPDF } from '../pdfUtils';

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
    await generateEvaluationNotesReportPDF(notes, period, user.name || user.email);
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-sans">
      {/* Header Dashboard - Ultra Slim Version */}
      <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative group">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 transition-transform group-hover:scale-105">
              <ClipboardCheck className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black font-display tracking-tight leading-none italic uppercase">Evaluasi Asrama</h1>
                <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/5 italic">
                  RESMI
                </span>
              </div>
              <p className="text-stone-400 text-[8px] font-bold mt-1 uppercase tracking-widest italic opacity-60">
                Log Monitoring Asrama
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-[#5d4037] p-0.5 rounded-xl border border-[#3e2723]">
              <button 
                onClick={() => generatePDF('week')}
                className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
              >
                <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200" />
                <span className="text-[8px] font-black uppercase tracking-widest italic tracking-tighter">Minggu</span>
              </button>
              <div className="w-[1px] bg-[#3e2723] mx-0.5 self-stretch" />
              <button 
                onClick={() => generatePDF('month')}
                className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-lg transition-all flex items-center gap-1.5 group/btn"
              >
                <Printer className="w-3.5 h-3.5 text-amber-200/50 group-hover/btn:text-amber-200" />
                <span className="text-[8px] font-black uppercase tracking-widest italic tracking-tighter">Bulan</span>
              </button>
            </div>

            {user.role === 'wali_asrama' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className={`group px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg italic border-b-2 ${
                  showForm 
                  ? 'bg-[#5d4037] text-stone-300 border-[#2d1e1a]' 
                  : 'bg-[#fcfaf6] text-[#3e2723] border-[#d7ccc8] hover:bg-white'
                }`}
              >
                {showForm ? 'BATAL' : (
                  <>
                    <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                    Input Evaluasi
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Input Form - Slimmed Version */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="bg-[#fcfaf6] rounded-3xl p-6 lg:p-8 shadow-xl border border-[#d7ccc8]/30">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic text-left">Deskripsi Evaluasi</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tulis detail evaluasi hari ini..."
                    className="w-full bg-white border border-stone-100 rounded-2xl px-6 py-4 focus:border-[#3e2723] min-h-[100px] outline-none transition-all font-bold text-stone-700 text-sm italic placeholder:text-stone-200 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic text-left">Nama Asrama / Kelompok</label>
                  <input
                    type="text"
                    required
                    value={asrama}
                    onChange={(e) => setAsrama(e.target.value)}
                    placeholder="Contoh: Asrama A / Regu Garuda"
                    className="w-full bg-white border border-stone-100 rounded-xl px-6 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic placeholder:text-stone-200 shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic text-left">Tanggal</label>
                    <div className="relative">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full bg-white border border-stone-100 rounded-xl pl-14 pr-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic text-left">Jam</label>
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
                      <input
                        type="time"
                        required
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full bg-white border border-stone-100 rounded-xl pl-14 pr-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#3e2723] text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-[10px] italic border-b-4 border-stone-900 mt-2"
                  >
                    {isSubmitting ? 'Processing...' : 'Sahkan Catatan Evaluasi'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & History Header - Ultra Slim Version */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-sm transition-transform hover:scale-105">
              <History className="w-4 h-4 text-[#3e2723]" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Riwayat Evaluasi</h2>
              <p className="text-[7px] font-bold text-stone-300 uppercase tracking-widest italic mt-1 opacity-60">Log Monitoring</p>
            </div>
          </div>

          <div className="flex bg-[#fcfaf6] p-1 rounded-xl border border-stone-200 shadow-inner gap-1.5 overflow-x-auto no-scrollbar">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap italic ${
                  filter === f 
                  ? 'bg-[#3e2723] text-white shadow-md' 
                  : 'text-stone-400 hover:text-[#3e2723] hover:bg-white transition-all'
                }`}
              >
                {f === 'all' ? 'SEMUA' : f === 'today' ? 'HARI' : f === 'yesterday' ? 'KEMARIN' : f === 'week' ? 'MINGGU' : 'BULAN'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-stone-50 shadow-sm relative overflow-hidden">
            <div className="w-8 h-8 border-3 border-stone-100 border-t-[#3e2723] rounded-full animate-spin mb-3" />
            <p className="text-[8px] font-black text-stone-300 uppercase tracking-widest italic">Synchronizing...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-stone-50 relative overflow-hidden">
            <FileText className="w-10 h-10 text-stone-100 mb-3 opacity-50" />
            <p className="text-[8px] font-black text-stone-200 uppercase tracking-widest italic">EMPTY LOGS</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredNotes.map((note, idx) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, y: -15 }}
                  transition={{ delay: idx * 0.02, type: 'spring', damping: 25 }}
                  className={`bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md flex flex-col sm:flex-row overflow-hidden relative text-left ${
                    expandedId === note.id ? 'ring-2 ring-[#3e2723]/25 border-[#3e2723]/40' : 'border-stone-100 hover:border-stone-200'
                  }`}
                  onClick={() => setExpandedId(expandedId === note.id ? null : (note.id || null))}
                >
                  <div className={`absolute top-0 right-0 w-1 h-full bg-[#3e2723] transition-all duration-700 ${expandedId === note.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-10'}`} />
                  
                  {/* Left zone: 8:16 horizontal feeling aspect ratio ribbon font-display & brown theme */}
                  <div className="w-full sm:w-36 shrink-0 bg-[#3e2723] text-[#d7ccc8] p-4 flex flex-col justify-center items-center relative select-none">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
                    
                    <div className="relative z-10 text-center space-y-1">
                      <span className="text-[7px] font-black text-amber-200 tracking-widest uppercase block">
                        {format(note.date.toDate(), 'EEEE', { locale: id })}
                      </span>
                      <span className="text-2xl font-black font-display text-white tracking-tight leading-none block">
                        {format(note.date.toDate(), 'dd', { locale: id })}
                      </span>
                      <span className="text-[8px] font-black text-amber-100/70 tracking-widest uppercase block">
                        {format(note.date.toDate(), 'MMM yyyy', { locale: id }).toUpperCase()}
                      </span>
                      <div className="mt-2 inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-[7px] font-mono text-amber-100">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{format(note.date.toDate(), 'HH:mm')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-4 flex flex-col justify-between space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5 mt-0.5 flex-wrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs md:text-sm font-black text-[#3e2723] italic tracking-tight uppercase font-display leading-tight">Evaluasi Asrama</h3>
                          <span className="text-[6px] font-black text-[#854d0e] bg-[#fefce8] px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-yellow-200/50 italic">
                            {note.asrama}
                          </span>
                        </div>
                        
                        {(user.uid === note.author_uid || user.role === 'kepala_sekolah') && (
                          <div onClick={(e) => e.stopPropagation()} className="relative z-20">
                            {deletingId === note.id ? (
                               <div className="flex items-center gap-2 bg-rose-50 p-1 rounded-lg border border-rose-100">
                                <button 
                                  onClick={() => note.id && handleDelete(note.id)}
                                  className="text-[6px] font-black text-white px-2 py-1 bg-rose-600 rounded hover:bg-rose-700 transition-all italic shadow-sm"
                                >
                                  PURGE
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="text-[6px] font-black text-stone-400 px-1.5 py-1 hover:text-stone-600 italic"
                                >
                                  BACK
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(note.id || null)}
                                className="w-7 h-7 flex items-center justify-center text-stone-200 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="relative pl-3 border-l-2 border-stone-100 group-hover:border-amber-200 transition-colors">
                          <p className="text-[6px] font-black text-stone-300 uppercase tracking-[0.2em] mb-0.5 italic opacity-60">CATATAN EVALUASI:</p>
                          <p className={`text-[10px] md:text-xs font-bold text-[#3e2723] leading-relaxed italic ${expandedId === note.id ? '' : 'line-clamp-1'}`}>
                            {note.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 ml-3 pt-2 border-t border-stone-50/50">
                           <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-all">
                              <div className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center border border-white shadow-sm">
                                <User className="w-2.5 h-2.5 text-stone-400" />
                              </div>
                              <span className="text-[7px] font-black text-[#3e2723] uppercase italic">{note.author_name}</span>
                           </div>
                           <div className="flex items-center gap-1 px-2 py-1 bg-stone-50 rounded-lg group-hover:bg-[#3e2723] transition-all group-hover:shadow-md">
                             <span className="text-[7px] font-black text-stone-400 group-hover:text-amber-200 uppercase tracking-widest italic">
                                {expandedId === note.id ? 'CLOSE' : 'DETAIL EVALUASI'}
                             </span>
                             <ChevronRight className={`w-2.5 h-2.5 text-stone-200 group-hover:text-amber-200 transition-transform ${expandedId === note.id ? 'rotate-90' : ''}`} />
                           </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
