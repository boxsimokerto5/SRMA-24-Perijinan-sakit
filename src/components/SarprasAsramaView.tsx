import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Wrench, 
  MapPin, 
  Printer, 
  Plus, 
  X, 
  Check, 
  Loader2,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, SarprasReport } from '../types';
import { generateSarprasReportPDF, generateSarprasSummaryPDF } from '../pdfUtils';

interface SarprasAsramaViewProps {
  user: AppUser;
}

export default function SarprasAsramaView({ user }: SarprasAsramaViewProps) {
  const [sarprasReports, setSarprasReports] = useState<SarprasReport[]>([]);
  const [sarprasFilter, setSarprasFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('semua');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSarpras, setNewSarpras] = useState({
    item_name: '',
    damage_description: '',
    location: '',
    asrama: 'Asrama Putra'
  });
  
  const [selectedSarprasForTindakan, setSelectedSarprasForTindakan] = useState<SarprasReport | null>(null);
  const [tindakanStatus, setTindakanStatus] = useState<'pending' | 'on_progress' | 'fixed'>('on_progress');
  const [tindakanKeterangan, setTindakanKeterangan] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time listener for reports
  useEffect(() => {
    const q = query(
      collection(db, 'sarpras_reports'),
      orderBy('tgl_lapor', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SarprasReport));
      setSarprasReports(reports);
    });

    return () => unsubscribe();
  }, []);

  // Calculate statistics for filters
  const sarprasStats = useMemo(() => {
    return {
      hariIni: sarprasReports.filter(rec => {
        const d = rec.tgl_lapor?.toDate ? rec.tgl_lapor.toDate() : (rec.tgl_lapor instanceof Date ? rec.tgl_lapor : null);
        return d && isToday(d);
      }).length,
      kemarin: sarprasReports.filter(rec => {
        const d = rec.tgl_lapor?.toDate ? rec.tgl_lapor.toDate() : (rec.tgl_lapor instanceof Date ? rec.tgl_lapor : null);
        return d && isYesterday(d);
      }).length,
      mingguIni: sarprasReports.filter(rec => {
        const d = rec.tgl_lapor?.toDate ? rec.tgl_lapor.toDate() : (rec.tgl_lapor instanceof Date ? rec.tgl_lapor : null);
        return d && isThisWeek(d, { weekStartsOn: 1 });
      }).length,
      bulanIni: sarprasReports.filter(rec => {
        const d = rec.tgl_lapor?.toDate ? rec.tgl_lapor.toDate() : (rec.tgl_lapor instanceof Date ? rec.tgl_lapor : null);
        return d && isThisMonth(d);
      }).length,
    };
  }, [sarprasReports]);

  // Filter reports
  const filteredReports = useMemo(() => {
    return sarprasReports.filter(rec => {
      const date = rec.tgl_lapor?.toDate ? rec.tgl_lapor.toDate() : (rec.tgl_lapor instanceof Date ? rec.tgl_lapor : null);
      if (!date) return false;

      if (sarprasFilter === 'hari_ini') return isToday(date);
      if (sarprasFilter === 'kemarin') return isYesterday(date);
      if (sarprasFilter === 'minggu_ini') return isThisWeek(date, { weekStartsOn: 1 });
      if (sarprasFilter === 'bulan_ini') return isThisMonth(date);
      return true;
    });
  }, [sarprasReports, sarprasFilter]);

  // Handle reporting new damage
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSarpras.item_name || !newSarpras.damage_description || !newSarpras.location) {
      alert('Mohon lengkapi semua data laporan');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'sarpras_reports'), {
        ...newSarpras,
        author_name: user.name,
        author_uid: user.uid,
        tgl_lapor: serverTimestamp(),
        status: 'pending'
      });

      setNewSarpras({
        item_name: '',
        damage_description: '',
        location: '',
        asrama: 'Asrama Putra'
      });
      setShowCreateModal(false);
      alert('Laporan kerusakan berhasil dikirim');
    } catch (err) {
      console.error('Error creating sarpras report:', err);
      alert('Gagal mengirim laporan');
    } finally {
      setLoading(false);
    }
  };

  // Handle follow up actions
  const handleSaveTindakanLanjut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSarprasForTindakan) return;

    setLoading(true);
    try {
      const roleName = user.role === 'wali_asuh' 
        ? 'Wali Asuh' 
        : (user.role === 'wali_asrama' 
          ? 'Wali Asrama' 
          : (user.role === 'wali_kelas' ? 'Wali Kelas' : 'Guru Mapel'));

      const newAction = {
        waktu: Timestamp.now(),
        oleh_name: user.name,
        oleh_role: roleName,
        tindakan: tindakanKeterangan
      };

      const updatedTindakanList = [
        ...(selectedSarprasForTindakan.tindakan_list || []),
        newAction
      ];

      await updateDoc(doc(db, 'sarpras_reports', selectedSarprasForTindakan.id!), {
        status: tindakanStatus,
        tindakan_list: updatedTindakanList,
        tindakan_oleh_name: user.name,
        tindakan_oleh_role: roleName,
        tgl_tindakan: Timestamp.now(),
        keterangan_tindakan: tindakanKeterangan,
        updatedAt: serverTimestamp()
      });

      setSelectedSarprasForTindakan(null);
      setTindakanKeterangan('');
      alert('Tindak lanjut berhasil disimpan!');
    } catch (err) {
      console.error('Error updating sarpras follow up:', err);
      alert('Gagal menyimpan tindak lanjut');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header banner coklat */}
      <div className="bg-[#3e2723] rounded-[3rem] p-8 lg:p-10 shadow-3xl text-white relative overflow-hidden border border-[#5d4037]">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
          <div className="flex items-center gap-8 text-left">
            <div className="w-20 h-20 bg-[#d7ccc8] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/40 rotate-3 transition-transform shrink-0">
              <Wrench className="w-10 h-10 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black font-display tracking-tight leading-none italic uppercase">Sarpras Asrama</h1>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ebdccb]/70 mt-3 italic leading-relaxed">
                Platform Pelindungan, Pelaporan, & Pemantauan Kerusakan Sarana Prasarana Asrama
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons in Chocolate Header */}
        <div className="relative z-10 mt-8 pt-6 border-t border-[#ebdccb]/10 flex flex-col sm:flex-row flex-wrap gap-4 justify-start">
          <button
            onClick={() => {
              const filtered = sarprasReports.filter(r => {
                const date = r.tgl_lapor?.toDate ? r.tgl_lapor.toDate() : null;
                return date && isThisWeek(date, { weekStartsOn: 1 });
              });
              generateSarprasSummaryPDF(filtered, 'Minggu Ini', { name: user.name, role: user.role });
            }}
            className="bg-[#4e342e] hover:bg-black/30 border border-amber-500/10 text-amber-200 py-3.5 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Rekap Mingguan
          </button>
          <button
            onClick={() => {
              const filtered = sarprasReports.filter(r => {
                const date = r.tgl_lapor?.toDate ? r.tgl_lapor.toDate() : null;
                return date && isThisMonth(date);
              });
              generateSarprasSummaryPDF(filtered, 'Bulan Ini', { name: user.name, role: user.role });
            }}
            className="bg-[#4e342e] hover:bg-black/30 border border-amber-500/10 text-amber-200 py-3.5 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Rekap Bulanan
          </button>
          <button
            onClick={() => {
              setNewSarpras({
                item_name: '',
                damage_description: '',
                location: '',
                asrama: 'Asrama Putra'
              });
              setShowCreateModal(true);
            }}
            className="bg-amber-100 hover:bg-amber-200 text-[#3e2723] py-3.5 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#3e2723]" />
            Buat Catatan Kerusakan
          </button>
        </div>
      </div>

      {/* Category Filter Tab */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar justify-start">
        {[
          { id: 'hari_ini', label: `Hari Ini (${sarprasStats.hariIni})` },
          { id: 'kemarin', label: `Kemarin (${sarprasStats.kemarin})` },
          { id: 'minggu_ini', label: `Minggu Ini (${sarprasStats.mingguIni})` },
          { id: 'bulan_ini', label: `Bulan Ini (${sarprasStats.bulanIni})` },
          { id: 'semua', label: `Semua (${sarprasReports.length})` }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSarprasFilter(cat.id as any)}
            className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-4 ${
              sarprasFilter === cat.id
                ? 'bg-[#5d4037] text-amber-100 border-[#3e2723] shadow-lg translate-y-[-1px]'
                : 'bg-white text-[#8b5e3c] border-stone-200/50 hover:bg-[#faf6f0]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const repDate = report.tgl_lapor?.toDate ? report.tgl_lapor.toDate() : new Date();
            const formattedRepDate = format(repDate, 'EEEE, d MMMM yyyy • HH:mm', { locale: id });
            return (
              <div 
                key={report.id}
                className="bg-white rounded-[2rem] border border-[#ebdccb] hover:border-[#a1887f] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-[#ebdccb]/45">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#f5ebe0] text-[#3e2723] flex items-center justify-center font-black text-sm italic border border-[#ebdccb]/30 shrink-0">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-xs sm:text-sm text-[#3e2723] font-display uppercase italic tracking-tight leading-tight truncate">
                        {report.item_name}
                      </h4>
                      <p className="text-[10px] font-bold text-[#8d6e63]/85 uppercase mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#3e2723]/60" />
                        <span>{report.location}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`text-[8.5px] font-black px-2.5 py-1 rounded uppercase tracking-wider shrink-0 shadow-sm ${
                    report.status === 'fixed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                      : report.status === 'on_progress'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                      : 'bg-[#faf0ec] text-amber-700 border border-[#f5d5c6]'
                  }`}>
                    {report.status === 'fixed' ? '🍏 Selesai' : report.status === 'on_progress' ? '🌀 Proses' : '⏳ Pending'}
                  </span>
                </div>

                {/* Damage description */}
                <div className="bg-[#fcfaf6] p-4 rounded-2xl border border-[#ebdccb]/45 pl-4 relative italic text-[11px] text-[#5d4037] font-medium leading-relaxed font-sans">
                  "{report.damage_description}"
                </div>

                {/* Detail Pembuat Laporan dan Tindak Lanjut Timeline */}
                <div className="space-y-2 mt-1">
                  <div className="bg-[#fcfaf6]/50 p-2.5 rounded-xl border border-[#ebdccb]/20 text-[10px] text-stone-600 space-y-0.5">
                    <p className="font-semibold flex items-center justify-between">
                      <span className="text-[#3e2723] font-bold uppercase text-[7.5px] tracking-wider block">Pelapor:</span>
                      <span className="font-bold text-[#3e2723]">{report.author_name}</span>
                    </p>
                    <p className="flex items-center justify-between text-stone-400">
                      <span>Sektor Asrama:</span>
                      <span className="font-mono text-[9px]">{report.asrama}</span>
                    </p>
                  </div>

                  {/* Chronological Action Timeline adopted from nursing log */}
                  {(() => {
                    const actions = report.tindakan_list || (report.keterangan_tindakan ? [{
                      waktu: report.tgl_tindakan || report.tgl_lapor,
                      oleh_name: report.tindakan_oleh_name || 'Petugas',
                      oleh_role: report.tindakan_oleh_role || 'Staff',
                      tindakan: report.keterangan_tindakan
                    }] : []);

                    if (actions.length === 0) {
                      return (
                        <div className="p-3 bg-[#fcfaf6] rounded-xl text-center border border-dashed border-[#ebdccb]/30">
                          <p className="text-[9px] font-bold text-[#8d6e63]/60 uppercase italic">Belum ada tindakan perbaikan</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 mt-2 bg-[#f5ebe0]/20 border border-[#ebdccb]/40 rounded-2xl p-4">
                        <span className="text-[8px] font-black text-[#5d4037] uppercase tracking-widest block">Riwayat Tindakan Perbaikan ({actions.length})</span>
                        <div className="border-l-2 border-[#ebdccb] pl-4 py-1.5 space-y-3.5">
                          {actions.map((action, actionIdx) => {
                            const actionD = action.waktu?.toDate ? action.waktu.toDate() : new Date();
                            return (
                              <div key={actionIdx} className="relative text-left">
                                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#5d4037] border border-white" />
                                <div className="text-[10.5px] leading-relaxed">
                                  <span className="font-semibold text-slate-800 font-sans">{action.tindakan}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-black text-[#8d6e63]/85 uppercase italic">
                                      Oleh: {action.oleh_name} ({action.oleh_role})
                                    </span>
                                    <span className="text-[7.5px] font-semibold text-stone-400 font-mono">
                                      {format(actionD, 'd MMM • HH:mm', { locale: id })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer with actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#ebdccb]/30">
                  <span className="text-[8.5px] font-black text-[#8d6e63]/60 uppercase tracking-widest font-mono">
                    {formattedRepDate}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => generateSarprasReportPDF(report)}
                      className="p-2.5 bg-[#f5ebe0] text-[#3e2723] hover:bg-[#e3d5ca] rounded-xl transition-all active:scale-95 border border-[#ebdccb]/50"
                      title="Cetak Laporan PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSarprasForTindakan(report);
                        setTindakanStatus(report.status || 'on_progress');
                        setTindakanKeterangan('');
                      }}
                      className="flex items-center gap-1.5 py-2 px-3.5 bg-[#3e2723] hover:bg-black text-[9px] text-white font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm font-sans"
                    >
                      <Check className="w-3.5 h-3.5 text-amber-200" />
                      Tindak Lanjut
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-24 bg-white rounded-[3rem] border border-dashed border-[#ebdccb]/40 text-center flex flex-col items-center justify-center px-6">
            <Wrench className="w-16 h-16 text-stone-100 mb-4 opacity-50" />
            <h3 className="text-xl font-black text-stone-300 uppercase tracking-widest italic font-display">Semua Beres</h3>
            <p className="text-[10px] font-black text-[#8d6e63] uppercase tracking-[0.2em] italic max-w-sm mt-1">Tidak ada laporan kerusakan sarpras pada kategori ini.</p>
          </div>
        )}
      </div>

      {/* Modal Buat Laporan */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-[#ebdccb] shadow-2xl max-w-lg w-full overflow-hidden text-left"
            >
              <div className="bg-[#3e2723] p-6 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <span className="text-[8px] font-black tracking-widest bg-white/10 px-2.5 py-1 rounded uppercase font-mono">DORMITORY ASSETS</span>
                    <h3 className="text-xl font-black uppercase tracking-tight font-display mt-2 italic">Laporkan Kerusakan</h3>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-[#f5ebe0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitReport} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Sektor Asrama</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Asrama Putra', 'Asrama Putri'].map((asr) => (
                      <button
                        key={asr}
                        type="button"
                        onClick={() => setNewSarpras(prev => ({ ...prev, asrama: asr }))}
                        className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          newSarpras.asrama === asr
                            ? 'bg-[#3e2723] text-white border-transparent shadow-lg'
                            : 'bg-[#fcfaf6] border-[#ebdccb]/60 text-[#8b5e3c] hover:bg-stone-50'
                        }`}
                      >
                        {asr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Nama Barang / Fasilitas</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Gagang Pintu, AC Kamar, Sanyo..."
                    value={newSarpras.item_name}
                    onChange={(e) => setNewSarpras(prev => ({ ...prev, item_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Lokasi Detail</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kamar 12, Masjid Sektor Barat, Dapur..."
                    value={newSarpras.location}
                    onChange={(e) => setNewSarpras(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Deskripsi Kerusakan</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Contoh: Gagang pintu patah total tidak bisa dikancing dari dalam."
                    value={newSarpras.damage_description}
                    onChange={(e) => setNewSarpras(prev => ({ ...prev, damage_description: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                <div className="pt-4 border-t border-[#ebdccb]/40 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-[#3e2723] hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Kirim Laporan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tindak Lanjut */}
      <AnimatePresence>
        {selectedSarprasForTindakan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-[#ebdccb] shadow-2xl max-w-md w-full overflow-hidden text-left"
            >
              <div className="bg-[#5d4037] p-6 text-white relative">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black tracking-widest bg-white/15 px-2.5 py-0.5 rounded uppercase font-mono">FOLLOW UP ACTIONS</span>
                    <h3 className="text-lg font-black uppercase tracking-tight font-display mt-1">Tindak Lanjut Kerusakan</h3>
                  </div>
                  <button
                    onClick={() => setSelectedSarprasForTindakan(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-[#f5ebe0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveTindakanLanjut} className="p-6 space-y-4">
                <div className="bg-[#fcfaf6] p-4 rounded-xl border border-[#ebdccb]/30 space-y-1">
                  <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block">Detail Item Kerusakan</span>
                  <h4 className="text-xs font-black text-[#5d4037] uppercase">{selectedSarprasForTindakan.item_name}</h4>
                  <p className="text-[10px] text-stone-500 font-sans italic">"{selectedSarprasForTindakan.damage_description}"</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Status Terbaru</label>
                  <select
                    value={tindakanStatus}
                    onChange={(e) => setTindakanStatus(e.target.value as any)}
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-bold text-[#3e2723] font-sans"
                  >
                    <option value="pending">🟡 Pending (Belum Ditangani)</option>
                    <option value="on_progress">🔵 Proses (Sedang Diperbaiki)</option>
                    <option value="fixed">🟢 Selesai (Sudah Diperbaiki)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Catatan Tindakan Lengkap</label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Lampu telah diganti baru oleh tim sarpras asrama pada sore hari tadi."
                    value={tindakanKeterangan}
                    onChange={(e) => setTindakanKeterangan(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                <div className="pt-4 border-t border-[#ebdccb]/40 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSarprasForTindakan(null)}
                    className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-[#3e2723] hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Tindakan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
