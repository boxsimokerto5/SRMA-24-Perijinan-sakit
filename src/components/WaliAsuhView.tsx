import React, { useState } from 'react';
import { Home, MessageSquare, Send, Clock, User, Printer, Loader2, CheckCircle2, Calendar, Plus, MapPin, ClipboardList, Activity, FileText, Mail, ShieldCheck, BarChart3, Search, Menu, Smartphone, History, Check } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, LogTindakan, Memorandum, PinjamHP } from '../types';
import { notifyUserByRole } from '../services/fcmService';
import { format, addDays } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';
import ProfileView from './ProfileView';

interface WaliAsuhViewProps {
  user: AppUser;
  activeTab: string;
}

export default function WaliAsuhView({ user, activeTab }: WaliAsuhViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [catatanKamar, setCatatanKamar] = useState<{ [key: string]: string }>({});
  const [newTindakan, setNewTindakan] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [viewMode, setViewMode] = useState<'perizinan' | 'pinjam_hp'>('perizinan');
  const [showMenu, setShowMenu] = useState(false);
  const [pinjamHPList, setPinjamHPList] = useState<PinjamHP[]>([]);
  const [showPinjamForm, setShowPinjamForm] = useState(false);
  
  // Pinjam HP Form states
  const [phNamaSiswa, setPhNamaSiswa] = useState('');
  const [phKelas, setPhKelas] = useState('X-1');
  const [phKeperluan, setPhKeperluan] = useState('');

  const currentSelectedPermit = permits.find(p => p.id === selectedPermit?.id) || selectedPermit;

  const filteredPermits = permits.filter(p => {
    const matchesSearch = 
      p.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomor_surat.toLowerCase().includes(searchTerm.toLowerCase());
    
    const permitDate = p.tgl_surat?.toDate();
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesDate;
  });

  // Form states for Izin Umum
  const [nomorSurat, setNomorSurat] = useState(`SRMA-U-${Date.now().toString().slice(-6)}`);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [alasan, setAlasan] = useState('');
  const [jumlahHari, setJumlahHari] = useState(1);
  const [tglMulai, setTglMulai] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [waliKelas, setWaliKelas] = useState(WALI_KELAS_LIST[0].name);

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('status', 'in', ['pending_asuh', 'pending_kelas', 'approved', 'pending_ack', 'acknowledged']),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit));
      setPermits(data);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'wali_asuh'),
      orderBy('tgl_memo', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'pinjam_hp'),
      orderBy('tgl_pinjam', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinjamHP));
      setPinjamHPList(data);
    });
    return () => unsubscribe();
  }, []);

  const handleGeneratePDF = async (permit: IzinSakit) => {
    setPdfLoading(permit.id!);
    try {
      await generatePermitPDF(permit);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setPdfLoading(null);
    }
  };

  const handleSubmitUmum = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const startDate = new Date(tglMulai);
    const endDate = addDays(startDate, jumlahHari - 1);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'umum',
        nomor_surat: nomorSurat,
        nama_siswa: namaSiswa,
        kelas: kelas,
        alasan: alasan,
        jumlah_hari: jumlahHari,
        tgl_mulai: Timestamp.fromDate(startDate),
        tgl_selesai: Timestamp.fromDate(endDate),
        tgl_surat: Timestamp.now(),
        lokasi: 'Kediri',
        nama_wali_asuh: user.name,
        wali_asuh_uid: user.uid,
        nama_wali_kelas: waliKelas,
        status: 'pending_kelas', // Langsung ke Wali Kelas
      });

      // Notify Wali Kelas
      notifyUserByRole('wali_kelas', 'Izin Umum Baru', `Siswa ${namaSiswa} memerlukan persetujuan izin umum.`);

      setShowForm(false);
      // Reset form
      setNomorSurat(`SRMA-U-${Date.now().toString().slice(-6)}`);
      setNamaSiswa('');
      setAlasan('');
      setJumlahHari(1);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat surat izin');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (permitId: string) => {
    const note = catatanKamar[permitId];
    if (!note) {
      alert('Mohon isi catatan kamar terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        catatan_kamar: note,
        status: 'pending_kelas',
        wali_asuh_uid: user.uid,
        nama_wali_asuh: user.name,
      });

      // Notify Wali Kelas
      notifyUserByRole('wali_kelas', 'Persetujuan Izin Dibutuhkan', `Siswa di kelas Anda memerlukan persetujuan izin sakit.`);

      // Clear note for this permit
      const newNotes = { ...catatanKamar };
      delete newNotes[permitId];
      setCatatanKamar(newNotes);
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui status');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPinjamHP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'pinjam_hp'), {
        nama_siswa: phNamaSiswa,
        kelas: phKelas,
        keperluan: phKeperluan,
        tgl_pinjam: Timestamp.now(),
        status: 'dipinjam',
        wali_asuh_name: user.name,
        wali_asuh_uid: user.uid,
      });
      setShowPinjamForm(false);
      setPhNamaSiswa('');
      setPhKeperluan('');
    } catch (err) {
      console.error(err);
      alert('Gagal mencatat peminjaman HP');
    } finally {
      setLoading(false);
    }
  };

  const handleKembalikanHP = async (id: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'pinjam_hp', id), {
        status: 'dikembalikan',
        tgl_kembali: Timestamp.now(),
      });
    } catch (err) {
      console.error(err);
      alert('Gagal mencatat pengembalian HP');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTindakan = async (permitId: string) => {
    if (!newTindakan.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        tindakan: arrayUnion({
          waktu: Timestamp.now(),
          oleh: user.name,
          peran: 'Wali Asuh',
          pesan: newTindakan
        })
      });
      setNewTindakan('');
    } catch (err) {
      console.error(err);
      alert('Gagal menambah tindakan');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeCatatan = async (permitId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'acknowledged',
        wali_asuh_uid: user.uid,
        nama_wali_asuh: user.name,
        tgl_disetujui: Timestamp.now(),
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui catatan');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status === 'pending_asuh').length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length
  };

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  if (activeTab === 'statistik') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Statistik Wali Asuh</h2>
            <p className="text-sm text-slate-500">Data kesehatan siswa asuhan Anda.</p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 text-center py-20">
          <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-slate-900 font-bold text-xl">Statistik Segera Hadir</h3>
          <p className="text-slate-500 mt-2">Fitur analisis mendalam sedang dalam pengembangan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 relative">
      {/* Top Menu Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => { setViewMode('perizinan'); setShowMenu(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-bold transition-colors ${
                    viewMode === 'perizinan' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  Perizinan Siswa
                </button>
                <button
                  onClick={() => { setViewMode('pinjam_hp'); setShowMenu(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-bold transition-colors ${
                    viewMode === 'pinjam_hp' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  Pinjam Handphone
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</p>
            <p className="text-sm font-black text-slate-900">{user.name}</p>
          </div>
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">
            {user.name.charAt(0)}
          </div>
        </div>
      </div>

      {viewMode === 'perizinan' ? (
        <>
          {/* Dashboard Grid - Styled to match banner */}
      <div className="grid grid-cols-2 gap-4">
        {/* Card 1: Total Perizinan */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-4xl font-black">{stats.total}</h3>
              <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Total<br />Perizinan</p>
          </div>
        </div>

        {/* Card 2: Izin Selesai */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-4xl font-black">{stats.selesai}</h3>
              <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Izin<br />Selesai</p>
          </div>
        </div>

        {/* Card 3: Perlu Persetujuan */}
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-400 to-rose-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-4xl font-black">{stats.pending}</h3>
              <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Perlu<br />Persetujuan</p>
          </div>
        </div>

        {/* Card 4: Memorandum */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-amber-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-4xl font-black">{stats.memos}</h3>
              <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                <Mail className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Memo<br />Kepala Sekolah</p>
          </div>
        </div>
      </div>

      {/* Riwayat Terakhir Header */}
      <div className="flex items-center justify-between mt-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Riwayat Perizinan</h2>
        <button 
          onClick={() => {
            setSearchTerm('');
            setStartDate('');
            setEndDate('');
          }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Lihat Semua
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-top-4 duration-300">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa atau nomor surat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
              <Clock className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none"
              />
              <span className="text-slate-300">→</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Form Input Izin Umum / Lainnya
            </h3>
          </div>
          <form onSubmit={handleSubmitUmum} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nomor Surat</label>
                <input
                  type="text"
                  readOnly
                  value={nomorSurat}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Siswa</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={namaSiswa}
                    onChange={(e) => setNamaSiswa(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Masukkan nama siswa"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kelas</label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {WALI_KELAS_LIST.map(wk => (
                      <option key={wk.kelas} value={wk.kelas}>{wk.kelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Wali Kelas</label>
                  <select
                    value={waliKelas}
                    onChange={(e) => setWaliKelas(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {WALI_KELAS_LIST.map(wk => (
                      <option key={wk.name} value={wk.name}>{wk.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alasan Izin</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    required
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px]"
                    placeholder="Contoh: Keperluan keluarga mendesak"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jumlah Hari</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      required
                      value={jumlahHari || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setJumlahHari(isNaN(val) ? 0 : val);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tgl Mulai</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={tglMulai}
                      onChange={(e) => setTglMulai(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan & Kirim ke Wali Kelas'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Memorandum Section */}
      {memos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black">Memorandum dari Kepala Sekolah</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memos.map(memo => (
              <div 
                key={memo.id}
                onClick={() => setSelectedMemo(memo)}
                className="bg-cyan-50 p-4 rounded-3xl border border-cyan-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-cyan-600 transition-colors">{memo.perihal}</h4>
                    <p className="text-[10px] font-bold text-slate-500">{format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <Plus className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List Perizinan - Banner Style */}
      <div className="grid grid-cols-1 gap-3">
        {filteredPermits.map((permit) => (
          <div 
            key={permit.id}
            onClick={() => setSelectedPermit(permit)}
            className="group flex items-center gap-4 p-4 bg-white rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              permit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600' :
              permit.tipe === 'umum' ? 'bg-blue-100 text-blue-600' :
              'bg-purple-100 text-purple-600'
            }`}>
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 truncate">{permit.nama_siswa} ({permit.kelas})</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                {permit.tipe === 'sakit' ? 'Izin Sakit' : permit.tipe === 'umum' ? 'Izin Umum' : 'Catatan'} • {permit.status === 'approved' || permit.status === 'acknowledged' ? 'Izin PDF Dikirim' : 'Menunggu Verifikasi'}
              </p>
              <p className="text-[9px] font-bold text-indigo-500 mt-0.5">
                {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
              </p>
            </div>
            <div className="text-slate-300">
              <Plus className="w-5 h-5 rotate-45" />
            </div>
          </div>
        ))}

        {permits.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-900 font-bold">Tidak Ada Data</h3>
            <p className="text-slate-500 text-sm mt-1">Belum ada perizinan yang dibuat.</p>
          </div>
        )}
      </div>
      </>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Pinjam Handphone</h2>
              <p className="text-sm text-slate-500">Monitoring peminjaman HP siswa asuhan.</p>
            </div>
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <Smartphone className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pinjamHPList.map((item) => (
              <div 
                key={item.id}
                className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    item.status === 'dipinjam' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {item.status === 'dipinjam' ? <Smartphone className="w-6 h-6" /> : <History className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">{item.nama_siswa} ({item.kelas})</h3>
                    <p className="text-xs text-slate-500 font-medium">{item.keperluan}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[10px] font-bold text-indigo-500">
                        Pinjam: {format(item.tgl_pinjam.toDate(), 'dd MMM, HH:mm')}
                      </p>
                      {item.tgl_kembali && (
                        <p className="text-[10px] font-bold text-emerald-500">
                          Kembali: {format(item.tgl_kembali.toDate(), 'dd MMM, HH:mm')}
                        </p>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Oleh: {item.wali_asuh_name}
                    </p>
                  </div>
                </div>
                
                {item.status === 'dipinjam' && (
                  <button
                    onClick={() => handleKembalikanHP(item.id!)}
                    disabled={loading}
                    className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title="Kembalikan HP"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}

            {pinjamHPList.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Belum Ada Data</h3>
                <p className="text-slate-500 text-sm mt-1">Belum ada catatan peminjaman HP.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button 
        onClick={() => viewMode === 'perizinan' ? setShowForm(true) : setShowPinjamForm(true)}
        className="fixed bottom-24 right-6 bg-indigo-950 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-30 hover:scale-105 transition-transform active:scale-95"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-black uppercase tracking-widest">
          {viewMode === 'perizinan' ? 'Buat Izin Baru' : 'Catat Pinjam HP'}
        </span>
      </button>

      {/* Modal Detail Perizinan */}
      {selectedPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Detail Perizinan</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{selectedPermit.nomor_surat}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPermit(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Siswa</label>
                  <p className="font-bold text-slate-900">{currentSelectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-bold text-slate-900">{currentSelectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentSelectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Diagnosa Medis'}</label>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">{currentSelectedPermit.tipe === 'umum' ? currentSelectedPermit.alasan : currentSelectedPermit.diagnosa}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Masa Izin</label>
                  <p className="text-sm font-bold text-slate-900">{currentSelectedPermit.jumlah_hari} Hari</p>
                  <p className="text-[10px] text-slate-500">
                    {currentSelectedPermit.tgl_mulai && typeof currentSelectedPermit.tgl_mulai.toDate === 'function' ? format(currentSelectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {currentSelectedPermit.tgl_selesai && typeof currentSelectedPermit.tgl_selesai.toDate === 'function' ? format(currentSelectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      currentSelectedPermit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      currentSelectedPermit.status === 'pending_kelas' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {currentSelectedPermit.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-semibold text-slate-700">{currentSelectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-semibold text-slate-700">{currentSelectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {currentSelectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <MapPin className="w-4 h-4" />
                    {currentSelectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {currentSelectedPermit.status === 'pending_asuh' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konfirmasi & Catatan Kamar</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={catatanKamar[currentSelectedPermit.id!] || ''}
                      onChange={(e) => setCatatanKamar({ ...catatanKamar, [currentSelectedPermit.id!]: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[80px]"
                      placeholder="Contoh: Kamar 302, Kondisi stabil"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStatus(currentSelectedPermit.id!)}
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Konfirmasi & Kirim ke Wali Kelas
                  </button>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {currentSelectedPermit.tindakan && currentSelectedPermit.tindakan.length > 0 ? (
                    currentSelectedPermit.tindakan.map((t, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase">{t.peran}: {t.oleh}</span>
                          <span className="text-[9px] text-slate-400">{t.waktu && typeof t.waktu.toDate === 'function' ? format(t.waktu.toDate(), 'HH:mm, dd MMM') : '-'}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{t.pesan}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Belum ada catatan tindakan</p>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Tambah catatan tindakan..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    onClick={() => handleAddTindakan(currentSelectedPermit.id!)}
                    disabled={loading || !newTindakan.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              {currentSelectedPermit.status === 'approved' && (
                <button
                  onClick={() => {
                    handleGeneratePDF(currentSelectedPermit);
                    setSelectedPermit(null);
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Memo */}
      {selectedMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Memorandum Intern</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{selectedMemo.nomor_memo}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMemo(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari</label>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> {selectedMemo.pengirim_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal</label>
                  <p className="font-bold text-slate-900">
                    {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perihal</label>
                <p className="text-lg font-black text-slate-900 leading-tight">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedMemo.isi}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedMemo(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generateMemorandumPDF(selectedMemo);
                  setSelectedMemo(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Pinjam HP */}
      {showPinjamForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Catat Pinjam HP</h3>
              </div>
              <button onClick={() => setShowPinjamForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPinjamHP} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Siswa</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={phNamaSiswa}
                    onChange={(e) => setPhNamaSiswa(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Nama lengkap siswa"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kelas</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={phKelas}
                    onChange={(e) => setPhKelas(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                  >
                    {['X-1', 'X-2', 'X-3', 'X-4'].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keperluan Pinjam</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-4 w-4 h-4 text-slate-400" />
                  <textarea
                    required
                    value={phKeperluan}
                    onChange={(e) => setPhKeperluan(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
                    placeholder="Contoh: Menghubungi orang tua"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Catatan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
