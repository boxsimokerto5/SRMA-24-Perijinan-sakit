import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { Home, MessageSquare, Send, Clock, User, Printer, Loader2, CheckCircle2, Calendar, Plus, MapPin, ClipboardList, Activity, FileText, Mail, ShieldCheck, BarChart3, Search, Menu, Smartphone, History, Check, ChevronRight, TrendingUp } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp, arrayUnion, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, LogTindakan, Memorandum, PinjamHP, Siswa, normalizeKelas, LaptopRequest } from '../types';
import { notifyAllRoles, notifyUserByRole } from '../services/fcmService';
import { format, addDays, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import { Contact, GraduationCap, IdCard, Info, Laptop, Users } from 'lucide-react';
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
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

  const [viewMode, setViewMode] = useState<'perizinan' | 'pinjam_hp' | 'kartu_siswa'>('perizinan');
  const [showMenu, setShowMenu] = useState(false);
  const [pinjamHPList, setPinjamHPList] = useState<PinjamHP[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [showPinjamForm, setShowPinjamForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [filteredStudentsList, setFilteredStudentsList] = useState<Siswa[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [studentSuggestions, setStudentSuggestions] = useState<Siswa[]>([]);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [selectedPinjam, setSelectedPinjam] = useState<PinjamHP | null>(null);
  
  const [phFilteredStudentsList, setPhFilteredStudentsList] = useState<Siswa[]>([]);
  const [phShowSuggestions, setPhShowSuggestions] = useState(false);
  
  // Pinjam HP Form states
  const [phNamaSiswa, setPhNamaSiswa] = useState('');
  const [phKelas, setPhKelas] = useState('X-1');
  const [phKeperluan, setPhKeperluan] = useState('');

  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);

  const currentSelectedPermit = permits.find(p => p.id === selectedPermit?.id) || selectedPermit;

  const filteredPermits = permits.filter(p => {
    const permitDate = p.tgl_surat?.toDate();
    if (!permitDate) return false;

    // Time Filter Logic
    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(permitDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(permitDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(permitDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(permitDate);

    const matchesSearch = 
      p.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomor_surat.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesDate && matchesTime;
  });

  const filteredPinjamHP = pinjamHPList.filter(item => {
    const pinjamDate = item.tgl_pinjam?.toDate();
    if (!pinjamDate) return false;

    // Time Filter Logic
    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(pinjamDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(pinjamDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(pinjamDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(pinjamDate);

    const matchesSearch = item.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch && matchesTime;
  });

  const filteredStudents = students.filter(s => {
    const name = s.nama_lengkap || '';
    const nik = s.nik || '';
    const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                         nik.includes(studentSearchTerm);
    const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).sort()];

  const handleNamaSiswaChange = (value: string) => {
    setNamaSiswa(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setFilteredStudentsList(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredStudentsList([]);
      setShowSuggestions(false);
    }
  };

  const selectStudent = (student: Siswa) => {
    setNamaSiswa(student.nama_lengkap);
    setKelas(student.kelas);
    
    // Auto-select Wali Kelas based on class
    const wk = WALI_KELAS_LIST.find(w => w.kelas === student.kelas);
    if (wk) {
      setWaliKelas(wk.name);
    }
    
    setShowSuggestions(false);
  };

  const handlePhNamaSiswaChange = (value: string) => {
    setPhNamaSiswa(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setPhFilteredStudentsList(filtered);
      setPhShowSuggestions(true);
    } else {
      setPhFilteredStudentsList([]);
      setPhShowSuggestions(false);
    }
  };

  const selectPhStudent = (student: Siswa) => {
    setPhNamaSiswa(student.nama_lengkap);
    setPhKelas(student.kelas);
    setPhShowSuggestions(false);
  };

  const handleStudentCardSearchChange = (value: string) => {
    setStudentSearchTerm(value);
    if (value.length > 1) {
      const filtered = students.filter(s => 
        s.nama_lengkap.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setStudentSuggestions(filtered);
      setShowStudentSuggestions(true);
    } else {
      setStudentSuggestions([]);
      setShowStudentSuggestions(false);
    }
  };

  // Close suggestions on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowSuggestions(false);
        setShowStudentSuggestions(false);
        setPhShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as IzinSakit;
        return { 
          id: doc.id, 
          ...rawData,
          kelas: normalizeKelas(rawData.kelas)
        } as IzinSakit;
      });
      setPermits(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'izin_sakit');
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
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'memorandums');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'pinjam_hp'),
      orderBy('tgl_pinjam', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as PinjamHP;
        return { 
          id: doc.id, 
          ...rawData,
          kelas: normalizeKelas(rawData.kelas)
        } as PinjamHP;
      });
      setPinjamHPList(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'pinjam_hp');
    });

    // Auto-cleanup: Delete records older than 2 days
    const cleanupOldRecords = async () => {
      try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoTimestamp = Timestamp.fromDate(twoDaysAgo);
        
        const qCleanup = query(
          collection(db, 'pinjam_hp'), 
          where('tgl_pinjam', '<', twoDaysAgoTimestamp),
          where('wali_asuh_uid', '==', user.uid)
        );
        
        const snapshot = await getDocs(qCleanup);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        if (snapshot.docs.length > 0) {
          console.log(`Auto-cleanup: Deleted ${snapshot.docs.length} old Pinjam HP records.`);
        }
      } catch (err) {
        console.error('Auto-cleanup failed:', err);
      }
    };

    cleanupOldRecords();
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    // Remove orderBy to ensure docments without nama_lengkap field are also fetched
    const q = query(collection(db, 'siswa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data() as Siswa;
        return { 
            id: doc.id, 
            ...rawData,
            kelas: normalizeKelas(rawData.kelas)
          } as Siswa;
        })
        // Sort client-side instead of in query to avoid skipping docs without the field
        .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
        
      setStudents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'siswa');
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'laptop_requests'),
      orderBy('tgl_request', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest));
      setLaptopRequests(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'laptop_requests');
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
        tgl_surat: serverTimestamp(),
        lokasi: 'Kediri',
        nama_wali_asuh: user.name,
        wali_asuh_uid: user.uid,
        nama_wali_kelas: waliKelas,
        status: 'pending_kelas', // Langsung ke Wali Kelas
      });

      // Notify relevant roles
      notifyAllRoles(['wali_kelas', 'kepala_sekolah'], 'Izin Umum Baru', `Wali Asuh ${user.name} membuat riwayat izin umum untuk ${namaSiswa}.`);

      setShowForm(false);
      // Reset form
      setNomorSurat(`SRMA-U-${Date.now().toString().slice(-6)}`);
      setNamaSiswa('');
      setAlasan('');
      setJumlahHari(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'izin_sakit');
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

      // Notify relevant roles
      notifyAllRoles(['wali_kelas', 'kepala_sekolah'], 'Persetujuan Izin Dibutuhkan', `Siswa di kelas Anda memerlukan persetujuan izin (Wali Asuh: ${user.name}).`);

      // Clear note for this permit
      const newNotes = { ...catatanKamar };
      delete newNotes[permitId];
      setCatatanKamar(newNotes);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
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

      // Notify Kepala Sekolah
      notifyAllRoles(['kepala_sekolah'], 'Peminjaman HP Baru', `Wali Asuh ${user.name} membuat riwayat pinjam HP untuk ${phNamaSiswa}.`);

      setShowPinjamForm(false);
      setPhNamaSiswa('');
      setPhKeperluan('');
      setPhShowSuggestions(false);
      setPhFilteredStudentsList([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'pinjam_hp');
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
        penerima_kembali_name: user.name,
        penerima_kembali_uid: user.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pinjam_hp/${id}`);
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

      // Notify others about log activity
      notifyAllRoles(['dokter', 'wali_kelas', 'kepala_sekolah'], 'Update Riwayat Tindakan', `Wali Asuh ${user.name} menambahkan catatan tindakan untuk siswa.`);
      
      setNewTindakan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
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

  const handleUpdateLaptopStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'laptop_requests', requestId), {
        status,
        updatedAt: serverTimestamp()
      });

      const req = laptopRequests.find(r => r.id === requestId);
      if (req) {
        notifyAllRoles(['guru_mapel', 'kepala_sekolah'], `Status Pinjam Laptop ${status.toUpperCase()}`, `Permohonan laptop untuk kelas ${req.kelas} telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh Wali Asuh.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `laptop_requests/${requestId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLaptopPDF = async (request: LaptopRequest) => {
    setLaptopPdfLoading(request.id!);
    try {
      await generateLaptopRequestPDF(request);
    } catch (error) {
      console.error("PDF Error:", error);
    } finally {
      setLaptopPdfLoading(null);
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
    const diagnosisData = Object.entries(
      permits
        .filter(p => p.tipe === 'sakit' && p.diagnosa)
        .reduce((acc, p) => {
          const d = p.diagnosa || 'Lainnya';
          acc[d] = (acc[d] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const monthlyTrend = Object.entries(
      permits.reduce((acc, p) => {
        const date = p.tgl_surat?.toDate();
        if (date) {
          const month = format(date, 'MMM yyyy');
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([name, value]) => ({ name, value }))
      .slice(-6);

    const COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6'];

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-display">Statistik Wali Asuh</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Data kesehatan siswa asuhan Anda.</p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Tren Perizinan</h3>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Top Diagnosa</h3>
              <Activity className="w-5 h-5 text-rose-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} width={80} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                    {diagnosisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
                    Cartu Siswa
                  </button>
                  <button
                    onClick={() => { setViewMode('pinjam_laptop' as any); setShowMenu(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all ${
                      viewMode === ('pinjam_laptop' as any) ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${viewMode === ('pinjam_laptop' as any) ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                      <Laptop className="w-4 h-4" />
                    </div>
                    Pinjam Laptop
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
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-blue-500 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-blue-100 mb-4">
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
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="bg-orange-500 p-2.5 w-fit rounded-2xl text-white shadow-lg shadow-orange-100 mb-4">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-display">{stats.memos}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Memo</p>
              </div>
            </motion.div>
          </div>

          {/* Riwayat Terakhir Header */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {viewMode === 'perizinan' ? 'Riwayat Perizinan' : 'Permohonan Laptop'}
            </h2>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('perizinan')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  viewMode === 'perizinan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Izin
              </button>
              <button 
                onClick={() => setViewMode('pinjam_laptop' as any)}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  viewMode === ('pinjam_laptop' as any) ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Laptop
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Filters & Search */}
            <div className="space-y-6">
            {/* Horizontal Time Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[ 
                { id: 'hari_ini', label: 'Hari Ini' },
                { id: 'kemarin', label: 'Kemarin' },
                { id: 'minggu_ini', label: 'Minggu Ini' },
                { id: 'bulan_ini', label: 'Bulan Ini' },
                { id: 'semua', label: 'Semua' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTimeFilter(cat.id as any)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    timeFilter === cat.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                      : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

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
                        onChange={(e) => handleNamaSiswaChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="Masukkan nama siswa"
                      />
                      <AnimatePresence>
                        {showSuggestions && filteredStudentsList.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                          >
                            {filteredStudentsList.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => selectStudent(student)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                                </div>
                                <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                    className="bg-orange-50 p-4 rounded-3xl border border-orange-100 border-l-8 border-l-orange-500 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-xl group-hover:scale-110 transition-transform">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-orange-600 transition-colors">{memo.perihal}</h4>
                        <p className="text-[10px] font-bold text-slate-500">{format(memo.tgl_memo.toDate(), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
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
                className={`group flex items-center gap-4 p-4 bg-white rounded-[2rem] shadow-sm border-l-8 hover:shadow-md transition-all cursor-pointer ${
                  permit.tipe === 'sakit' ? 'border-emerald-500 hover:border-emerald-600' :
                  permit.tipe === 'umum' ? 'border-blue-500 hover:border-blue-600' :
                  'border-amber-500 hover:border-amber-600'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  permit.tipe === 'sakit' ? 'bg-emerald-50 text-emerald-600' :
                  permit.tipe === 'umum' ? 'bg-blue-50 text-blue-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 truncate font-display">{permit.nama_siswa} ({permit.kelas})</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      permit.tipe === 'sakit' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      permit.tipe === 'umum' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {permit.tipe === 'sakit' ? 'Input Dokter' : permit.tipe === 'umum' ? 'Izin Wali Asuh' : 'Input Wali Kelas'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">• {permit.status === 'approved' || permit.status === 'acknowledged' ? 'Selesai' : 'Proses'}</span>
                  </div>
                  <p className="text-[9px] font-bold text-indigo-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                  </p>
                </div>
                <div className="text-slate-300 group-hover:text-amber-500 transition-colors">
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
      </div>
    )}

        {viewMode === ('pinjam_laptop' as any) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {laptopRequests.map(req => (
              <motion.div
                key={req.id}
                layout
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 font-display leading-tight">Pinjam Laptop - {req.kelas}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.nomor_surat}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                    req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {req.status}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                    <span>Guru Pengaju</span>
                    <span className="text-slate-900">{req.guru_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                    <span>Mata Pelajaran</span>
                    <span className="text-slate-900">{req.mapel}</span>
                  </div>
                </div>

                <div className="py-2 bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Siswa ({req.daftar_siswa.length})</p>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed truncate">
                    {req.daftar_siswa.join(', ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-2">
                  {req.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleUpdateLaptopStatus(req.id!, 'rejected')}
                        disabled={loading}
                        className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleUpdateLaptopStatus(req.id!, 'approved')}
                        disabled={loading}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        Setujui
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleLaptopPDF(req)}
                      disabled={laptopPdfLoading === req.id}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                      {laptopPdfLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                      Cetak PDF
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {laptopRequests.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Laptop className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permohonan masuk</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'pinjam_hp' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">Pinjam Handphone</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Monitoring Penggunaan Gadget</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setTimeFilter('hari_ini');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setShowPinjamForm(true)}
                  className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="space-y-6">
              {/* Horizontal Time Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[ 
                { id: 'hari_ini', label: 'Hari Ini' },
                { id: 'kemarin', label: 'Kemarin' },
                { id: 'minggu_ini', label: 'Minggu Ini' },
                { id: 'bulan_ini', label: 'Bulan Ini' },
                { id: 'semua', label: 'Semua' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTimeFilter(cat.id as any)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    timeFilter === cat.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                      : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredPinjamHP.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedPinjam(item)}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 transition-all"
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Pinjam: {item.tgl_pinjam && typeof item.tgl_pinjam.toDate === 'function' ? format(item.tgl_pinjam.toDate(), 'dd MMM, HH:mm') : '-'}
                    </div>
                    {item.status === 'dikembalikan' && item.tgl_kembali && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Kembali: {typeof item.tgl_kembali.toDate === 'function' ? format(item.tgl_kembali.toDate(), 'dd MMM, HH:mm') : '-'}
                      </div>
                    )}
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
                  onChange={(e) => handleStudentCardSearchChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
                <AnimatePresence>
                  {showStudentSuggestions && studentSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                    >
                      {studentSuggestions.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setStudentSearchTerm(student.nama_lengkap);
                            setShowStudentSuggestions(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                          </div>
                          <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {classes.map((c) => {
                  const studentCount = students.filter(s => c === 'Semua' || s.kelas === c).length;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedClass(c)}
                      className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedClass === c
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      {c}
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${selectedClass === c ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {studentCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <motion.div
                  key={student.id}
                  whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStudent(student)}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col gap-4 group cursor-pointer hover:border-indigo-300 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-600 transition-colors duration-500" />
                  
                  <div className="flex items-center gap-4 relative">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner group-hover:scale-110 transition-all duration-500">
                      {student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black text-slate-900 truncate font-display group-hover:text-indigo-600 transition-colors">{student.nama_lengkap || 'Tanpa Nama'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-md uppercase tracking-widest">
                          Kelas {student.kelas}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between relative">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">NIK Siswa</p>
                      <p className="text-xs font-bold text-slate-600 font-mono">{student.nik}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-all shadow-sm">
                      <ChevronRight className="w-4 h-4" />
                    </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      {(currentSelectedPermit.status || '').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
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

              {currentSelectedPermit.status === 'pending_ack' && (
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleAcknowledgeCatatan(currentSelectedPermit.id!)}
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Setujui & Tandatangani Catatan
                  </button>
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
              {(currentSelectedPermit.status === 'approved' || currentSelectedPermit.status === 'acknowledged') && (
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

      {/* Modal Detail Pinjam HP */}
      {selectedPinjam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Peminjaman HP</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Status: {selectedPinjam.status}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPinjam(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="text-center pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 font-display">{selectedPinjam.nama_siswa}</h2>
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-1">Kelas {selectedPinjam.kelas}</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Keperluan</label>
                  <p className="text-sm font-medium text-slate-700">{selectedPinjam.keperluan}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                    <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Waktu Pinjam</label>
                    <p className="text-xs font-black text-slate-900">{selectedPinjam.tgl_pinjam && typeof selectedPinjam.tgl_pinjam.toDate === 'function' ? format(selectedPinjam.tgl_pinjam.toDate(), 'dd MMM, HH:mm') : '-'}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Oleh: {selectedPinjam.wali_asuh_name}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                    <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Waktu Kembali</label>
                    <p className="text-xs font-black text-slate-900">{selectedPinjam.tgl_kembali && typeof selectedPinjam.tgl_kembali.toDate === 'function' ? format(selectedPinjam.tgl_kembali.toDate(), 'dd MMM, HH:mm') : '-'}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Oleh: {selectedPinjam.penerima_kembali_name || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setSelectedPinjam(null)}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-sm"
              >
                Tutup
              </button>
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
                    onChange={(e) => handlePhNamaSiswaChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Nama lengkap siswa"
                  />
                  <AnimatePresence>
                    {phShowSuggestions && phFilteredStudentsList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
                      >
                        {phFilteredStudentsList.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectPhStudent(student)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{student.kelas}</p>
                            </div>
                            <Check className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <IdCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Profil Lengkap Siswa</h3>
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
            
            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Header Info */}
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 font-black text-4xl shadow-inner mb-4">
                  {selectedStudent.nama_lengkap ? selectedStudent.nama_lengkap.charAt(0) : '?'}
                </div>
                <h2 className="text-2xl font-black text-slate-900 font-display leading-tight">{selectedStudent.nama_lengkap || 'Tanpa Nama'}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                    Kelas {selectedStudent.kelas}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest">
                    {selectedStudent.jenis_kelamin}
                  </span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Identitas Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Identitas Dasar</h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nomor KK</label>
                      <p className="text-sm font-black text-slate-900 font-mono">{selectedStudent.nomor_kk}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tempat, Tgl Lahir</label>
                      <p className="text-sm font-black text-slate-900">{selectedStudent.tempat_lahir}, {selectedStudent.tanggal_lahir}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Agama</label>
                        <p className="text-sm font-black text-slate-900">{selectedStudent.agama}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Umur</label>
                        <p className="text-sm font-black text-slate-900">{selectedStudent.umur} Tahun</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keluarga Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Data Keluarga</h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nama Ayah</label>
                      <p className="text-sm font-black text-slate-900">{selectedStudent.ayah || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nama Ibu</label>
                      <p className="text-sm font-black text-slate-900">{selectedStudent.ibu || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Anak Ke / Saudara</label>
                      <p className="text-sm font-black text-slate-900">Anak ke-{selectedStudent.anak_ke || '-'} dari {selectedStudent.saudara || '-'} bersaudara</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alamat Section */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Alamat Domisili</h4>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-indigo-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-900 leading-relaxed">{selectedStudent.alamat || '-'}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">RT/RW</label>
                          <p className="text-xs font-black text-slate-700">{selectedStudent.rt || '00'}/{selectedStudent.rw || '00'}</p>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Kelurahan</label>
                          <p className="text-xs font-black text-slate-700">{selectedStudent.kelurahan || '-'}</p>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Kecamatan</label>
                          <p className="text-xs font-black text-slate-700">{selectedStudent.kecamatan || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-sm"
              >
                Tutup Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
