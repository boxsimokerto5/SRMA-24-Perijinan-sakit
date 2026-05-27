import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Plus, 
  Search, 
  Clock, 
  User, 
  Check, 
  X, 
  Loader2, 
  Heart, 
  Calendar, 
  ChevronRight, 
  AlertCircle, 
  Smartphone,
  BookOpen,
  ClipboardCheck,
  Wrench,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  Timestamp, 
  serverTimestamp 
} from 'firebase/firestore';
import { AppUser, Siswa, JurnalKeperawatan, PenangananJurnal } from '../types';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { notifyAllRoles } from '../services/fcmService';
import { generateJurnalKeperawatanPDF, generateJurnalKeperawatanSummaryPDF } from '../pdfUtils';

interface JurnalKeperawatanViewProps {
  user: AppUser;
}

export default function JurnalKeperawatanView({ user }: JurnalKeperawatanViewProps) {
  const [loading, setLoading] = useState(false);
  const [jurnalList, setJurnalList] = useState<JurnalKeperawatan[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const handleExportPDF = async (journal: JurnalKeperawatan) => {
    if (!journal.id) return;
    setPdfLoadingId(journal.id);
    try {
      await generateJurnalKeperawatanPDF(journal);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor berkas PDF.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleExportRekap = async (range: 'mingguan' | 'bulanan') => {
    setLoading(true);
    try {
      const filtered = jurnalList.filter(rec => {
        const d = rec.tgl_mulai?.toDate ? rec.tgl_mulai.toDate() : (rec.tgl_mulai instanceof Date ? rec.tgl_mulai : null);
        if (!d) return false;
        
        if (range === 'mingguan') {
          return isThisWeek(d, { weekStartsOn: 1 });
        } else {
          return isThisMonth(d);
        }
      });

      if (filtered.length === 0) {
        alert(`Tidak ada data jurnal keperawatan untuk rekap ${range}.`);
        return;
      }

      await generateJurnalKeperawatanSummaryPDF(
        filtered, 
        range === 'mingguan' ? 'Mingguan' : 'Bulanan', 
        user.name || 'Dokter Klinik'
      );
    } catch (err) {
      console.error(err);
      alert('Gagal mencetak rekap.');
    } finally {
      setLoading(false);
    }
  };
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTindakanModal, setShowTindakanModal] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JurnalKeperawatan | null>(null);

  // Form states
  const [searchStudentText, setSearchStudentText] = useState('');
  const [selectedStudentForNew, setSelectedStudentForNew] = useState<Siswa | null>(null);
  const [keteranganSakit, setKeteranganSakit] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  // For Adding actions
  const [tindakanInput, setTindakanInput] = useState('');
  const [markAsCured, setMarkAsCured] = useState(false);

  // Filter state
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'all'>('hari_ini');
  const [statusFilter, setStatusFilter] = useState<'dirawat' | 'sembuh'>('dirawat');
  const [searchQuery, setSearchQuery] = useState('');

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRealTime = (date: Date) => {
    return format(date, 'HH:mm:ss');
  };

  // Subscribe to students list
  useEffect(() => {
    const q = query(collection(db, 'siswa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...rawData
        } as Siswa;
      }).sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
      setStudents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'siswa');
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Jurnal Keperawatan collection
  useEffect(() => {
    const q = query(collection(db, 'jurnal_keperawatan'), orderBy('tgl_mulai', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as JurnalKeperawatan));
      setJurnalList(data);
    }, (err) => {
      console.error(err);
    });

    return () => unsubscribe();
  }, []);

  // Filtered student suggestions based on search input
  const filteredSuggestions = useMemo(() => {
    if (!searchStudentText.trim()) return [];
    return students.filter(s => 
      s.nama_lengkap.toLowerCase().includes(searchStudentText.toLowerCase()) || 
      (s.kelas && s.kelas.toLowerCase().includes(searchStudentText.toLowerCase()))
    ).slice(0, 5);
  }, [students, searchStudentText]);

  // Statistics
  const stats = useMemo(() => {
    const active = jurnalList.filter(j => j.status === 'dirawat');
    const cured = jurnalList.filter(j => j.status === 'sembuh');

    const journalInTime = (time: 'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini') => {
      return jurnalList.filter(rec => {
        const d = rec.tgl_mulai?.toDate ? rec.tgl_mulai.toDate() : (rec.tgl_mulai instanceof Date ? rec.tgl_mulai : null);
        if (!d) return false;
        if (time === 'hari_ini') return isToday(d);
        if (time === 'kemarin') return isYesterday(d);
        if (time === 'minggu_ini') return isThisWeek(d, { weekStartsOn: 1 });
        if (time === 'bulan_ini') return isThisMonth(d);
        return false;
      }).length;
    };

    return {
      active: active.length,
      cured: cured.length,
      hariIni: journalInTime('hari_ini'),
      kemarin: journalInTime('kemarin'),
      mingguIni: journalInTime('minggu_ini'),
      bulanIni: journalInTime('bulan_ini')
    };
  }, [jurnalList]);

  // Filtered Jurnal History
  const filteredJurnal = useMemo(() => {
    return jurnalList.filter(rec => {
      // Filter by text search
      const matchesSearch = searchQuery ? (
        rec.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.keterangan_sakit.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.kelas.toLowerCase().includes(searchQuery.toLowerCase())
      ) : true;

      if (!matchesSearch) return false;

      // Filter by status category
      const currentStatus = rec.status || 'dirawat';
      if (currentStatus !== statusFilter) return false;

      // Filter by time category
      const d = rec.tgl_mulai?.toDate ? rec.tgl_mulai.toDate() : (rec.tgl_mulai instanceof Date ? rec.tgl_mulai : null);
      if (!d) return false;

      if (timeFilter === 'hari_ini') return isToday(d);
      if (timeFilter === 'kemarin') return isYesterday(d);
      if (timeFilter === 'minggu_ini') return isThisWeek(d, { weekStartsOn: 1 });
      if (timeFilter === 'bulan_ini') return isThisMonth(d);
      return true; // all
    });
  }, [jurnalList, searchQuery, timeFilter, statusFilter]);

  // Handle Form Submit
  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForNew || !keteranganSakit.trim()) {
      alert('Mohon pilih siswa dan deskripsikan sakitnya.');
      return;
    }

    setLoading(true);
    try {
      const userRoleLabel = user.role === 'dokter' ? 'Dokter Klinik' : (user.role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama');
      
      const newLog: JurnalKeperawatan = {
        nama_siswa: selectedStudentForNew.nama_lengkap,
        kelas: selectedStudentForNew.kelas || '-',
        keterangan_sakit: keteranganSakit,
        tgl_mulai: Timestamp.now(),
        status: 'dirawat',
        penanganan: [
          {
            waktu: Timestamp.now(),
            oleh_name: user.name,
            oleh_role: userRoleLabel,
            tindakan: `Mulai dirawat: ${keteranganSakit}`
          }
        ],
        created_by_name: user.name,
        created_by_uid: user.uid,
        created_by_role: user.role
      };

      await addDoc(collection(db, 'jurnal_keperawatan'), newLog);

      // Reset
      setSelectedStudentForNew(null);
      setSearchStudentText('');
      setKeteranganSakit('');
      setShowCreateModal(false);

      notifyAllRoles(['dokter', 'wali_asuh', 'wali_asrama'], 'Jurnal Keperawatan Baru', `Siswa ${newLog.nama_siswa} (${newLog.kelas}) dimasukkan ke Jurnal Keperawatan karena sakit.`);

      alert('Berhasil mendaftarkan siswa ke Jurnal Keperawatan.');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat catatan keperawatan.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Action / Tindakan Submit
  const handleAddTindakan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJournal || !tindakanInput.trim()) return;

    setLoading(true);
    try {
      const userRoleLabel = user.role === 'dokter' ? 'Dokter Klinik' : (user.role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama');
      
      const newAction: PenangananJurnal = {
        waktu: Timestamp.now(),
        oleh_name: user.name,
        oleh_role: userRoleLabel,
        tindakan: tindakanInput
      };

      const updatedPenanganan = [...(selectedJournal.penanganan || []), newAction];
      
      const updatePayload: Partial<JurnalKeperawatan> = {
        penanganan: updatedPenanganan
      };

      if (markAsCured) {
        updatePayload.status = 'sembuh';
        updatePayload.tgl_sembuh = Timestamp.now();
        // Also add a "cured" logs marker
        updatePayload.penanganan?.push({
          waktu: Timestamp.now(),
          oleh_name: user.name,
          oleh_role: userRoleLabel,
          tindakan: 'Dinyatakan sembuh dan selesai menjalani perawatan.'
        });
      }

      await updateDoc(doc(db, 'jurnal_keperawatan', selectedJournal.id!), updatePayload);

      // Send Notification
      if (markAsCured) {
        notifyAllRoles(
          ['dokter', 'wali_asuh', 'wali_asrama'], 
          'Siswa Sembuh', 
          `Siswa ${selectedJournal.nama_siswa} (${selectedJournal.kelas}) dinyatakan sembuh setelah mendapatkan perawatan.`
        );
      }

      // Reset
      setShowTindakanModal(false);
      setSelectedJournal(null);
      setTindakanInput('');
      setMarkAsCured(false);
      alert('Tindakan / penanganan keperawatan berhasil disimpan.');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan penanganan.');
    } finally {
      setLoading(false);
    }
  };

  const declareCuredDirectly = async (journal: JurnalKeperawatan) => {
    if (!window.confirm(`Nyatakan siswa ${journal.nama_siswa} telah sembuh?`)) return;

    setLoading(true);
    try {
      const userRoleLabel = user.role === 'dokter' ? 'Dokter Klinik' : (user.role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama');
      const updatedPenanganan = [
        ...(journal.penanganan || []),
        {
          waktu: Timestamp.now(),
          oleh_name: user.name,
          oleh_role: userRoleLabel,
          tindakan: 'Dinyatakan sembuh dan selesai menjalani perawatan.'
        }
      ];

      await updateDoc(doc(db, 'jurnal_keperawatan', journal.id!), {
        status: 'sembuh',
        tgl_sembuh: Timestamp.now(),
        penanganan: updatedPenanganan
      });

      notifyAllRoles(
        ['dokter', 'wali_asuh', 'wali_asrama'], 
        'Siswa Sembuh', 
        `Siswa ${journal.nama_siswa} (${journal.kelas}) dinyatakan sembuh setelah mendapatkan perawatan.`
      );

      alert('Berhasil memperbarui status siswa menjadi SEMBUH.');
    } catch (err) {
      console.error(err);
      alert('Gagal mendata siswa sembuh.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Banner Slimmed & Balanced 8:16 Ratio */}
      <div className="bg-[#3e2723] rounded-[2rem] py-5 px-6 md:py-6 md:px-8 shadow-3xl text-white relative overflow-hidden border border-[#5d4037]">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Left part (16/24 or 2/3 of space in desktop) -> Title and Info */}
          <div className="w-full md:w-2/3 flex items-center gap-4 text-left">
            <div className="w-12 h-12 bg-[#d7ccc8] rounded-2xl flex items-center justify-center shadow-xl shadow-black/30 rotate-3 transition-transform shrink-0">
              <Activity className="w-6 h-6 text-[#3e2723] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black font-display tracking-tight leading-none italic uppercase">Jurnal Keperawatan</h1>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ebdccb]/75 mt-1.5 italic leading-relaxed">
                Log Catatan Medis & Penanganan Harian Kesehatan Peserta Didik Sekolah Asrama
              </p>
            </div>
          </div>

          {/* Right part (8/24 or 1/3 of space in desktop) -> Live Clock */}
          <div className="w-full md:w-1/3 bg-[#4e342e] border border-amber-500/15 rounded-2xl py-3 px-4 text-right shrink-0">
            <p className="text-[7px] font-black text-amber-200/50 uppercase tracking-widest mb-0.5 flex items-center justify-end gap-1">
              <span className="w-1 h-1 bg-amber-400 rounded-full animate-ping" />
              LIVE CLINIC CLOCK
            </p>
            <p className="font-mono text-xs font-bold text-amber-100 tracking-wider">
              {formatRealTime(currentTime)} WIB
            </p>
          </div>
        </div>

        {/* Action Controls in Header (Buat Catatan, Stats & Cetak Rekap) */}
        <div className="relative z-10 mt-5 pt-4 border-t border-[#ebdccb]/10 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-amber-100/80">
            <div className="bg-[#4e342e] px-3 py-1.5 rounded-xl border border-rose-500/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Dirawat: <strong className="text-white text-xs">{stats.active}</strong></span>
            </div>
            <div className="bg-[#4e342e] px-3 py-1.5 rounded-xl border border-emerald-500/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Sembuh: <strong className="text-white text-xs">{stats.cured}</strong></span>
            </div>

            {/* Print Rekap Buttons */}
            <div className="flex items-center gap-2 border-l border-[#ebdccb]/15 pl-4">
              <button
                onClick={() => handleExportRekap('mingguan')}
                className="py-1.5 px-3 bg-[#4e342e] hover:bg-[#5d4037] text-white font-black uppercase tracking-widest text-[8px] rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-md border border-[#ebdccb]/15"
              >
                <FileText className="w-3 h-3 text-rose-400" />
                Rekap Mingguan
              </button>
              <button
                onClick={() => handleExportRekap('bulanan')}
                className="py-1.5 px-3 bg-[#4e342e] hover:bg-[#5d4037] text-white font-black uppercase tracking-widest text-[8px] rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-md border border-[#ebdccb]/15"
              >
                <FileText className="w-3 h-3 text-rose-400" />
                Rekap Bulanan
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedStudentForNew(null);
              setSearchStudentText('');
              setKeteranganSakit('');
              setShowCreateModal(true);
            }}
            className="bg-amber-100 hover:bg-amber-200 text-[#3e2723] py-2.5 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 self-stretch xl:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#3e2723]" />
            Catat Diagnosa Baru
          </button>
        </div>
      </div>

      {/* Kategori Status Perawatan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-white rounded-3xl border border-[#ebdccb] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3e2723]/5 flex items-center justify-center border border-[#ebdccb]/30">
            <ClipboardCheck className="w-4 h-4 text-[#3e2723]" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-black uppercase text-[#3e2723] italic leading-none">Status Klasifikasi Perawatan</h3>
            <p className="text-[7.5px] font-bold text-stone-400 uppercase tracking-widest mt-1">Sakit (Dalam Perawatan) vs Sembuh (Riwayat)</p>
          </div>
        </div>

        <div className="flex bg-[#ebdccb]/20 p-1 rounded-2xl border border-[#ebdccb]/40 w-full sm:w-auto sm:min-w-[280px]">
          <button
            onClick={() => setStatusFilter('dirawat')}
            className={`flex-1 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              statusFilter === 'dirawat'
                ? 'bg-[#3e2723] text-amber-100 shadow-md translate-y-[-1px]'
                : 'text-[#5d4037] hover:text-[#3e2723]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-200" />
            Dirawat ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter('sembuh')}
            className={`flex-1 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              statusFilter === 'sembuh'
                ? 'bg-emerald-600 text-white shadow-md translate-y-[-1px]'
                : 'text-[#5d4037] hover:text-[#3e2723]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sembuh ({stats.cured})
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center justify-between">
        {/* Category Time Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar justify-start shrink-0">
          {[
            { id: 'hari_ini', label: `Hari Ini (${stats.hariIni})` },
            { id: 'kemarin', label: `Kemarin (${stats.kemarin})` },
            { id: 'minggu_ini', label: `Minggu Ini (${stats.mingguIni})` },
            { id: 'bulan_ini', label: `Bulan Ini (${stats.bulanIni})` },
            { id: 'all', label: `Semua (${jurnalList.length})` }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setTimeFilter(cat.id as any)}
              className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-4 ${
                timeFilter === cat.id
                  ? 'bg-[#5d4037] text-amber-100 border-[#3e2723] shadow-lg translate-y-[-1px]'
                  : 'bg-white text-[#8b5e3c] border-stone-200/50 hover:bg-[#faf6f0]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search input field */}
        <div className="relative max-w-sm w-full md:self-center">
          <input
            type="text"
            placeholder="Cari siswa, kelas, diagnosa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-[#ebdccb] rounded-2xl text-xs font-bold text-[#3e2723] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#3e2723]/35 placeholder-stone-400 italic"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* List / History Cards Cozy Chocolate Nuance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {filteredJurnal.length > 0 ? (
          filteredJurnal.map((journal) => {
            const startD = journal.tgl_mulai?.toDate ? journal.tgl_mulai.toDate() : new Date();
            const formattedStartDate = format(startD, 'EEEE, d MMMM yyyy • HH:mm', { locale: id });
            
            return (
              <div 
                key={journal.id}
                className="bg-white rounded-[2rem] border border-[#ebdccb] hover:border-[#a1887f] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#ebdccb]/45">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#f5ebe0] text-[#3e2723] flex items-center justify-center font-black text-sm italic border border-[#ebdccb]/30 shrink-0">
                      <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
                    </div>
                    <div className="min-w-0 font-sans">
                      <h4 className="font-black text-xs sm:text-sm text-[#3e2723] font-display uppercase italic tracking-tight leading-tight truncate">
                        {journal.nama_siswa}
                      </h4>
                      <p className="text-[10px] font-bold text-[#8d6e63]/85 uppercase mt-0.5 flex items-center gap-1.5">
                        <span className="bg-[#5d4037] text-amber-200 text-[8px] font-black px-2 py-0.5 rounded tracking-wider uppercase leading-none">
                          Kelas {journal.kelas}
                        </span>
                        <span>Sakit: {journal.keterangan_sakit}</span>
                      </p>
                    </div>
                  </div>

                  <span className={`text-[8px] font-black px-2.5 py-1 rounded uppercase tracking-wider shrink-0 shadow-sm ${
                    journal.status === 'sembuh'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                  }`}>
                    {journal.status === 'sembuh' ? '❇️ SEMBUH' : '⏳ DIRAWAT'}
                  </span>
                </div>

                {/* Patient Case Description */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-150 text-[10.5px] text-stone-600 font-sans space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[7.5px] font-black uppercase text-stone-400">Pencatat Awal:</span>
                    <span className="font-bold text-[#3e2723] uppercase text-[8px]">{journal.created_by_name} ({journal.created_by_role === 'dokter' ? 'Dokter' : journal.created_by_role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama'})</span>
                  </div>
                </div>

                {/* Treatment Care Log list / Timeline */}
                <div className="space-y-2 mt-2">
                  <span className="text-[8px] font-black text-[#5d4037] uppercase tracking-widest block">Riwayat Penanganan Keperawatan ({journal.penanganan?.length || 0})</span>
                  
                  <div className="border-l-2 border-[#ebdccb] pl-4 py-1.5 space-y-3.5">
                    {journal.penanganan && journal.penanganan.map((action, actionIdx) => {
                      const actionD = action.waktu?.toDate ? action.waktu.toDate() : new Date();
                      return (
                        <div key={actionIdx} className="relative text-left">
                          {/* Dot item */}
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

                {/* Footer with actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#ebdccb]/30">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-black text-[#8d6e63]/60 uppercase tracking-widest font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#3e2723]/60 shrink-0" />
                    <span>Mulai: {formattedStartDate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={pdfLoadingId === journal.id}
                      onClick={() => handleExportPDF(journal)}
                      className="py-1.5 px-3 bg-[#f5ebe0]/60 hover:bg-[#e3d5ca] text-[#3e2723] font-black uppercase tracking-wider text-[9px] rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm disabled:opacity-50 border border-[#ebdccb]/40"
                    >
                      {pdfLoadingId === journal.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3e2723]" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      Cetak PDF
                    </button>

                    {journal.status === 'dirawat' && (
                      <>
                        <button
                          onClick={() => declareCuredDirectly(journal)}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[9px] rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Sembuh
                        </button>
                        <button
                          onClick={() => {
                            setSelectedJournal(journal);
                            setTindakanInput('');
                            setMarkAsCured(false);
                            setShowTindakanModal(true);
                          }}
                          className="py-1.5 px-3 bg-[#3e2723] hover:bg-black text-amber-100 font-black uppercase tracking-wider text-[9px] rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tindakan
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-28 bg-white rounded-[3rem] border border-dashed border-[#ebdccb]/45 text-center flex flex-col items-center justify-center px-6">
            <Activity className="w-16 h-16 text-stone-100 mb-4 opacity-50" />
            <h3 className="text-xl font-black text-stone-300 uppercase tracking-widest italic font-display">Data Jurnal Nihil</h3>
            <p className="text-[10px] font-black text-[#8d6e63] uppercase tracking-[0.2em] italic max-w-sm mt-1">Tidak ada catatan keperawatan aktif di bawah filter ini.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: Create New Diagnose Jurnal Entry */}
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
                    <span className="text-[8px] font-black tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded uppercase font-mono">HEALTH RECORD INSIGHT</span>
                    <h3 className="text-xl font-black uppercase tracking-tight font-display mt-1">Jurnal Diagnosa Siswa Sakit</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedStudentForNew(null);
                      setSearchStudentText('');
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-[#f5ebe0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateJournal} className="p-6 space-y-4">
                {/* Search / Select Student with autocomplete */}
                <div className="space-y-1.5 relative">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Cari & Pilih Nama Siswa</label>
                  {!selectedStudentForNew ? (
                    <>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ketik nama siswa..."
                          value={searchStudentText}
                          onChange={(e) => {
                            setSearchStudentText(e.target.value);
                            setShowStudentSuggestions(true);
                          }}
                          className="w-full pl-12 pr-6 py-3.5 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs text-stone-800 font-semibold"
                        />
                        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Suggestions list */}
                      {showStudentSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#ebdccb] rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                          {filteredSuggestions.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentForNew(st);
                                setShowStudentSuggestions(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-[#faf6f0] transition-colors flex items-center justify-between border-b border-[#ebdccb]/20"
                            >
                              <div className="text-xs font-bold text-stone-800">{st.nama_lengkap}</div>
                              <span className="text-[8.5px] font-black bg-[#5d4037] text-amber-200 px-2.5 py-0.5 rounded uppercase">Kelas: {st.kelas}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-[#f5ebe0]/40 rounded-xl border border-[#ebdccb] flex items-center justify-between">
                      <div>
                        <span className="text-[7.5px] font-black text-[#5d4037] uppercase">Siswa Terpilih</span>
                        <h4 className="text-xs font-black text-[#3e2723] uppercase mt-0.5">{selectedStudentForNew.nama_lengkap}</h4>
                        <p className="text-[9px] font-semibold text-stone-500 mt-0.5">Kelas {selectedStudentForNew.kelas} {selectedStudentForNew.asrama ? `• ${selectedStudentForNew.asrama}` : ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForNew(null)}
                        className="py-1 px-3 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold border border-red-200"
                      >
                        Ubah
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Keterangan / Gejala / Sakit</label>
                  <textarea
                    rows={4}
                    placeholder="Contoh: Panas demam tinggi sejak pagi hari, batuk-batuk, nafsu makan berkurang."
                    value={keteranganSakit}
                    onChange={(e) => setKeteranganSakit(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                <div className="pt-4 border-t border-[#ebdccb]/40 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedStudentForNew(null);
                      setSearchStudentText('');
                    }}
                    className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedStudentForNew}
                    className="flex-1 py-3 bg-[#3e2723] hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Jurnal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Add Actions / Tindakan Medis Or Declare Cured Popup */}
      <AnimatePresence>
        {showTindakanModal && selectedJournal && (
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
                    <span className="text-[8px] font-black tracking-widest bg-white/15 px-2.5 py-0.5 rounded uppercase font-mono">TINDAKAN REHABILITASI</span>
                    <h3 className="text-lg font-black uppercase tracking-tight font-display mt-0.5">Tambah Penanganan</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowTindakanModal(false);
                      setSelectedJournal(null);
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-[#f5ebe0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddTindakan} className="p-6 space-y-4">
                <div className="bg-[#fcfaf6] p-4 rounded-xl border border-[#ebdccb]/30 space-y-1">
                  <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block">Pasien Dirawat</span>
                  <h4 className="text-xs font-black text-[#5d4037] uppercase">{selectedJournal.nama_siswa} ({selectedJournal.kelas})</h4>
                  <p className="text-[10px] text-stone-500 font-sans italic">"Sakit: {selectedJournal.keterangan_sakit}"</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-[#8b5e3c] block">Penanganan / Tindakan Yang Diberikan</label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Memberikan obat Paracetamol 500mg, menyuruh minum air putih hangat dan tidur istirahat di unit asrama."
                    value={tindakanInput}
                    onChange={(e) => setTindakanInput(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#fcfaf6] border border-[#ebdccb]/60 rounded-xl focus:ring-2 focus:ring-[#3e2723] outline-none text-xs font-semibold text-stone-800 font-sans"
                  />
                </div>

                {/* Mark as Cured directly check */}
                <div className="flex items-center gap-3 bg-[#fcd34d]/10 border border-amber-300/30 p-3 rounded-2xl">
                  <input
                    type="checkbox"
                    id="markAsCuredCheck"
                    checked={markAsCured}
                    onChange={(e) => setMarkAsCured(e.target.checked)}
                    className="w-4.5 h-4.5 accent-[#3e2723]"
                  />
                  <label htmlFor="markAsCuredCheck" className="text-[11px] font-bold text-[#3e2723] select-none cursor-pointer">
                    Siswa telah sembuh sepenuhnya setelah tindakan ini.
                  </label>
                </div>

                <div className="pt-4 border-t border-[#ebdccb]/40 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTindakanModal(false);
                      setSelectedJournal(null);
                    }}
                    className="flex-1 py-3 bg-[#f5ebe0] hover:bg-[#e3d5ca] text-[#3e2723] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !tindakanInput.trim()}
                    className="flex-1 py-3 bg-[#3e2723] hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Penanganan
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
