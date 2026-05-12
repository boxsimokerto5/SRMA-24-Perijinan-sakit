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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

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
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more space
    const now = new Date();
    const start = period === 'week' ? startOfWeek(now) : startOfMonth(now);
    const end = endOfDay(now);

    const dataToPrint = incidents.filter(item => 
      isWithinInterval(item.date.toDate(), { start, end })
    ).sort((a, b) => a.date.toMillis() - b.date.toMillis());

    if (dataToPrint.length === 0) {
      alert('Tidak ada data untuk periode ini.');
      return;
    }

    const signatureName = user.name || user.email;
    const qrDataUrl = await QRCode.toDataURL(signatureName);

    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // Header Brown Theme KOP
    doc.setFontSize(14);
    doc.setTextColor(62, 39, 35); // #3e2723
    doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN KEJADIAN ASRAMA', centerX, 25, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(141, 110, 99);
    doc.text(`Periode: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, centerX, 33, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.setDrawColor(121, 85, 72);
    doc.line(20, 36, pageWidth - 20, 36);

    const tableData = dataToPrint.map(item => [
      format(item.date.toDate(), 'dd/MM/yy', { locale: id }),
      item.time,
      item.subject,
      item.asrama,
      item.incident_description,
      item.improvement_efforts
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Tgl', 'Jam', 'Subjek', 'Lks/Asr', 'Kejadian', 'Upaya Perbaikan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [62, 39, 35], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 15 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 60 }
      },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check for page overflow
    if (finalY + 50 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, 20);
    } else {
      doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, finalY);
    }
    
    const signatureX = pageWidth - 60;
    const sigY = finalY > doc.internal.pageSize.getHeight() - 60 ? 20 : finalY;

    doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
    doc.text(user.role.replace('_', ' ').toUpperCase(), signatureX, sigY + 5, { align: 'center' });
    
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
    doc.setFontSize(10);
    doc.text(signatureName, signatureX, sigY + 40, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

    doc.save(`Laporan_Kejadian_Asrama_${period}_${format(new Date(), 'yyyyMMdd')}.pdf`);
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Brown Theme Header */}
      <div className="bg-[#3e2723] rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-[#5d4037]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic">Catatan Kejadian</h1>
                <span className="bg-[#d7ccc8]/20 text-[#d7ccc8] px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-[#d7ccc8]/20">
                  Keamanan
                </span>
              </div>
              <p className="text-stone-400 text-[10px] font-semibold mt-1 uppercase tracking-widest italic">
                Log Monitoring Asrama
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-[#5d4037] p-1 rounded-2xl border border-[#3e2723] mr-2">
              <button 
                onClick={() => generatePDF('week')}
                className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
                title="Cetak Minggu Ini"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter italic">Minggu</span>
                </div>
              </button>
              <div className="w-[1px] bg-[#3e2723] mx-1 self-stretch" />
              <button 
                onClick={() => generatePDF('month')}
                className="p-2 text-stone-300 hover:text-white hover:bg-[#3e2723] rounded-xl transition-all"
                title="Cetak Bulan Ini"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter italic">Bulan</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowForm(!showForm)}
              className={`group px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                showForm 
                ? 'bg-[#5d4037] text-stone-300 hover:bg-[#3e2723]' 
                : 'bg-[#3e2723] text-white hover:bg-black shadow-black/20 border border-[#d7ccc8]/20'
              }`}
            >
              {showForm ? 'Batal' : (
                <>
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                  Input Kejadian
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
            <div className="bg-[#f8f3ed] rounded-[2rem] p-6 lg:p-8 shadow-xl border border-[#d7ccc8]/50">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Subjek / Nama Siswa</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3e2723]/40" />
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Nama Siswa atau Subjek lainnya..."
                      className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl pl-12 pr-4 py-3.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-sm"
                    />
                  </div>
                  {/* Suggestions Popover */}
                  <AnimatePresence>
                    {showSuggestions && subject.length > 1 && subjectSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#d7ccc8]/30 overflow-hidden"
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
                            className="w-full px-4 py-3 text-left hover:bg-[#f8f3ed] transition-colors border-b border-[#d7ccc8]/10 last:border-0 flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-sm font-black text-[#3e2723] italic">{s.nama_lengkap}</p>
                              <p className="text-[10px] font-bold text-[#3e2723]/40 uppercase tracking-widest">{s.kelas} | {s.asrama}</p>
                            </div>
                            <Plus className="w-4 h-4 text-[#3e2723]/20 group-hover:text-[#3e2723] transition-colors" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Asrama / Lokasi</label>
                  <input
                    type="text"
                    required
                    value={asrama}
                    onChange={(e) => setAsrama(e.target.value)}
                    placeholder="Contoh: Asrama Putra A"
                    className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl px-5 py-3.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Catatan Kejadian</label>
                  <textarea
                    required
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    placeholder="Deskripsikan kejadian secara detail..."
                    className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl px-5 py-4 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] min-h-[100px] placeholder:text-stone-300 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Upaya Perbaikan</label>
                  <textarea
                    required
                    value={improvementEfforts}
                    onChange={(e) => setImprovementEfforts(e.target.value)}
                    placeholder="Langkah apa yang dilakukan untuk perbaikan ke depan?"
                    className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl px-5 py-4 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] min-h-[100px] placeholder:text-stone-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Tanggal</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3e2723]/40" />
                      <input
                        type="date"
                        required
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl pl-12 pr-4 py-3.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#3e2723]/60 uppercase tracking-widest mb-2 ml-1 italic">Jam</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3e2723]/40" />
                      <input
                        type="time"
                        required
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full bg-white border-2 border-[#d7ccc8]/30 rounded-2xl pl-12 pr-4 py-3.5 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 outline-none transition-all font-bold text-[#3e2723] text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#3e2723] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-xs italic"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Kejadian'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History List */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f8f3ed] rounded-xl flex items-center justify-center border border-[#d7ccc8]">
              <History className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#3e2723] tracking-tight italic">Riwayat Kejadian</h2>
              <p className="text-[10px] font-bold text-[#3e2723]/60 uppercase tracking-widest italic">Review Keamanan & Ketertiban</p>
            </div>
          </div>

          <div className="flex bg-[#f8f3ed] p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar border border-[#d7ccc8]">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap italic ${
                  filter === f 
                  ? 'bg-[#3e2723] text-white shadow-md' 
                  : 'text-[#3e2723]/40 hover:text-[#3e2723]'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'today' ? 'Hari Ini' : f === 'yesterday' ? 'Kemarin' : f === 'week' ? 'Minggu Ini' : 'Bulan Ini'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-[#d7ccc8]/20 shadow-sm">
            <div className="w-10 h-10 border-4 border-[#3e2723] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black text-[#3e2723]/40 uppercase tracking-widest">Memuat Data...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-dashed border-[#d7ccc8] opacity-50">
            <FileText className="w-12 h-12 text-[#d7ccc8] mb-4" />
            <p className="text-sm font-bold text-[#d7ccc8] uppercase tracking-widest">Belum ada catatan kejadian</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredIncidents.map((incident) => (
                <motion.div
                  key={incident.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={`bg-white rounded-3xl p-5 shadow-sm border border-[#d7ccc8]/20 hover:shadow-md transition-all group relative cursor-pointer ${
                    expandedId === incident.id ? 'ring-2 ring-[#3e2723]/10 border-[#3e2723]/20 shadow-lg shadow-[#3e2723]/5' : ''
                  }`}
                  onClick={() => setExpandedId(expandedId === incident.id ? null : (incident.id || null))}
                >
                  <div className="flex gap-4">
                    {/* Date/Time Block */}
                    <div className="w-20 shrink-0 flex flex-col gap-2">
                       <div className="bg-[#f8f3ed] rounded-2xl p-2 border border-[#d7ccc8]/30 text-center">
                        <div className="text-[16px] font-black text-[#3e2723] leading-none mb-0.5">
                          {format(incident.date.toDate(), 'dd', { locale: id })}
                        </div>
                        <div className="text-[8px] font-black text-[#3e2723]/40 uppercase tracking-tighter italic">
                          {format(incident.date.toDate(), 'MMM yy', { locale: id })}
                        </div>
                      </div>
                      <div className="bg-[#3e2723]/5 rounded-2xl p-2 border border-[#3e2723]/10 text-center">
                        <Clock className="w-3 h-3 text-[#3e2723]/40 mx-auto mb-0.5" />
                        <div className="text-[9px] font-black text-[#3e2723] uppercase tracking-tighter">
                          {incident.time}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-[#3e2723] italic tracking-tight">{incident.subject}</h3>
                          <span className="text-[9px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-200/50">
                            {incident.asrama}
                          </span>
                        </div>
                        
                        {(user.uid === incident.author_uid || user.role === 'kepala_sekolah') && (
                          <div onClick={(e) => e.stopPropagation()}>
                            {deletingId === incident.id ? (
                               <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => incident.id && handleDelete(incident.id)}
                                  className="text-[8px] font-black text-red-600 px-2 py-1 bg-red-50 rounded-lg hover:bg-red-100"
                                >
                                  HAPUS
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="text-[8px] font-black text-stone-400 px-2 py-1"
                                >
                                  BATAL
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(incident.id || null)}
                                className="p-1.5 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black text-[#3e2723]/40 uppercase tracking-widest mb-1 italic">Kronologi Kejadian:</p>
                          <p className={`text-sm font-semibold text-[#3e2723] leading-relaxed italic ${expandedId === incident.id ? '' : 'line-clamp-2'}`}>
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
                              <div className="pt-4 mt-4 border-t border-[#d7ccc8]/20 bg-[#f8f3ed]/50 p-4 rounded-2xl">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  <p className="text-[9px] font-black text-[#3e2723]/40 uppercase tracking-widest italic">Langkah Perbaikan:</p>
                                </div>
                                <p className="text-sm font-semibold text-[#3e2723] leading-relaxed italic">
                                  {incident.improvement_efforts}
                                </p>
                              </div>

                              <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-stone-400" />
                                  </div>
                                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Oleh: {incident.author_name}</span>
                                </div>
                                <button 
                                   onClick={() => setExpandedId(null)}
                                   className="text-[9px] font-black text-[#3e2723] uppercase tracking-widest flex items-center gap-1"
                                >
                                  Tutup <ChevronDown className="w-3 h-3 rotate-180" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {expandedId !== incident.id && (
                          <div className="flex items-center justify-between mt-2">
                             <div className="flex items-center gap-2 opacity-60">
                                <User className="w-3 h-3 text-stone-400" />
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">{incident.author_name}</span>
                             </div>
                             <span className="text-[8px] font-black text-[#3e2723] flex items-center gap-1 opacity-40">
                               DETAIL KEJADIAN <ChevronRight className="w-3 h-3" />
                             </span>
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
