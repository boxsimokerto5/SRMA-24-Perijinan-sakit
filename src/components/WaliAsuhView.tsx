import React, { useState } from 'react';
import { Home, MessageSquare, Send, Clock, User, Printer, Loader2, CheckCircle2, Calendar, Plus, MapPin, ClipboardList, Activity, FileText, Mail, ShieldCheck, BarChart3, Search, Menu, Smartphone, History, Check, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, LogTindakan, Memorandum, PinjamHP, Siswa } from '../types';
import { notifyUserByRole } from '../services/fcmService';
import { format, addDays } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import { Contact, GraduationCap, IdCard, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  const [viewMode, setViewMode] = useState<'perizinan' | 'pinjam_hp' | 'kartu_siswa'>('perizinan');
  const [showMenu, setShowMenu] = useState(false);
  const [pinjamHPList, setPinjamHPList] = useState<PinjamHP[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [showPinjamForm, setShowPinjamForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  
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

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.nama_lengkap.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                         s.nik.includes(studentSearchTerm);
    const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).sort()];

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

  React.useEffect(() => {
    const q = query(collection(db, 'siswa'), orderBy('nama_lengkap', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
      setStudents(data);
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
    <div className="space-y-8 pb-24 animate-in fade-in duration-700 relative">
      {/* Welcome Section */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Halo, {user.name.split(' ')[0]}!</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Wali Asuh Terverifikasi</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/60 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-4 z-50 overflow-hidden"
                >
                  <div className="px-6 py-2 mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menu Navigasi</p>
                  </div>
                  <button
                    onClick={() => { setViewMode('perizinan'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'perizinan' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'perizinan' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    Perizinan Siswa
                  </button>
                  <button
                    onClick={() => { setViewMode('pinjam_hp'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'pinjam_hp' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'pinjam_hp' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <Smartphone className="w-4 h-4" />
                    </div>
                    Pinjam Handphone
                  </button>
                  <button
                    onClick={() => { setViewMode('kartu_siswa'); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === 'kartu_siswa' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === 'kartu_siswa' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <IdCard className="w-4 h-4" />
                    </div>
                    Kartu Siswa
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {viewMode === 'perizinan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Dashboard Grid - Modern Bento Style */}
          <div className="grid grid-cols-2 gap-4">
            {/* Card 1: Total Perizinan */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 group transition-all"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-indigo-600 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-indigo-100 mb-4">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-display">{stats.total}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Izin</p>
              </div>
            </motion.div>

            {/* Card 2: Izin Selesai */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 group transition-all"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-emerald-500 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-emerald-100 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-display">{stats.selesai}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Selesai</p>
              </div>
            </motion.div>

            {/* Card 3: Perlu Persetujuan */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 group transition-all"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-rose-500 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-rose-100 mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-display">{stats.pending}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pending</p>
              </div>
            </motion.div>

            {/* Card 4: Memorandum */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/60 group transition-all"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-amber-500 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-amber-100 mb-4">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-display">{stats.memos}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Memo</p>
              </div>
            </motion.div>
          </div>

          {/* Riwayat Terakhir Header */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Riwayat Perizinan</h2>
            <button 
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Reset Filter
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
              <motion.div 
                key={permit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
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
                  <h3 className="font-black text-slate-900 truncate font-display">{permit.nama_siswa} ({permit.kelas})</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    {permit.tipe === 'sakit' ? 'Izin Sakit' : permit.tipe === 'umum' ? 'Izin Umum' : 'Catatan'} • {permit.status === 'approved' || permit.status === 'acknowledged' ? 'Izin PDF Dikirim' : 'Menunggu Verifikasi'}
                  </p>
                  <p className="text-[9px] font-bold text-indigo-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                  </p>
                </div>
                <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}

            {permits.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Tidak Ada Data</h3>
                <p className="text-slate-500 text-sm mt-1">Belum ada perizinan yang dibuat.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'pinjam_hp' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Pinjam Handphone</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Monitoring Penggunaan Gadget</p>
            </div>
            <button 
              onClick={() => setShowPinjamForm(true)}
              className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pinjamHPList.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${item.status === 'dipinjam' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 font-display">{item.nama_siswa}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas {item.kelas}</p>
                    </div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    item.status === 'dipinjam' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Keperluan</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{item.keperluan}</p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {item.tgl_pinjam && typeof item.tgl_pinjam.toDate === 'function' ? format(item.tgl_pinjam.toDate(), 'dd MMM, HH:mm') : '-'}
                  </div>
                  {item.status === 'dipinjam' ? (
                    <button
                      onClick={() => handleKembalikanHP(item.id!)}
                      className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all active:scale-95"
                    >
                      Kembalikan
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Kembali: {item.tgl_kembali && typeof item.tgl_kembali.toDate === 'function' ? format(item.tgl_kembali.toDate(), 'HH:mm') : '-'}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {pinjamHPList.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada catatan peminjaman</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'kartu_siswa' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-6">
            <div className="px-1">
              <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Kartu Siswa</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Data Lengkap Siswa Asuhan</p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIK siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      selectedClass === c
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStudents.map((student) => (
                <motion.div
                  key={student.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedStudent(student)}
                  className="bg-white p-5 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex items-center gap-5 group cursor-pointer hover:border-indigo-200 transition-all"
                >
                  <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                    {student.nama_lengkap.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-900 truncate font-display">{student.nama_lengkap}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-md uppercase tracking-widest">
                        Kelas {student.kelas}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {student.nik}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.div>
              ))}
              
              {filteredStudents.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Siswa tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      {viewMode !== 'kartu_siswa' && (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => viewMode === 'perizinan' ? setShowForm(true) : setShowPinjamForm(true)}
          className="fixed bottom-24 right-6 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-30"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">
            {viewMode === 'perizinan' ? 'Buat Izin Baru' : 'Catat Pinjam HP'}
          </span>
        </motion.button>
      )}

      {/* Modal Detail Perizinan */}
      {selectedPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Perizinan</h3>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Siswa</label>
                  <p className="font-black text-slate-900 font-display">{currentSelectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900 font-display">{currentSelectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentSelectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Diagnosa Medis'}</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{currentSelectedPermit.tipe === 'umum' ? currentSelectedPermit.alasan : currentSelectedPermit.diagnosa}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Izin</label>
                  <p className="text-sm font-black text-slate-900 font-display">{currentSelectedPermit.jumlah_hari} Hari</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {currentSelectedPermit.tgl_mulai && typeof currentSelectedPermit.tgl_mulai.toDate === 'function' ? format(currentSelectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {currentSelectedPermit.tgl_selesai && typeof currentSelectedPermit.tgl_selesai.toDate === 'function' ? format(currentSelectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      currentSelectedPermit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      currentSelectedPermit.status === 'pending_kelas' ? 'bg-amber-100 text-amber-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {currentSelectedPermit.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-bold text-slate-700">{currentSelectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-bold text-slate-700">{currentSelectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {currentSelectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-black">
                    <MapPin className="w-4 h-4" />
                    {currentSelectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {currentSelectedPermit.status === 'pending_asuh' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Konfirmasi & Catatan Kamar</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={catatanKamar[currentSelectedPermit.id!] || ''}
                      onChange={(e) => setCatatanKamar({ ...catatanKamar, [currentSelectedPermit.id!]: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[80px] font-medium"
                      placeholder="Contoh: Kamar 302, Kondisi stabil"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStatus(currentSelectedPermit.id!)}
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Konfirmasi & Kirim ke Wali Kelas
                  </button>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {currentSelectedPermit.tindakan && currentSelectedPermit.tindakan.length > 0 ? (
                    currentSelectedPermit.tindakan.map((t, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{t.peran}: {t.oleh}</span>
                          <span className="text-[9px] font-bold text-slate-400">{t.waktu && typeof t.waktu.toDate === 'function' ? format(t.waktu.toDate(), 'HH:mm, dd MMM') : '-'}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{t.pesan}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada catatan tindakan</p>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Tambah catatan tindakan..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                  <button
                    onClick={() => handleAddTindakan(currentSelectedPermit.id!)}
                    disabled={loading || !newTindakan.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              {currentSelectedPermit.status === 'approved' && (
                <button
                  onClick={() => {
                    handleGeneratePDF(currentSelectedPermit);
                    setSelectedPermit(null);
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
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
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Memorandum Intern</h3>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari</label>
                  <p className="font-black text-slate-900 flex items-center gap-1.5 font-display">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> {selectedMemo.pengirim_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                  <p className="font-black text-slate-900 font-display">
                    {selectedMemo.tgl_memo && typeof selectedMemo.tgl_memo.toDate === 'function' ? format(selectedMemo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal</label>
                <p className="text-xl font-black text-slate-900 leading-tight font-display">{selectedMemo.perihal}</p>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pesan</label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{selectedMemo.isi}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedMemo(null)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generateMemorandumPDF(selectedMemo);
                  setSelectedMemo(null);
                }}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
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

      {/* Modal Detail Siswa */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <IdCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Data Siswa</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">NIK: {selectedStudent.nik}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100 mb-4">
                  <User className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-black text-slate-900 text-center">{selectedStudent.nama_lengkap}</h2>
                <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-1">Kelas {selectedStudent.kelas}</p>
              </div>

              {/* Section: Data Pribadi */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600">
                  <User className="w-4 h-4" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Data Pribadi</h4>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 grid grid-cols-2 gap-y-4 gap-x-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">NIK</label>
                    <p className="text-sm font-bold text-slate-900 font-mono">{selectedStudent.nik}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nomor KK</label>
                    <p className="text-sm font-bold text-slate-900 font-mono">{selectedStudent.nomor_kk}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tempat Lahir</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.tempat_lahir}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Lahir</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.tanggal_lahir}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Jenis Kelamin</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.jenis_kelamin}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agama</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.agama}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Umur</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.umur} Tahun</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Anak Ke / Saudara</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.anak_ke || '-'} dari {selectedStudent.saudara || '-'} Bersaudara</p>
                  </div>
                </div>
              </div>

              {/* Section: Data Orang Tua */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <Contact className="w-4 h-4" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Data Orang Tua</h4>
                </div>
                <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Nama Ayah</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.ayah || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Nama Ibu</label>
                    <p className="text-sm font-bold text-slate-900">{selectedStudent.ibu || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Section: Alamat Lengkap */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <MapPin className="w-4 h-4" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Alamat Lengkap</h4>
                </div>
                <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Alamat</label>
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {selectedStudent.alamat || '-'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">RT / RW</label>
                      <p className="text-sm font-bold text-slate-900">{selectedStudent.rt || '00'} / {selectedStudent.rw || '00'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Kelurahan</label>
                      <p className="text-sm font-bold text-slate-900">{selectedStudent.kelurahan || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Kecamatan</label>
                      <p className="text-sm font-bold text-slate-900">{selectedStudent.kecamatan || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest">Status Keaktifan</h4>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-sm font-bold">Siswa Aktif Terdaftar</span>
                  </div>
                  <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest">
                    Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-sm"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
