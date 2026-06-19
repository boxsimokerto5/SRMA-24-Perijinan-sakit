import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Clock, 
  User, 
  Trash2, 
  Share2, 
  MapPin, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  PlusCircle, 
  MinusCircle, 
  ChevronRight,
  Info,
  Loader2,
  BookOpen
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  addDoc, 
  deleteDoc, 
  Timestamp, 
  serverTimestamp 
} from 'firebase/firestore';
import { AppUser, Siswa, SerahTerima, StudentSakit } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SerahTerimaViewProps {
  user: AppUser;
}

export default function SerahTerimaView({ user }: SerahTerimaViewProps) {
  const [logs, setLogs] = useState<SerahTerima[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [hariTanggal, setHariTanggal] = useState('');
  const [waktuSerahTerima, setWaktuSerahTerima] = useState('');
  const [rawDate, setRawDate] = useState('');
  const [rawTime, setRawTime] = useState('');
  const [lokasi, setLokasi] = useState('Asrama SRMA 24 KEDIRI');
  const [totalSiswaHadir, setTotalSiswaHadir] = useState<number>(98);
  const [siswaSakit, setSiswaSakit] = useState<StudentSakit[]>([]);
  const [kondisiUmum, setKondisiUmum] = useState('✓ Baik');
  const [kegiatanDilaksanakan, setKegiatanDilaksanakan] = useState<string[]>([
    'Pembelajaran/pembinaan kemandirian siswa (laundry time, bersih diri)',
    'Sholat berjamaah',
    'Makan bersama',
    'Persiapan open house',
    'Evaluasi'
  ]);

  // Category & Follow-up comments
  const [kategori, setKategori] = useState<'wali_asrama' | 'wali_asuh'>('wali_asrama');
  const [catatanTindakLanjut, setCatatanTindakLanjut] = useState<string[]>([
    'Tolong Perhatikan pemberian makanan 2 anak diatas',
    'Tolong dampingi anak ujian dilantai 2',
    'Tolong antar andika ke puskesmas'
  ]);

  // Temporary item inputs
  const [newSakitNama, setNewSakitNama] = useState('');
  const [newSakitKeluhan, setNewSakitKeluhan] = useState('');
  const [newKegiatan, setNewKegiatan] = useState('');
  const [newCatatan, setNewCatatan] = useState('');

  // Autocomplete support
  const [studentSearch, setStudentSearch] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<Siswa[]>([]);

  const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const indonesianMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getIndonesianFormattedDate = (date: Date) => {
    const dayName = indonesianDays[date.getDay()];
    const dayNum = date.getDate();
    const monthName = indonesianMonths[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  };

  // Pre-fill form values on modal open
  const initForm = () => {
    const now = new Date();
    setHariTanggal(getIndonesianFormattedDate(now));
    
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    setRawDate(`${year}-${month}-${day}`);
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setWaktuSerahTerima(`${hours}.${minutes} WIB`);
    setRawTime(`${hours}:${minutes}`);
    
    setLokasi('Asrama SRMA 24 KEDIRI');
    setTotalSiswaHadir(98);
    setSiswaSakit([]);
    setKondisiUmum('✓ Baik');
    setKegiatanDilaksanakan([
      'Pembelajaran/pembinaan kemandirian siswa (laundry time, bersih diri)',
      'Sholat berjamaah',
      'Makan bersama',
      'Persiapan open house',
      'Evaluasi'
    ]);
    setKategori('wali_asrama');
    setCatatanTindakLanjut([
      'Tolong Perhatikan pemberian makanan 2 anak diatas',
      'Tolong dampingi anak ujian dilantai 2',
      'Tolong antar andika ke puskesmas'
    ]);
    setNewSakitNama('');
    setNewSakitKeluhan('');
    setNewKegiatan('');
    setNewCatatan('');
    setStudentSearch('');
  };

  // Systems style Date setters
  const handleSetToday = () => {
    const now = new Date();
    setHariTanggal(getIndonesianFormattedDate(now));
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    setRawDate(`${year}-${month}-${day}`);
  };

  const handleSetYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setHariTanggal(getIndonesianFormattedDate(yesterday));
    const year = yesterday.getFullYear();
    const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
    const day = yesterday.getDate().toString().padStart(2, '0');
    setRawDate(`${year}-${month}-${day}`);
  };

  const handleRawDateChange = (val: string) => {
    setRawDate(val);
    if (!val) return;
    const dateObj = new Date(val);
    if (!isNaN(dateObj.getTime())) {
      setHariTanggal(getIndonesianFormattedDate(dateObj));
    }
  };

  // Systems style Time setters
  const handleSetNowTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setWaktuSerahTerima(`${hours}.${minutes} WIB`);
    setRawTime(`${hours}:${minutes}`);
  };

  const handleRawTimeChange = (val: string) => {
    setRawTime(val);
    if (!val) return;
    const [hours, minutes] = val.split(':');
    setWaktuSerahTerima(`${hours}.${minutes} WIB`);
  };

  const handlePredefinedTime = (timeStr: string) => {
    setRawTime(timeStr);
    const [hours, minutes] = timeStr.split(':');
    setWaktuSerahTerima(`${hours}.${minutes} WIB`);
  };

  // Listen to handover logs from Firestore
  useEffect(() => {
    const q = query(collection(db, 'serah_terima'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SerahTerima));
      setLogs(data);
      setLogsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'serah_terima');
      setLogsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to students list
  useEffect(() => {
    const q = query(collection(db, 'siswa'), orderBy('nama_lengkap', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
      setStudents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'siswa');
    });
    return () => unsubscribe();
  }, []);

  // Filter student candidates based on typing search
  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents([]);
      return;
    }
    const filtered = students.filter(s => 
      s.nama_lengkap.toLowerCase().includes(studentSearch.toLowerCase())
    ).slice(0, 5);
    setFilteredStudents(filtered);
  }, [studentSearch, students]);

  const handleAddSakit = () => {
    const nama = newSakitNama.trim() || studentSearch.trim();
    if (!nama) return;
    
    const newSakit: StudentSakit = {
      nama_siswa: nama,
      keluhan: newSakitKeluhan.trim() || 'kurang sehat'
    };

    setSiswaSakit([...siswaSakit, newSakit]);
    setNewSakitNama('');
    setNewSakitKeluhan('');
    setStudentSearch('');
    
    // Automatically set Kondisi Umum if there are sick students
    setKondisiUmum('Sebagian siswa kurang sehat');
  };

  const handleRemoveSakit = (index: number) => {
    const updated = [...siswaSakit];
    updated.splice(index, 1);
    setSiswaSakit(updated);
    if (updated.length === 0) {
      setKondisiUmum('✓ Baik');
    }
  };

  const handleAddKegiatan = () => {
    if (!newKegiatan.trim()) return;
    setKegiatanDilaksanakan([...kegiatanDilaksanakan, newKegiatan.trim()]);
    setNewKegiatan('');
  };

  const handleRemoveKegiatan = (index: number) => {
    const updated = [...kegiatanDilaksanakan];
    updated.splice(index, 1);
    setKegiatanDilaksanakan(updated);
  };

  const handleAddCatatan = () => {
    if (!newCatatan.trim()) return;
    setCatatanTindakLanjut([...catatanTindakLanjut, newCatatan.trim()]);
    setNewCatatan('');
  };

  const handleRemoveCatatan = (index: number) => {
    const updated = [...catatanTindakLanjut];
    updated.splice(index, 1);
    setCatatanTindakLanjut(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hariTanggal || !waktuSerahTerima) {
      alert('Mohon lengkapi hari/tanggal dan waktu serah terima.');
      return;
    }

    setLoading(true);
    try {
      const data: Omit<SerahTerima, 'id'> = {
        hari_tanggal: hariTanggal,
        waktu_serah_terima: waktuSerahTerima,
        lokasi,
        total_siswa_hadir: Number(totalSiswaHadir) || 0,
        siswa_sakit: siswaSakit,
        kondisi_umum: kondisiUmum,
        kegiatan_dilaksanakan: kegiatanDilaksanakan,
        kategori,
        catatan_tindak_lanjut: kategori === 'wali_asuh' ? catatanTindakLanjut : [],
        author_name: user.name || user.email,
        author_uid: user.uid,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'serah_terima'), data);
      setShowModal(false);

      // Instantly offer to share to WhatsApp
      const savedDoc: SerahTerima = { id: docRef.id, ...data };
      setTimeout(() => {
        if (window.confirm('Laporan serah terima berhasil disimpan! Apakah Anda ingin membagikannya langsung ke WhatsApp?')) {
          handleShareWA(savedDoc);
        }
      }, 300);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan laporan serah terima.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus arsip serah terima ini?')) return;
    try {
      await deleteDoc(doc(db, 'serah_terima', id));
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus laporan.');
    }
  };

  const getWhatsAppShareText = (log: SerahTerima) => {
    if (log.kategori === 'wali_asuh') {
      const listSakitString = log.siswa_sakit.length > 0 
        ? log.siswa_sakit.map((s, idx) => `${idx + 1}. ${s.nama_siswa}${s.keluhan ? ` (${s.keluhan})` : ''}`).join('\n')
        : '-';

      const catatanString = log.catatan_tindak_lanjut && log.catatan_tindak_lanjut.length > 0
        ? log.catatan_tindak_lanjut.map((c, idx) => `${idx + 1}. ${c}`).join('\n')
        : '-';

      return `Assalamualaikum wr wb.
Bapak ibu Wali Asuh izin melaporkan.
Wali Asuh → Wali Asuh

Hari/Tanggal : ${log.hari_tanggal}
Waktu Serah Terima : ${log.waktu_serah_terima} 
Lokasi : ${log.lokasi}

Kondisi Umum Siswa
Jumlah siswa hadir : ${log.total_siswa_hadir} orang

Siswa sakit :

${listSakitString}

Kondisi umum siswa :
${log.kondisi_umum}

Catatan untuk ditindak lanjuti :

${catatanString}

Demikian Terimakasih 🙏

Pesan ini dibuat oleh sistem SRMA 24 Kediri`;
    } else {
      const listSakitString = log.siswa_sakit.length > 0 
        ? `Jumlah siswa izin/sakit : ${log.siswa_sakit.length} orang\nAtas nama\n` + 
          log.siswa_sakit.map((s, idx) => `${idx + 1}. ${s.nama_siswa}${s.keluhan && s.keluhan !== 'kurang sehat' && s.keluhan !== '✓ Baik' && s.keluhan !== 'Baik' ? ` (${s.keluhan})` : ''}`).join('\n')
        : 'Jumlah siswa izin/sakit : -';

      const listKegiatanString = log.kegiatan_dilaksanakan.length > 0
        ? log.kegiatan_dilaksanakan.map((k, idx) => `${idx + 1}. ${k}`).join('\n')
        : '-';

      let kondisiUmumFormatted = log.kondisi_umum;
      if (!kondisiUmumFormatted.startsWith('✓')) {
        kondisiUmumFormatted = `✓ ${kondisiUmumFormatted}`;
      }

      return `Assalamualaikum wr wb.
Bapak ibu Wali Asrama izin melaporkan
Wali Asuh → Wali Asrama

Hari/Tanggal : ${log.hari_tanggal}
Waktu Serah Terima : ${log.waktu_serah_terima} 
Lokasi : ${log.lokasi}

Kondisi Umum Siswa
Jumlah siswa hadir : ${log.total_siswa_hadir} orang

${listSakitString}

Kondisi umum siswa :
${kondisiUmumFormatted}

Kegiatan yang Telah Dilaksanakan
${listKegiatanString}

Demikian Terimakasih 🙏

Pesan ini dibuat oleh sistem SRMA 24 Kediri`;
    }
  };

  const handleShareWA = (log: SerahTerima) => {
    const text = getWhatsAppShareText(log);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredLogs = logs.filter(log => 
    log.hari_tanggal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.kondisi_umum.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.author_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Banner / Header Brown Theme */}
      <div className="relative bg-[#3e2723] rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-white overflow-hidden shadow-xl border-b-4 border-amber-950 flex flex-col justify-between min-h-[220px] transition-all">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_0)] bg-[size:16px_16px]" />
        </div>
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-full text-xs font-bold uppercase tracking-wider text-amber-400">
              <ClipboardCheck size={12} />
              Serah Terima Harian
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tight uppercase leading-none font-display">
              Serah Terima <span className="text-amber-400">Harian</span>
            </h1>
            <p className="text-sm font-medium text-amber-100/70 max-w-xl italic">
              Kelola dokumen serah terima siswa harian antar petugas asrama (Wali Asuh ke Wali Asrama, atau sesama Wali Asuh), serta kirim rangkuman laporan langsung ke WhatsApp grup.
            </p>
          </div>

          <button
            onClick={() => {
              initForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-[1.5rem] text-sm font-black italic uppercase tracking-wider shadow-lg shadow-amber-950/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus size={16} strokeWidth={3} />
            Buat Serah Terima
          </button>
        </div>
      </div>

      {/* Control Actions / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari berdasarkan tanggal, kondisi, atau nama asuh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[1.25rem] text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/15 transition-all shadow-sm"
          />
        </div>
        <div className="text-xs font-mono text-slate-400 italic">
          Menampilkan {filteredLogs.length} Arsip Serah Terima
        </div>
      </div>

      {/* Content Section */}
      {logsLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#3e2723] mb-4" />
          <p className="text-sm font-bold text-slate-500 italic">Memuat arsip serah terima...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center py-20">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-800 italic uppercase tracking-wide">Belum Ada Serah Terima</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md italic">
            {searchTerm ? 'Tidak ada hasil yang sesuai dengan kueri pencarian.' : 'Silakan klik tombol "Buat Serah Terima" di atas untuk mencatat jurnal serah terima yang baru.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Header Card */}
                <div className="p-6 bg-[#fbf9f6] border-b border-dashed border-slate-100 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 text-left">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-xs font-mono font-bold bg-[#3e2723]/5 text-[#3e2723] px-3 py-1 rounded-full uppercase">
                          {log.waktu_serah_terima}
                        </span>
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          log.kategori === 'wali_asuh'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200/40'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200/40'
                        }`}>
                          {log.kategori === 'wali_asuh' ? 'Wali Asuh → Wali Asuh' : 'Wali Asuh → Wali Asrama'}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-[#3e2723] italic leading-tight uppercase mt-2">
                        {log.hari_tanggal}
                      </h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                        <MapPin size={12} className="text-slate-500" />
                        {log.lokasi}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleShareWA(log)}
                        title="Kirim ke WhatsApp"
                        className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-emerald-100 flex items-center justify-center shadow-sm"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" stroke="none">
                          <path d="M12 .002c-6.627 0-12 5.373-12 12 0 2.159.57 4.187 1.564 5.947l-1.564 5.717 5.86-1.53c1.7.94 3.642 1.47 5.704 1.47 6.628 0 12-5.373 12-12s-5.372-12-12-12zm6.209 15.885c-.269.756-1.566 1.429-2.158 1.517-.514.077-1.18.14-1.91-.093-.456-.146-1.022-.357-1.748-.673-3.155-1.373-5.184-4.57-5.342-4.783-.158-.211-1.282-1.713-1.282-3.267v-.002c0-1.42.716-2.146 1.001-2.438.257-.263.666-.392 1.077-.392.128 0 .245.006.35.011.309.011.52.023.743.514.28.618.96 2.339 1.042 2.51.082.17.135.369.023.597-.101.21-.164.339-.328.531-.164.193-.344.433-.491.58-.164.163-.334.34-.143.668.191.319.851 1.4 1.821 2.261.97.861 2.459 1.488 2.822 1.637.363.15.576.126.791-.122s.918-1.071 1.164-1.439c.246-.368.497-.305.828-.182.332.123 2.102 1.05 2.438 1.218.336.168.56.249.643.393.082.144.082.833-.188 1.589z" />
                        </svg>
                      </button>

                      {log.author_uid === user.uid && (
                        <button
                          onClick={() => log.id && handleDelete(log.id)}
                          title="Hapus Arsip"
                          className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-100 flex items-center justify-center shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users size={16} />
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Hadir</span>
                        <strong className="text-sm font-black text-slate-800 leading-tight">{log.total_siswa_hadir} Siswa</strong>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${log.siswa_sakit.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {log.siswa_sakit.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Sakit</span>
                        <strong className="text-sm font-black text-slate-800 leading-tight">
                          {log.siswa_sakit.length} Siswa
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    {/* Kondisi Umum */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">Kondisi Umum</span>
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 italic bg-[#fbf9f6] px-3 py-2 rounded-xl border border-slate-100">
                        {log.kondisi_umum}
                      </p>
                    </div>

                    {/* Siswa Sakit */}
                    {log.siswa_sakit.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">Siswa Kurang Sehat</span>
                        <ul className="space-y-1 pl-1">
                          {log.siswa_sakit.map((s, idx) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-1 font-medium">
                              <span className="font-bold text-amber-600 shrink-0">{idx + 1}.</span>
                              <span className="italic">
                                <strong className="text-slate-800 not-italic">{s.nama_siswa}</strong> ({s.keluhan})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Kegiatan / Catatan Tindak Lanjut conditionally displayed */}
                    {log.kategori === 'wali_asuh' ? (
                      log.catatan_tindak_lanjut && log.catatan_tindak_lanjut.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">Catatan untuk Ditindaklanjuti</span>
                          <ul className="space-y-1 pl-1">
                            {log.catatan_tindak_lanjut.map((c, idx) => (
                              <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5 font-medium leading-relaxed">
                                <span className="w-4 h-4 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    ) : (
                      log.kegiatan_dilaksanakan && log.kegiatan_dilaksanakan.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">Kegiatan yang Telah Dilaksanakan</span>
                          <ul className="space-y-1 pl-1">
                            {log.kegiatan_dilaksanakan.map((k, idx) => (
                              <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5 font-medium leading-relaxed">
                                <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{k}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}
                  </div>

                  {/* Author Footer */}
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between font-mono italic">
                    <span className="flex items-center gap-1.5">
                      <User size={12} className="text-[#3e2723]" />
                      Oleh: {log.author_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {log.createdAt instanceof Timestamp ? log.createdAt.toDate().toLocaleDateString('id-ID') : 'baru'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal Input Form (SRMA Brown Aesthetics) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3e2723]/75 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(62,39,35,0.35)] overflow-hidden flex flex-col max-h-[90vh] border-b-8 border-[#5d4037] text-left"
            >
              {/* Modal Header */}
              <div className="p-6 bg-[#3e2723] text-white flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase leading-none">Buat Serah Terima</h3>
                    <p className="text-xs text-amber-100/60 mt-1 italic font-medium">Lengkapi rekam aktivitas dan kesehatan asrama</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 px-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-2xl text-white text-xs font-black transition-all italic leading-relaxed"
                >
                  BATAL
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar bg-[#fcfbfa]">
                {/* Kategori Serah Terima */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase block">
                    Kategori Serah Terima
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setKategori('wali_asrama')}
                      className={`py-3 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                        kategori === 'wali_asrama'
                          ? 'bg-[#3e2723] text-white border-[#3e2723] shadow-md shadow-[#3e2723]/10 scale-[1.01]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Wali Asuh → Wali Asrama
                    </button>
                    <button
                      type="button"
                      onClick={() => setKategori('wali_asuh')}
                      className={`py-3 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                        kategori === 'wali_asuh'
                          ? 'bg-[#3e2723] text-white border-[#3e2723] shadow-md shadow-[#3e2723]/10 scale-[1.01]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Wali Asuh → Wali Asuh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hari & Tanggal */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase flex items-center gap-1.5">
                      <Calendar size={12} className="text-amber-600" />
                      Hari / Tanggal (Sistem)
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={hariTanggal}
                        onChange={(e) => setHariTanggal(e.target.value)}
                        placeholder="e.g. Kamis, 28 Mei 2026"
                        className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/10 font-bold text-slate-800 transition-all shadow-sm"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        {/* Hidden Native Date Input triggered by clickable icon container */}
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer transition-all">
                          <Calendar size={14} />
                          <input
                            type="date"
                            value={rawDate}
                            onChange={(e) => handleRawDateChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Fast Click Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={handleSetToday}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-[#3e2723] rounded-lg text-[10px] font-black italic uppercase tracking-wider border border-amber-200/35 flex items-center gap-1 transition-all"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={handleSetYesterday}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black italic uppercase tracking-wider border border-slate-200/35 flex items-center gap-1 transition-all"
                      >
                        ⏳ Kemarin
                      </button>
                    </div>
                  </div>

                  {/* Waktu Serah Terima */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-600" />
                      Waktu Serah Terima
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={waktuSerahTerima}
                        onChange={(e) => setWaktuSerahTerima(e.target.value)}
                        placeholder="e.g. 22.05 WIB"
                        className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/10 font-bold text-slate-800 transition-all shadow-sm"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer transition-all">
                          <Clock size={14} />
                          <input
                            type="time"
                            value={rawTime}
                            onChange={(e) => handleRawTimeChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Fast Presets */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={handleSetNowTime}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-[#3e2723] rounded-lg text-[10px] font-black italic uppercase tracking-wider border border-amber-200/40 flex items-center gap-1 transition-all"
                      >
                        ⏱️ Sekarang
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredefinedTime('07:00')}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200/20 transition-all"
                      >
                        🌅 07.00
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredefinedTime('13:00')}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200/20 transition-all"
                      >
                        ☀️ 13.00
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredefinedTime('17:00')}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200/20 transition-all"
                      >
                        🌇 17.00
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredefinedTime('21:00')}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200/20 transition-all"
                      >
                        🌙 21.00
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredefinedTime('22:05')}
                        className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-500/20 transition-all"
                        title="Jam sesuai contoh template laporan"
                      >
                        🌌 22.05
                      </button>
                    </div>
                  </div>

                  {/* Lokasi */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase block">
                      Lokasi Handoff
                    </label>
                    <input
                      type="text"
                      value={lokasi}
                      onChange={(e) => setLokasi(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/10 font-bold text-slate-800"
                      required
                    />
                  </div>

                  {/* Jumlah siswa hadir */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase block">
                      Jumlah Siswa Hadir
                    </label>
                    <input
                      type="number"
                      value={totalSiswaHadir}
                      onChange={(e) => setTotalSiswaHadir(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/10 font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Siswa Sakit Section */}
                <div className="space-y-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 italic">
                      Daftar Siswa Sakit / Kurang Sehat
                    </h4>
                  </div>

                  {/* List of currently added sick students */}
                  {siswaSakit.length > 0 ? (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                      {siswaSakit.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="italic text-slate-700 font-medium">
                            {idx + 1}. <strong className="text-slate-800 not-italic">{s.nama_siswa}</strong> ({s.keluhan})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSakit(idx)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-all"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Semua siswa sehat (tidak ada catatan siswa sakit)</p>
                  )}

                  {/* Input form to add a sick student */}
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-2 relative">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ketik nama siswa..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#3e2723] focus:ring-1 focus:ring-[#3e2723]/10"
                        />
                        {/* Autocomplete display */}
                        {filteredStudents.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-[150px] overflow-y-auto">
                            {filteredStudents.map((std) => (
                              <button
                                key={std.id}
                                type="button"
                                onClick={() => {
                                  setStudentSearch(std.nama_lengkap);
                                  setNewSakitNama(std.nama_lengkap);
                                  setFilteredStudents([]);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors block border-b border-slate-100 last:border-none font-medium truncate"
                              >
                                {std.nama_lengkap} (Kelas {std.kelas})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Keluhan (misal: sakit gigi, demam...)"
                        value={newSakitKeluhan}
                        onChange={(e) => setNewSakitKeluhan(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#3e2723] focus:ring-1 focus:ring-[#3e2723]/10"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSakit}
                      className="w-full sm:w-auto self-end flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black italic uppercase tracking-wider text-[10px] rounded-xl shadow-sm transition-all"
                    >
                      <PlusCircle size={12} />
                      Tambah Siswa Sakit
                    </button>
                  </div>
                </div>

                {/* Kondisi Umum */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest text-[#3e2723] uppercase block">
                    Kondisi Umum Siswa (Kesimpulan)
                  </label>
                  <input
                    type="text"
                    value={kondisiUmum}
                    onChange={(e) => setKondisiUmum(e.target.value)}
                    placeholder="e.g. ✓ Sehat"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#3e2723] focus:ring-2 focus:ring-[#3e2723]/10 font-bold text-slate-800"
                    required
                  />
                </div>

                {/* Kegiatan / Catatan Tindak Lanjut conditionally rendered */}
                {kategori === 'wali_asrama' ? (
                  <div className="space-y-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 italic">
                        Kegiatan yang Telah Dilaksanakan
                      </h4>
                    </div>

                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                      {kegiatanDilaksanakan.map((k, idx) => (
                        <div key={idx} className="flex items-start gap-2 justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-medium text-slate-700 text-left">
                            {idx + 1}. {k}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKegiatan(idx)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-all shrink-0"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Masukkan aktivitas/kegiatan baru..."
                        value={newKegiatan}
                        onChange={(e) => setNewKegiatan(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKegiatan())}
                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#3e2723] focus:ring-1 focus:ring-[#3e2723]/10"
                      />
                      <button
                        type="button"
                        onClick={handleAddKegiatan}
                        className="p-2.5 bg-[#3e2723] text-white hover:bg-opacity-90 active:bg-opacity-100 rounded-xl transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 italic">
                        Catatan untuk Ditindaklanjuti
                      </h4>
                    </div>

                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                      {catatanTindakLanjut.map((c, idx) => (
                        <div key={idx} className="flex items-start gap-2 justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-medium text-slate-700 text-left">
                            {idx + 1}. {c}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCatatan(idx)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-all shrink-0"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Masukkan catatan tindak lanjut..."
                        value={newCatatan}
                        onChange={(e) => setNewCatatan(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCatatan())}
                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#3e2723] focus:ring-1 focus:ring-[#3e2723]/10"
                      />
                      <button
                        type="button"
                        onClick={handleAddCatatan}
                        className="p-2.5 bg-[#3e2723] text-white hover:bg-opacity-90 active:bg-opacity-100 rounded-xl transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="p-6 bg-[#fbf9f6] border-t border-[#d7ccc8]/40 flex gap-3 shrink-0 rounded-b-3xl">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-[#3e2723] hover:bg-[#4e342e] text-white font-black italic uppercase tracking-wider rounded-[1.5rem] shadow-lg shadow-[#3e2723]/20 flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Menyimpan...
                      </>
                    ) : (
                      'Simpan Serah Terima'
                    )}
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
