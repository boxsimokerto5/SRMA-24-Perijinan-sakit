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
  limit,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, DormitoryIncident, Siswa } from '../types';
import { 
  AlertTriangle, 
  Plus, 
  Calendar, 
  Clock, 
  Trash2, 
  History, 
  FileText, 
  Printer, 
  ChevronRight, 
  User,
  Search,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { generateDormitoryIncidentsReportPDF } from '../pdfUtils';

interface DormitoryIncidentsViewProps {
  user: AppUser;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function DormitoryIncidentsView({ user }: DormitoryIncidentsViewProps) {
  const [incidents, setIncidents] = useState<DormitoryIncident[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<DateFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [improvementEfforts, setImprovementEfforts] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeStr, setTimeStr] = useState(format(new Date(), 'HH:mm'));
  const [asrama, setAsrama] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const path = 'dormitory_incidents';
    const q = query(
      collection(db, path),
      orderBy('date', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DormitoryIncident));
      setIncidents(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    const fetchStudents = async () => {
      try {
        const studentSnap = await getDocs(collection(db, 'siswa'));
        const studentList = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
        setStudents(studentList);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDescription.trim() || !subject.trim() || !asrama.trim()) return;

    setIsSubmitting(true);
    const path = 'dormitory_incidents';
    try {
      const combinedDate = new Date(`${dateStr}T${timeStr}`);
      
      await addDoc(collection(db, path), {
        date: Timestamp.fromDate(combinedDate),
        time: timeStr,
        subject: subject.trim(),
        incident_description: incidentDescription.trim(),
        improvement_efforts: improvementEfforts.trim(),
        author_name: user.name || user.email,
        author_uid: user.uid,
        author_role: user.role,
        asrama: asrama.trim(),
        createdAt: serverTimestamp()
      });

      setSubject('');
      setIncidentDescription('');
      setImprovementEfforts('');
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (incidentId: string) => {
    const path = `dormitory_incidents/${incidentId}`;
    try {
      await deleteDoc(doc(db, 'dormitory_incidents', incidentId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const generatePDF = async (period: 'week' | 'month') => {
    await generateDormitoryIncidentsReportPDF(incidents, period, user.name || user.email);
  };

  const filteredIncidents = incidents.filter(item => {
    const itemDate = item.date.toDate();
    const now = new Date();

    if (filter === 'today') {
      return isWithinInterval(itemDate, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (filter === 'yesterday') {
      const yesterday = subDays(now, 1);
      return isWithinInterval(itemDate, { start: startOfDay(yesterday), end: endOfDay(yesterday) });
    }
    if (filter === 'week') {
      return isWithinInterval(itemDate, { start: startOfWeek(now), end: endOfDay(now) });
    }
    if (filter === 'month') {
      return isWithinInterval(itemDate, { start: startOfMonth(now), end: endOfDay(now) });
    }
    return true;
  });

  const subjectSuggestions = students
    .filter(s => s.nama_lengkap.toLowerCase().includes(subject.toLowerCase()))
    .slice(0, 5);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-sans">
      {/* Header Dashboard - Ultra Slim Version */}
      <div className="bg-[#3e2723] rounded-2xl p-4 lg:p-5 text-white shadow-xl overflow-hidden border border-[#5d4037] relative group">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shrink-0 transition-transform group-hover:scale-105">
              <AlertTriangle className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black font-display tracking-tight leading-none italic uppercase">Catatan Kejadian</h1>
                <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/5 italic">
                  KEAMANAN
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
                  INPUT KEJADIAN
                </>
              )}
            </button>
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
            <div className="bg-[#fcfaf6] rounded-3xl p-6 lg:p-8 shadow-xl border border-[#d7ccc8]/40">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="relative">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Subjek / Nama Siswa</label>
                  <div className="relative">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Input nama siswa..."
                      className="w-full bg-white border border-stone-100 rounded-xl pl-14 pr-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic placeholder:text-stone-200 shadow-inner"
                    />
                  </div>
                  {/* Suggestions Popover */}
                  <AnimatePresence>
                    {showSuggestions && subject.length > 1 && subjectSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden"
                      >
                        {subjectSuggestions.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSubject(s.nama_lengkap);
                              setAsrama(s.asrama || '');
                              setShowSuggestions(false);
                            }}
                            className="w-full px-6 py-4 text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-sm font-black text-[#3e2723] italic uppercase tracking-tight">{s.nama_lengkap}</p>
                              <p className="text-[9px] font-bold text-stone-300 uppercase tracking-widest mt-0.5">{s.kelas} | {s.asrama}</p>
                            </div>
                            <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center group-hover:bg-[#3e2723] transition-colors">
                              <Plus className="w-4 h-4 text-stone-200 group-hover:text-white" />
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Asrama / Lokasi</label>
                  <input
                    type="text"
                    required
                    value={asrama}
                    onChange={(e) => setAsrama(e.target.value)}
                    placeholder="Input lokasi kejadian..."
                    className="w-full bg-white border border-stone-100 rounded-xl px-6 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic placeholder:text-stone-200 shadow-inner"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Kronologi Kejadian</label>
                  <textarea
                    required
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    placeholder="Tulis detail kronologi kejadian..."
                    className="w-full bg-white border border-stone-100 rounded-2xl px-6 py-4 focus:border-[#3e2723] min-h-[100px] outline-none transition-all font-bold text-stone-600 text-sm italic placeholder:text-stone-200 shadow-inner"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Upaya Perbaikan</label>
                  <textarea
                    required
                    value={improvementEfforts}
                    onChange={(e) => setImprovementEfforts(e.target.value)}
                    placeholder="Langkah perbaikan yang dilakukan..."
                    className="w-full bg-white border border-stone-100 rounded-2xl px-6 py-4 focus:border-[#3e2723] min-h-[100px] outline-none transition-all font-bold text-stone-600 text-sm italic placeholder:text-stone-200 shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Tanggal</label>
                    <div className="relative">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full bg-white border border-stone-100 rounded-xl pl-12 pr-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic shadow-inner"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-2 italic">Jam</label>
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
                      <input
                        type="time"
                        required
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full bg-white border border-stone-100 rounded-xl pl-12 pr-4 py-3 focus:border-[#3e2723] outline-none transition-all font-bold text-[#3e2723] text-sm italic shadow-inner"
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
                    {isSubmitting ? 'PROCESSING...' : 'TERBITKAN CATATAN KEJADIAN'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History List - Ultra Slim Version */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-sm transition-transform hover:scale-105">
              <History className="w-4 h-4 text-[#3e2723]" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Riwayat Kejadian</h2>
              <p className="text-[7px] font-bold text-stone-300 uppercase tracking-widest italic mt-1 opacity-60">Log Keamanan</p>
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
        ) : filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-stone-50 relative overflow-hidden">
            <FileText className="w-10 h-10 text-stone-100 mb-3 opacity-50" />
            <p className="text-[8px] font-black text-stone-200 uppercase tracking-widest italic">EMPTY LOGS</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredIncidents.map((incident, idx) => (
                <motion.div
                  key={incident.id}
                  layout
                  initial={{ opacity: 0, y: 15, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, y: -15 }}
                  transition={{ delay: idx * 0.02, type: 'spring', damping: 25 }}
                  className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm border transition-all group relative cursor-pointer overflow-hidden ${
                    expandedId === incident.id ? 'ring-4 ring-[#3e2723]/5 border-[#3e2723]/10 shadow-lg' : 'border-stone-50 hover:border-stone-100'
                  }`}
                  onClick={() => setExpandedId(expandedId === incident.id ? null : (incident.id || null))}
                >
                  <div className={`absolute top-0 right-0 w-1 h-full bg-[#3e2723] transition-all duration-700 ${expandedId === incident.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-10'}`} />
                  
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Ultra Compact Date/Time Block */}
                    <div className="w-14 md:w-16 shrink-0 flex flex-col gap-1.5">
                       <div className="bg-[#fcfaf6] rounded-lg p-2 border border-stone-50 text-center shadow-sm">
                        <div className="text-lg font-black leading-none mb-0.5 text-[#3e2723] italic tracking-tight">
                          {format(incident.date.toDate(), 'dd', { locale: id })}
                        </div>
                        <div className="text-[6px] font-black uppercase tracking-widest text-stone-300 italic">
                          {format(incident.date.toDate(), 'MMM yy', { locale: id }).toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-stone-50/50 rounded-lg p-1 border border-stone-100/50 text-center flex items-center justify-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-[#3e2723]/30" />
                        <div className="text-[8px] font-black text-[#3e2723] italic tracking-tighter">
                          {incident.time}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2 mb-1.5 mt-0.5 flex-wrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs md:text-sm font-black text-[#3e2723] italic tracking-tight uppercase font-display leading-tight">{incident.subject}</h3>
                          <span className="text-[6px] font-black text-[#854d0e] bg-[#fefce8] px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-yellow-200/50 italic">
                            {incident.asrama}
                          </span>
                        </div>
                        
                        {(user.uid === incident.author_uid || user.role === 'kepala_sekolah') && (
                          <div onClick={(e) => e.stopPropagation()} className="relative z-20">
                            {deletingId === incident.id ? (
                               <div className="flex items-center gap-2 bg-rose-50 p-1 rounded-lg border border-rose-100">
                                <button 
                                  onClick={() => incident.id && handleDelete(incident.id)}
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
                                onClick={() => setDeletingId(incident.id || null)}
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
                          <p className="text-[6px] font-black text-stone-300 uppercase tracking-[0.2em] mb-0.5 italic opacity-60">KRONOLOGI KEJADIAN:</p>
                          <p className={`text-[10px] md:text-xs font-bold text-[#3e2723] leading-relaxed italic ${expandedId === incident.id ? '' : 'line-clamp-1'}`}>
                            {incident.incident_description}
                          </p>
                        </div>

                        <AnimatePresence>
                          {expandedId === incident.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3 mt-3 border-t border-stone-50 bg-[#fcfaf6]/50 p-3 rounded-xl relative overflow-hidden group/card shadow-inner transition-all">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#3e2723] opacity-10 group-hover/card:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-2 mb-2 relative z-10">
                                  <div className="w-6 h-6 rounded-lg bg-[#3e2723] flex items-center justify-center shadow-md">
                                    <CheckCircle2 className="w-3 h-3 text-amber-200" />
                                  </div>
                                  <span className="text-[7px] font-black text-[#3e2723] uppercase tracking-widest italic">PERBAIKAN:</span>
                                </div>
                                <p className="text-[10px] md:text-xs font-bold text-[#5d4037] italic leading-relaxed ml-8 relative z-10">
                                  {incident.improvement_efforts}
                                </p>
                                
                                <div className="mt-3 flex items-center justify-between ml-8 pt-2 border-t border-[#d7ccc8]/40">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-[#3e2723] rounded-full flex items-center justify-center border border-white shadow-md">
                                      <User className="w-3 h-3 text-amber-200" />
                                    </div>
                                    <div>
                                      <span className="text-[7px] font-black text-[#3e2723] uppercase tracking-widest italic block leading-none">AUTHOR</span>
                                      <span className="text-[6px] font-bold text-stone-400 uppercase tracking-widest mt-0.5 block italic opacity-60">{incident.author_name}</span>
                                    </div>
                                  </div>
                                  <button 
                                     onClick={() => setExpandedId(null)}
                                     className="px-3 py-1.5 bg-[#3e2723] text-white text-[7px] font-black uppercase tracking-widest rounded-lg shadow-md italic flex items-center gap-1 transition-all hover:bg-black"
                                  >
                                    CLOSE <ChevronDown className="w-2 h-2 rotate-180" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {expandedId !== incident.id && (
                          <div className="flex items-center justify-between mt-3 ml-3 pt-2 border-t border-stone-50/50">
                             <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-all">
                                <div className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center border border-white shadow-sm">
                                  <User className="w-2.5 h-2.5 text-stone-400" />
                                </div>
                                <span className="text-[7px] font-black text-[#3e2723] uppercase italic">{incident.author_name}</span>
                             </div>
                             <div className="flex items-center gap-1 px-2 py-1 bg-stone-50 rounded-lg group-hover:bg-[#3e2723] transition-all group-hover:shadow-md">
                               <span className="text-[7px] font-black text-stone-400 group-hover:text-amber-200 uppercase tracking-widest italic transition-colors">
                                  DETAIL KEJADIAN
                               </span>
                               <ChevronRight className="w-2.5 h-2.5 text-stone-200 group-hover:text-amber-200 transition-colors" />
                             </div>
                          </div>
                        )}
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
