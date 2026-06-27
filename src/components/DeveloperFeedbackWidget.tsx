import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  MessageSquare, 
  ShieldAlert, 
  Settings, 
  Inbox, 
  Filter, 
  Trash2, 
  Check, 
  AlertTriangle, 
  HelpCircle,
  FileText,
  User,
  Activity
} from 'lucide-react';
import { AppUser } from '../types';

interface DeveloperFeedbackWidgetProps {
  user: AppUser;
}

interface FeedbackItem {
  id: string;
  subject: string;
  message: string;
  type: 'kendala' | 'saran_pesan';
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'processed' | 'resolved';
  reportedByEmail: string;
  reportedByName: string;
  reportedByUid: string;
  reportedByRole: string;
  developerNotes?: string;
  createdAt: any;
  updatedAt: any;
}

export default function DeveloperFeedbackWidget({ user }: DeveloperFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  
  // Form States
  const [type, setType] = useState<'kendala' | 'saran_pesan'>('kendala');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Admin states
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const isSuperuser = user && (
    user.email.toLowerCase() === 'proseshidup1101@gmail.com' ||
    user.email.toLowerCase() === 'boxsimokerto5@gmail.com'
  );

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setSuccess(false);
      setErrorMsg(null);
    };

    window.addEventListener('open-developer-feedback', handleOpen);
    return () => window.removeEventListener('open-developer-feedback', handleOpen);
  }, []);

  // Fetch feedback list if superuser is viewing the panel
  useEffect(() => {
    if (!isSuperuser || !isAdminPanelOpen) return;

    setLoadingFeedbacks(true);
    const q = query(collection(db, 'developer_feedback'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        } as FeedbackItem;
      });
      setFeedbacks(items);
      setLoadingFeedbacks(false);
    }, (err) => {
      console.error("Error loaded developer reports:", err);
      setLoadingFeedbacks(false);
    });

    return () => unsubscribe();
  }, [isSuperuser, isAdminPanelOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorMsg("Mohon isi judul dan deskripsi pesan Anda.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await addDoc(collection(db, 'developer_feedback'), {
        subject: subject.trim(),
        message: message.trim(),
        type,
        urgency,
        status: 'pending',
        reportedByEmail: user.email,
        reportedByName: user.name,
        reportedByUid: user.uid,
        reportedByRole: user.role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      setSubject('');
      setMessage('');
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error("Error submitting developer feedback:", err);
      setErrorMsg("Gagal mengirim laporan. Pastikan koneksi internet stabil.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'pending' | 'processed' | 'resolved') => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'developer_feedback', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error status update:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (id: string) => {
    const notesText = editingNotes[id] || '';
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'developer_feedback', id), {
        developerNotes: notesText,
        updatedAt: serverTimestamp()
      });
      alert('Catatan developer berhasil disimpan!');
    } catch (err) {
      console.error("Error notes saved:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus laporan ini?")) return;
    try {
      await deleteDoc(doc(db, 'developer_feedback', id));
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const filteredItems = feedbacks.filter(item => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesUrgency = filterUrgency === 'all' || item.urgency === filterUrgency;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesType && matchesUrgency && matchesStatus;
  });

  return (
    <>
      {/* Floating Superuser Developer Panel Entry */}
      {isSuperuser && (
        <div className="fixed bottom-24 right-4 z-[90]">
          <button
            onClick={() => setIsAdminPanelOpen(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-red-600 to-amber-600 border border-amber-500/10 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 italic animate-pulse"
          >
            <ShieldAlert className="w-4 h-4 text-white animate-spin" />
            <span>developer inbox (superuser)</span>
          </button>
        </div>
      )}

      {/* MODAL USER UNTUK LAPOR DAN SARAN */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-stone-950/70 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-stone-900 border border-stone-800 text-stone-100 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10 font-sans"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-b from-[#3e2723]/30 to-stone-900/50 border-b border-stone-800 flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider italic font-display">Lapor & Saran Developer</h3>
                    <p className="text-[9px] text-[#ebdccb]/60 uppercase tracking-widest leading-none mt-1 font-sans">Kirim masukan langsung ke developer</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-stone-800 rounded-xl text-stone-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form / Success Content */}
              <div className="p-6">
                {success ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-12 text-center"
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h4 className="text-base font-black text-white italic">TERIMA KASIH!</h4>
                    <p className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mt-2 px-6">
                      Pesan Anda berhasil terkirim dan akan segera ditinjau langsung oleh Developer.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold rounded-xl flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Type Selector (Tipe Masukan) */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-stone-400 tracking-wider block mb-1.5">TIPE MASUKAN / PESAN</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setType('kendala')}
                          className={`py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 border-b-2 ${
                            type === 'kendala'
                              ? 'bg-rose-500/15 border-rose-600 text-rose-200'
                              : 'bg-stone-800/40 hover:bg-stone-800 border-transparent text-stone-400'
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Lapor Kendala</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setType('saran_pesan')}
                          className={`py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 border-b-2 ${
                            type === 'saran_pesan'
                              ? 'bg-amber-500/15 border-amber-600 text-amber-200'
                              : 'bg-stone-800/40 hover:bg-stone-800 border-transparent text-stone-400'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4 shrink-0" />
                          <span>Saran & Pesan</span>
                        </button>
                      </div>
                    </div>

                    {/* Urgency Selector */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-stone-400 tracking-wider block mb-1.5">TINGKAT URGENSI</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['low', 'medium', 'high'] as const).map((level) => {
                          const labels = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' };
                          const colors = {
                            low: urgency === 'low' ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-stone-800/20 text-stone-400',
                            medium: urgency === 'medium' ? 'bg-amber-500/15 border-amber-500 text-amber-300' : 'bg-stone-800/20 text-stone-400',
                            high: urgency === 'high' ? 'bg-rose-500/15 border-rose-500 text-rose-300' : 'bg-stone-800/20 text-stone-400'
                          };
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setUrgency(level)}
                              className={`py-2 px-3 rounded-lg text-[9px] font-bold uppercase transition-all text-center border ${colors[level]}`}
                            >
                              {labels[level]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-stone-400 tracking-wider block mb-1.5">SUBJEK / JUDUL MASALAH</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Contoh: Tombol print di dokter view tidak merespon"
                        className="w-full px-4 py-3 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-stone-400 tracking-wider block mb-1.5">DESKRIPSI LENGKAP KENDALA ATAU SARAN</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tuliskan secara lengkap kendala teknis yang Anda hadapi atau ide saran yang ingin diajukan ke developer..."
                        rows={5}
                        className="w-full px-4 py-3 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed"
                      />
                    </div>

                    {/* User Context Metadata Note */}
                    <div className="p-3 bg-stone-950 border border-stone-800/50 rounded-xl flex items-center justify-between text-[8px] font-black text-stone-500 tracking-wider uppercase font-mono">
                      <span>PENGIRIM: {user.name} ({user.role})</span>
                      <span>EMAIL: {user.email}</span>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border border-amber-400/20 text-white font-black uppercase text-[10px] tracking-widest italic flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Mengirim Laporan...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-white" />
                          <span>Kirim Ke Developer</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DEV PORTAL (KOTAK MASUK SUPERUSER) */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminPanelOpen(false)}
              className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
            />

            {/* Sidebar-like Drawer on the right */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-stone-900 border-l border-stone-800 text-stone-100 w-full max-w-2xl h-full shadow-2xl relative z-10 flex flex-col font-sans"
            >
              {/* Drawer Header */}
              <div className="p-6 bg-gradient-to-r from-red-950/20 to-stone-950/60 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider italic font-display">KOTAK MASUK DEVELOPER</h3>
                    <p className="text-[9px] text-[#ebdccb]/60 uppercase tracking-widest leading-none mt-1">Superuser Database Controller Portal</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdminPanelOpen(false)}
                  className="p-2 hover:bg-stone-800 rounded-xl text-stone-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filters Block */}
              <div className="px-6 py-4 bg-stone-950/30 border-b border-stone-800 flex flex-wrap gap-4 items-center justify-between text-xs font-sans">
                <div className="flex flex-wrap gap-3">
                  {/* Type Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Tipe:</span>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-[10px] text-stone-300 font-bold focus:outline-none"
                    >
                      <option value="all">Semua Tipe</option>
                      <option value="kendala">🔴 Kendala</option>
                      <option value="saran_pesan">🟡 Saran & Pesan</option>
                    </select>
                  </div>

                  {/* Urgency Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Urgensi:</span>
                    <select
                      value={filterUrgency}
                      onChange={(e) => setFilterUrgency(e.target.value)}
                      className="bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-[10px] text-stone-300 font-bold focus:outline-none"
                    >
                      <option value="all">Semua Urgensi</option>
                      <option value="high">Tinggi</option>
                      <option value="medium">Sedang</option>
                      <option value="low">Rendah</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-[10px] text-stone-300 font-bold focus:outline-none"
                    >
                      <option value="all">Semua Status</option>
                      <option value="pending font-black">Menunggu (Pending)</option>
                      <option value="processed">Diproses (Processed)</option>
                      <option value="resolved">Selesai (Resolved)</option>
                    </select>
                  </div>
                </div>

                <div className="text-[8.5px] text-stone-500 font-black uppercase tracking-wider">
                  Total: {filteredItems.length} pesan
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {loadingFeedbacks ? (
                  <div className="h-40 flex items-center justify-center flex-col gap-2">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Loading feedback records...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="h-40 flex items-center justify-center flex-col gap-2 bg-stone-950/20 rounded-2xl border border-stone-800 border-dashed p-10">
                    <HelpCircle className="w-10 h-10 text-stone-600 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 text-center">Belum ada data pesan masuk yang cocok dengan filter</span>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-stone-950 border border-stone-800 p-5 rounded-3xl relative overflow-hidden flex flex-col gap-3 group/item transition-all hover:border-stone-700"
                    >
                      {/* Priority and Type Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                            item.type === 'kendala' ? 'bg-red-950 text-red-400 border border-red-500/10' : 'bg-amber-950 text-amber-400 border border-amber-500/10'
                          }`}>
                            {item.type === 'kendala' ? '🐞 KENDALA' : '💡 SARAN'}
                          </span>

                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            item.urgency === 'high' ? 'bg-red-900/30 text-rose-300' :
                            item.urgency === 'medium' ? 'bg-amber-900/30 text-amber-300' :
                            'bg-emerald-900/30 text-emerald-300'
                          }`}>
                            Urgensi: {item.urgency}
                          </span>

                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                            item.status === 'resolved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/20' :
                            item.status === 'processed' ? 'bg-blue-950 text-blue-300 border border-blue-500/20' :
                            'bg-stone-900 text-stone-400 border border-stone-800'
                          }`}>
                            {item.status === 'resolved' ? '✅ SELESAI' :
                             item.status === 'processed' ? '⚙️ DIPROSES' :
                             '⏳ MENUNGGU'}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteFeedback(item.id)}
                          className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-red-400 transition-all absolute top-4 right-4"
                          title="Hapus Laporan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content */}
                      <div>
                        <h4 className="text-xs font-black text-white uppercase italic tracking-tight">{item.subject}</h4>
                        <p className="text-[11px] text-stone-300 leading-relaxed mt-1 whitespace-pre-wrap">{item.message}</p>
                      </div>

                      {/* Sender Metadata Row */}
                      <div className="flex flex-wrap items-center justify-between text-[8px] font-bold text-stone-500 border-t border-stone-900 pt-3 font-mono">
                        <span>PENGIRIM: {item.reportedByName} ({item.reportedByRole.toUpperCase()}) / {item.reportedByEmail}</span>
                        <span>WAKTU: {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString('id-ID') : 'Sesaat lalu'}</span>
                      </div>

                      {/* Actions for Admin on this ticket */}
                      <div className="bg-stone-900/50 p-4 rounded-2xl border border-stone-800 flex flex-col gap-3 mt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-950 pb-2">
                          <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest leading-none">set status action</span>
                          <div className="flex gap-2">
                            {(['pending', 'processed', 'resolved'] as const).map((st) => (
                              <button
                                key={st}
                                disabled={updatingId === item.id}
                                onClick={() => handleUpdateStatus(item.id, st)}
                                className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all tracking-wide ${
                                  item.status === st 
                                    ? 'bg-amber-600 text-white' 
                                    : 'bg-stone-950 text-stone-400 hover:bg-stone-800'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Developer Notes field */}
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest flex items-center justify-between">
                            <span>developer notes & feedback response</span>
                            {updatingId === item.id && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingNotes[item.id] !== undefined ? editingNotes[item.id] : (item.developerNotes || '')}
                              onChange={(e) => setEditingNotes({ ...editingNotes, [item.id]: e.target.value })}
                              placeholder="Tuliskan respon atau catatan perbaikan..."
                              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleSaveNotes(item.id)}
                              disabled={updatingId === item.id}
                              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-[#ebdccb]"
                            >
                              Simpan
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
