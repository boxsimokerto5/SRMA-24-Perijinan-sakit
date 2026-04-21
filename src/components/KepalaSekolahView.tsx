import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc, doc, where, getDocs, writeBatch } from 'firebase/firestore';
import { IzinSakit, AppUser, Memorandum, UserRole, normalizeKelas, Announcement, PinjamHP, Siswa, LaptopRequest, HPRequest } from '../types';
import { notifyAllRoles } from '../services/fcmService';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, subDays } from 'date-fns';
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
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Home, 
  User, 
  MapPin, 
  Plus, 
  Printer,
  Loader2,
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  Activity,
  Send,
  Mail,
  ShieldCheck,
  LogOut,
  Bell,
  ChevronRight,
  Laptop,
  Tablet, Smartphone, Check, Database
} from 'lucide-react';
import { generatePermitPDF, generateMemorandumPDF, generateLaptopRequestPDF, generateHPRequestPDF } from '../pdfUtils';
import ProfileView from './ProfileView';
import { motion, AnimatePresence } from 'motion/react';

interface KepalaSekolahViewProps {
  user: AppUser;
  activeTab: string;
}

export default function KepalaSekolahView({ user, activeTab }: KepalaSekolahViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  
  // Announcement States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Memorandum States
  const [subTab, setSubTab] = useState<'perizinan' | 'memorandum' | 'pengumuman' | 'pinjam_laptop' | 'permohonan_hp' | 'pangkalan_data'>('perizinan');
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [laptopRequests, setLaptopRequests] = useState<LaptopRequest[]>([]);
  const [laptopPdfLoading, setLaptopPdfLoading] = useState<string | null>(null);
  
  const [hpRequests, setHpRequests] = useState<HPRequest[]>([]);
  const [hpRequestPdfLoading, setHpRequestPdfLoading] = useState<string | null>(null);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [newMemo, setNewMemo] = useState({
    perihal: '',
    isi: '',
    penerima: [] as UserRole[]
  });
  const [memoLoading, setMemoLoading] = useState(false);
  const [newTindakan, setNewTindakan] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportRange, setReportRange] = useState<'hari_ini' | 'kemarin' | 'minggu_ini' | 'bulan_ini'>('hari_ini');
  const [reportLoading, setReportLoading] = useState(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState<any>(null);

  // Student Cards States
  const [students, setStudents] = useState<Siswa[]>([]);
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const classes = ['Semua', ...Array.from(new Set(students.map(s => s.kelas))).filter(Boolean).sort()];

  // History Data
  const combinedHistory = React.useMemo(() => {
    // Transform permits into history items
    const permitHistory = permits.map(p => ({
      id: p.id,
      title: p.nama_siswa,
      subtitle: p.kelas,
      type: p.tipe === 'sakit' ? 'Dokter' : (p.tipe === 'catatan' ? 'Wali Kelas' : 'Wali Asuh'),
      category: p.tipe,
      date: p.tgl_surat?.toDate(),
      details: p.diagnosa || p.alasan || p.isi_catatan,
      status: p.status,
      raw: p,
      origin: 'izin_sakit'
    }));

    return [...permitHistory].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [permits]);

  const filteredHistory = combinedHistory.filter(item => {
    const itemDate = item.date;
    if (!itemDate) return false;

    // Time Filter Logic
    let matchesTime = true;
    if (timeFilter === 'hari_ini') matchesTime = isToday(itemDate);
    else if (timeFilter === 'kemarin') matchesTime = isYesterday(itemDate);
    else if (timeFilter === 'minggu_ini') matchesTime = isThisWeek(itemDate, { weekStartsOn: 1 });
    else if (timeFilter === 'bulan_ini') matchesTime = isThisMonth(itemDate);

    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.details && item.details.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch && matchesTime;
  });

  useEffect(() => {
    setLoading(true);
    const qPermits = query(collection(db, 'izin_sakit'), orderBy('tgl_surat', 'desc'));
    const unsubscribePermits = onSnapshot(qPermits, (snapshot) => {
      setPermits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit)));
      setLoading(false);
    });

    const qMemos = query(collection(db, 'memorandums'), orderBy('tgl_memo', 'desc'));
    const unsubscribeMemos = onSnapshot(qMemos, (snapshot) => {
      setMemos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum)));
    });

    const qAnnouncements = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    const qSiswa = query(collection(db, 'siswa'), orderBy('nama_lengkap', 'asc'));
    const unsubscribeSiswa = onSnapshot(qSiswa, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() as Siswa,
        kelas: normalizeKelas((doc.data() as any).kelas)
      })));
    });

    const qLaptop = query(collection(db, 'laptop_requests'), orderBy('tgl_request', 'desc'));
    const unsubscribeLaptop = onSnapshot(qLaptop, (snapshot) => {
      setLaptopRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaptopRequest)));
    });

    const qHP = query(collection(db, 'hp_requests'), orderBy('tgl_request', 'desc'));
    const unsubscribeHP = onSnapshot(qHP, (snapshot) => {
      setHpRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HPRequest)));
    });

    return () => {
      unsubscribePermits();
      unsubscribeMemos();
      unsubscribeAnnouncements();
      unsubscribeSiswa();
      unsubscribeLaptop();
      unsubscribeHP();
    };
  }, []);

  const handleAddTindakan = async (permitId: string) => {
    if (!newTindakan.trim()) return;
    setActionLoading(true);
    try {
      const { updateDoc, doc, arrayUnion } = await import('firebase/firestore');
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        tindakan: arrayUnion({
          waktu: Timestamp.now(),
          oleh: user.name,
          peran: 'Kepala Sekolah',
          pesan: newTindakan
        })
      });

      // Notify others
      notifyAllRoles(['dokter', 'wali_asuh', 'wali_kelas'], 'Update Riwayat Tindakan', `Kepala Sekolah ${user.name} menambahkan catatan tindakan baru.`);

      setNewTindakan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `izin_sakit/${permitId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateFullReport = async () => {
    setReportLoading(true);
    try {
      const { generateSummaryReportPDF } = await import('../pdfUtils');
      
      const filteredForReport = permits.filter(p => {
        const permitDate = p.tgl_surat?.toDate();
        if (!permitDate) return false;
        
        if (reportRange === 'hari_ini') return isToday(permitDate);
        if (reportRange === 'kemarin') return isYesterday(permitDate);
        if (reportRange === 'minggu_ini') return isThisWeek(permitDate, { weekStartsOn: 1 });
        if (reportRange === 'bulan_ini') return isThisMonth(permitDate);
        return true;
      });

      const rangeLabel = {
        hari_ini: 'Hari Ini',
        kemarin: 'Kemarin',
        minggu_ini: 'Minggu Ini',
        bulan_ini: 'Bulan Ini'
      }[reportRange];

      await generateSummaryReportPDF(filteredForReport, rangeLabel);
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat laporan');
    } finally {
      setReportLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    setAnnouncementLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        createdAt: Timestamp.now(),
        authorName: user.name,
        authorUid: user.uid,
        isActive: true
      });

      // Broadcast Notification
      notifyAllRoles(['dokter', 'wali_asuh', 'wali_kelas'], 'Pengumuman Baru', `Ada pengumuman baru dari Kepala Sekolah: ${newAnnouncement.title}`, 'view:home');

      setNewAnnouncement({ title: '', content: '' });
      setShowAnnouncementModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'announcements');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleDeleteMemorandum = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'memorandums', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `memorandums/${id}`);
    }
  };

  useEffect(() => {
    const autoCleanup = async () => {
      if (!auth.currentUser?.emailVerified) {
        console.log('Auto-cleanup skipped: Email not verified');
        return;
      }
      try {
        const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7));
        const conf = [
          { col: 'izin_sakit', field: 'tgl_surat' },
          { col: 'memorandums', field: 'tgl_memo' },
          { col: 'announcements', field: 'createdAt' },
        ];

        for (const item of conf) {
          try {
            const q = query(collection(db, item.col), where(item.field, '<', sevenDaysAgo));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
              const docs = snap.docs;
              const chunkSize = 250; // Use conservative batch size
              
              for (let i = 0; i < docs.length; i += chunkSize) {
                const chunk = docs.slice(i, i + chunkSize);
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
              
              console.log(`Auto-cleaned ${snap.size} old records from ${item.col} successfully.`);
            }
          } catch (colErr) {
            console.error(`Auto-cleanup failed for collection ${item.col}:`, colErr);
            // Don't throw, continue to next collection
          }
        }
      } catch (e) {
        console.error('Auto-cleanup failed:', e);
      }
    };
    autoCleanup();
  }, []);

  const handleSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemo.penerima.length === 0) {
      alert('Pilih minimal satu penerima');
      return;
    }
    
    setMemoLoading(true);
    try {
      const memoData: Omit<Memorandum, 'id'> = {
        nomor_memo: `MEMO-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
        perihal: newMemo.perihal,
        isi: newMemo.isi,
        tgl_memo: Timestamp.now(),
        penerima: newMemo.penerima,
        pengirim_name: user.name,
        pengirim_uid: user.uid
      };
      
      await addDoc(collection(db, 'memorandums'), memoData);

      // Notify targeted roles
      notifyAllRoles(newMemo.penerima, 'Memorandum Baru', `Kepala Sekolah mengirimkan memorandum: ${newMemo.perihal}`, 'view:memos');

      setShowMemoModal(false);
      setNewMemo({ perihal: '', isi: '', penerima: [] });
    } catch (error) {
      console.error('Error sending memo:', error);
    } finally {
      setMemoLoading(false);
    }
  };

  const togglePenerima = (role: UserRole) => {
    setNewMemo(prev => ({
      ...prev,
      penerima: prev.penerima.includes(role)
        ? prev.penerima.filter(r => r !== role)
        : [...prev.penerima, role]
    }));
  };

  const selectAllPenerima = () => {
    if (newMemo.penerima.length === 3) {
      setNewMemo(prev => ({ ...prev, penerima: [] }));
    } else {
      setNewMemo(prev => ({ ...prev, penerima: ['dokter', 'wali_asuh', 'wali_kelas'] }));
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
    const matchesType = filterType === 'all' || p.tipe === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'selesai' ? (p.status === 'approved' || p.status === 'acknowledged') : p.status === filterStatus);
    
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesType && matchesStatus && matchesDate && matchesTime;
  });

  const stats = {
    total: permits.length,
    sakit: permits.filter(p => p.tipe === 'sakit').length,
    umum: permits.filter(p => p.tipe === 'umum').length,
    catatan: permits.filter(p => p.tipe === 'catatan').length,
    pending: permits.filter(p => p.status.startsWith('pending')).length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (activeTab === 'statistik') {
    // Prepare data for charts
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
            <h2 className="text-2xl font-black text-slate-900 font-display">Statistik Perizinan</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Analisis data kesehatan siswa secara real-time.</p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Izin Sakit</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.sakit}</h3>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full" style={{ width: `${(stats.sakit / stats.total) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Izin Umum</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.umum}</h3>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${(stats.umum / stats.total) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tingkat Kesembuhan</p>
                <h3 className="text-2xl font-black text-slate-900">{Math.round((stats.selesai / stats.total) * 100) || 0}%</h3>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${(stats.selesai / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Tren Perizinan Bulanan</h3>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 900, color: '#1e293b' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Top 5 Diagnosa Penyakit</h3>
              <Activity className="w-5 h-5 text-rose-500" />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
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

        <div className="bg-slate-900 p-8 rounded-[3rem] text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/10 rounded-[2rem] backdrop-blur-md">
                <Users className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-xl font-black font-display">Ringkasan Kehadiran</h4>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total {stats.total} perizinan tercatat di sistem</p>
              </div>
            </div>
            <button 
              onClick={() => setShowReportModal(true)}
              className="px-8 py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-indigo-50 transition-all shadow-xl shadow-indigo-500/10"
            >
              Lihat Laporan Lengkap
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-[1.2rem] shadow-sm border border-slate-200/60 self-start overflow-x-auto print:hidden">
        <button
          onClick={() => setSubTab('perizinan')}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'perizinan' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Perizinan
        </button>
        <button
          onClick={() => setSubTab('memorandum')}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'memorandum' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Memorandum
        </button>
        <button
          onClick={() => setSubTab('pengumuman')}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'pengumuman' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bell className="w-3.5 h-3.5" /> Pengumuman
        </button>
        <button
          onClick={() => setSubTab('pinjam_laptop')}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'pinjam_laptop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" /> Laptop
        </button>
        <button
          onClick={() => setSubTab('permohonan_hp')}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'permohonan_hp' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Tablet className="w-3.5 h-3.5" /> HP
        </button>
        <button
          onClick={() => setSubTab('pangkalan_data' as any)}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'pangkalan_data' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Database
        </button>
        <button
          onClick={() => setSubTab('kartu_siswa' as any)}
          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
            (subTab as string) === 'kartu_siswa' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-3.5 h-3.5" /> Kartu Siswa
        </button>
      </div>

      {subTab === 'perizinan' ? (
        <>
          {/* Header & Stats */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Card 1: Siswa Sakit */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('sakit'); setFilterStatus('all'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-slate-900 p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.sakit}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Siswa Sakit<br />Hari Ini</p>
                </div>
              </motion.div>

              {/* Card 2: Izin Disetujui */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('all'); setFilterStatus('selesai'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-indigo-600 p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.selesai}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Izin<br />Disetujui</p>
                </div>
              </motion.div>

              {/* Card 3: Dokter UKS */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setFilterType('all'); setFilterStatus('pending_asuh'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-emerald-600 p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{stats.pending}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Dokter UKS<br />- Periksa</p>
                </div>
              </motion.div>

              {/* Card 4: Memorandum */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => setSubTab('memorandum')}
                className="relative overflow-hidden bg-orange-600 p-6 rounded-[2.5rem] shadow-xl text-white group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black font-display tracking-tight">{memos.length}</h3>
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                      <Mail className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-80">Kepala Sekolah<br />- Memo</p>
                </div>
              </motion.div>
            </div>
          )}

          {/* Riwayat Aktivitas Header */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Riwayat Aktivitas</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Konsolidasi Data Seluruh Staf</p>
            </div>
            <button 
              onClick={() => {
                setSearchTerm('');
                setTimeFilter('hari_ini');
              }}
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              Reset
            </button>
          </div>

          <div className="space-y-6">
            {/* Horizontal Time Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[ 
                { id: 'hari_ini', label: 'Hari Ini' },
                { id: 'kemarin', label: 'Kemarin' },
                { id: 'minggu_ini', label: 'Satu Minggu' },
                { id: 'bulan_ini', label: 'Satu Bulan' },
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

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau detail riwayat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                />
              </div>
            </div>
          </div>

          {/* List Riwayat - Combined & Color Coded */}
          <div className="grid grid-cols-1 gap-3">
            {filteredHistory.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => {
                  if (item.origin === 'izin_sakit') setSelectedPermit(item.raw as IzinSakit);
                  else setShowHistoryDetail(item);
                }}
                className={`group flex items-center gap-4 p-4 bg-white rounded-[2rem] shadow-sm border-l-8 hover:shadow-md transition-all cursor-pointer ${
                  item.category === 'sakit' ? 'border-emerald-500' :
                  item.category === 'umum' ? 'border-blue-500' :
                  'border-amber-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  item.category === 'sakit' ? 'bg-emerald-50 text-emerald-600' :
                  item.category === 'umum' ? 'bg-blue-50 text-blue-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 truncate tracking-tight">{item.title} ({item.subtitle})</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-widest border ${
                      item.category === 'sakit' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      item.category === 'umum' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {item.category === 'sakit' ? 'Dr' : 
                       item.category === 'umum' ? 'Asuh' : 'Kelas'} : {item.type}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate flex-1">
                      {item.details}
                    </p>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.date ? format(item.date, 'dd MMM, HH:mm') : '-'}
                  </p>
                </div>
                <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold uppercase tracking-widest text-xs">Riwayat Kosong</h3>
                <p className="text-slate-400 text-[10px] mt-1 bg-slate-50 inline-block px-3 py-1 rounded-full uppercase font-black">Tidak ditemukan aktivitas</p>
              </div>
            )}
          </div>

      {/* Floating Action Button (FAB) */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if ((subTab as string) === 'memorandum') setShowMemoModal(true);
          else if ((subTab as string) === 'pengumuman') setShowAnnouncementModal(true);
        }}
        className="fixed bottom-24 right-6 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-30"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-black uppercase tracking-widest">
          {(subTab as string) === 'pengumuman' ? 'Buat Pengumuman' : 'Buat Memo Baru'}
        </span>
      </motion.button>
      </>
      ) : subTab === 'memorandum' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Memorandum Intern</h2>
              <p className="text-sm text-slate-500">Kirim instruksi atau pengumuman resmi ke staf.</p>
            </div>
            <button
              onClick={() => setShowMemoModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Buat Memo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memos.map((memo) => (
              <motion.div 
                key={memo.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group bg-orange-50 p-6 rounded-[2.5rem] shadow-sm border border-orange-100 border-l-8 border-l-orange-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div 
                  onClick={() => setSelectedMemo(memo)}
                  className="flex items-center justify-between flex-1"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 font-display group-hover:text-orange-700 transition-colors">{memo.perihal}</h3>
                      <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                        {memo.nomor_memo} • {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {memo.penerima.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-black rounded uppercase tracking-tighter">
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-300 group-hover:text-orange-500 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMemorandum(memo.id!);
                  }}
                  className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors shrink-0"
                  title="Hapus Memo"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </motion.div>
            ))}
            {memos.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Belum Ada Memo</h3>
                <p className="text-slate-500 text-sm mt-1">Gunakan tombol "Buat Memo" untuk mengirim instruksi.</p>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'pengumuman' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pengumuman Banner</h2>
              <p className="text-sm text-slate-500">Kelola pengumuman yang tampil di semua akun.</p>
            </div>
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Buat Pengumuman
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 font-display">{ann.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{ann.content}</p>
                    <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                      Oleh {ann.authorName} • {ann.createdAt && typeof ann.createdAt.toDate === 'function' ? format(ann.createdAt.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteAnnouncement(ann.id!)}
                  className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold">Belum Ada Pengumuman</h3>
                <p className="text-slate-500 text-sm mt-1">Gunakan tombol "Buat Pengumuman" untuk menyiarkan informasi.</p>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'pinjam_laptop' ? (
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

              <div className="pt-4 border-t border-slate-50">
                <button
                  onClick={() => generateLaptopRequestPDF(req)}
                  disabled={req.status !== 'approved'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Surat Izin Laptop
                </button>
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
      ) : subTab === 'permohonan_hp' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {hpRequests.map(req => (
            <motion.div
              key={req.id}
              layout
              className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Tablet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 font-display leading-tight">Pinjam HP - {req.kelas}</h4>
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

              <div className="pt-4 border-t border-slate-50">
                <button
                  onClick={() => generateHPRequestPDF(req)}
                  disabled={req.status !== 'approved'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Surat Izin HP
                </button>
              </div>
            </motion.div>
          ))}
          {hpRequests.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
              <Tablet className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permohonan HP masuk</p>
            </div>
          )}
        </div>
      ) : (subTab as string) === 'kartu_siswa' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {students
                .filter(s => {
                  const name = s.nama_lengkap || '';
                  const nik = s.nik || '';
                  const matchesClass = selectedClass === 'Semua' || s.kelas === selectedClass;
                  const matchesSearch = name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
                                       nik.includes(studentSearchTerm);
                  return matchesClass && matchesSearch;
                })
                .map((student) => {
                  const isFemale = student.jenis_kelamin?.toLowerCase().startsWith('p');
                  const colorClass = isFemale ? 'pink' : 'blue';
                  
                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      onClick={() => setSelectedStudent(student)}
                      className={`bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:border-${colorClass}-300 cursor-pointer transition-all`}
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-${colorClass}-50 group-hover:text-${colorClass}-500 transition-colors`}>
                            <span className="text-xl font-black">{student.nama_lengkap ? student.nama_lengkap.charAt(0) : '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-black text-slate-900 leading-tight group-hover:text-${colorClass}-600 transition-colors line-clamp-2 uppercase text-sm`}>{student.nama_lengkap || 'Tanpa Nama'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 bg-${colorClass}-100 text-${colorClass}-700 rounded text-[8px] font-black uppercase tracking-widest`}>{student.kelas}</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{student.asrama || 'ASRAMA'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIK</span>
                            <span className="text-xs font-mono font-bold text-slate-600">{student.nik || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TTL</span>
                            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{student.ttl || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ayah/Ibu</span>
                            <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{student.ayah || '-'} / {student.ibu || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : subTab === 'pangkalan_data' ? (
        <div className="h-[calc(100vh-200px)] w-full bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
          <iframe 
            src="https://app.box.com/s/3ogn8xtw84he8uxb1yfnvum9mgwpc7db"
            className="w-full h-full border-none"
            title="Pangkalan Data Wali Asuh"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-forms allow-modals allow-orientation-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          />
        </div>
      ) : null}

      {/* Modal Buat Memo */}
      {showMemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Buat Memorandum Baru</h3>
              </div>
              <button onClick={() => setShowMemoModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSendMemo} className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerima Instruksi</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllPenerima}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all tracking-widest ${
                      newMemo.penerima.length === 3 ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    SEMUA STAF
                  </button>
                  {(['dokter', 'wali_asuh', 'wali_kelas'] as UserRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => togglePenerima(role)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all tracking-widest ${
                        newMemo.penerima.includes(role) ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {role.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal / Subjek</label>
                <input
                  required
                  value={newMemo.perihal}
                  onChange={e => setNewMemo(prev => ({ ...prev, perihal: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-black text-slate-900 font-display"
                  placeholder="Contoh: Instruksi Kebersihan UKS"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Memorandum</label>
                <textarea
                  required
                  rows={6}
                  value={newMemo.isi}
                  onChange={e => setNewMemo(prev => ({ ...prev, isi: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-700 leading-relaxed font-medium"
                  placeholder="Tuliskan pesan atau instruksi Bapak di sini..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMemoModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={memoLoading}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {memoLoading ? 'Mengirim...' : <><Send className="w-4 h-4" /> Kirim Memo</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Announcement */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Bell className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Buat Pengumuman Baru</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Siarkan ke Semua Akun</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Judul Pengumuman</label>
                <input
                  required
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-black text-slate-900 font-display"
                  placeholder="Contoh: Libur Idul Fitri 1445 H"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Pengumuman</label>
                <textarea
                  required
                  rows={4}
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700 resize-none"
                  placeholder="Tuliskan detail pengumuman di sini..."
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleAddAnnouncement}
                disabled={announcementLoading || !newAnnouncement.title.trim() || !newAnnouncement.content.trim()}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {announcementLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Siarkan</>}
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
                  <h3 className="font-black text-slate-900">Detail Memorandum</h3>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerima</label>
                <div className="flex flex-wrap gap-2">
                  {selectedMemo.penerima.map(r => (
                    <span key={r} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                      {r.replace('_', ' ')}
                    </span>
                  ))}
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

      {/* Modal Laporan Lengkap */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Laporan Lengkap</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Pilih Periode Laporan</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: 'kemarin', label: 'Kemarin' },
                  { id: 'minggu_ini', label: 'Minggu Ini' },
                  { id: 'bulan_ini', label: 'Bulan Ini' }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setReportRange(range.id as any)}
                    className={`p-4 rounded-2xl border-2 transition-all text-center ${
                      reportRange === range.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-widest">{range.label}</p>
                  </button>
                ))}
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                  Laporan akan mencakup seluruh data perizinan (Sakit, Umum, Catatan) pada periode yang dipilih dalam format PDF resmi.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateFullReport}
                disabled={reportLoading}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4" /> Cetak Laporan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Riwayat Umum (Non-Izin Sakit) */}
      {showHistoryDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">Detail Aktivitas</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{showHistoryDetail.type}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</label>
                  <p className="font-black text-slate-900">{showHistoryDetail.title}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900">{showHistoryDetail.subtitle}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Keterangan
                </label>
                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{showHistoryDetail.details}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</label>
                  <p className="text-xs font-bold text-slate-900">{showHistoryDetail.date ? format(showHistoryDetail.date, 'dd MMM yyyy, HH:mm') : '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    showHistoryDetail.status === 'approved' || showHistoryDetail.status === 'acknowledged'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {showHistoryDetail.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 mt-2">
              <button
                onClick={() => setShowHistoryDetail(null)}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
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
                  <p className="font-black text-slate-900 font-display">{selectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-black text-slate-900 font-display">{selectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedPermit.tipe === 'sakit' ? 'Diagnosa Medis' : (selectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Isi Catatan')}
                </label>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {selectedPermit.tipe === 'sakit' ? selectedPermit.diagnosa : (selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.isi_catatan)}
                  </p>
                </div>
              </div>

              {selectedPermit.tipe !== 'catatan' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Izin</label>
                    <p className="text-sm font-black text-slate-900 font-display">{selectedPermit.jumlah_hari} Hari</p>
                    <p className="text-[10px] font-bold text-slate-500">
                      {selectedPermit.tgl_mulai && typeof selectedPermit.tgl_mulai.toDate === 'function' ? format(selectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {selectedPermit.tgl_selesai && typeof selectedPermit.tgl_selesai.toDate === 'function' ? format(selectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {(selectedPermit.status || '').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-bold text-slate-700">{selectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {selectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-black">
                    <MapPin className="w-4 h-4" />
                    {selectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                    selectedPermit.tindakan.map((t, idx) => (
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
                    placeholder="Tambah catatan/instruksi Kepala Sekolah..."
                    value={newTindakan}
                    onChange={(e) => setNewTindakan(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                  <button
                    onClick={() => handleAddTindakan(selectedPermit.id!)}
                    disabled={actionLoading || !newTindakan.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
              {(selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged') && (
                <button
                  onClick={() => {
                    generatePermitPDF(selectedPermit);
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

      {/* Modal Detail Siswa Lengkap */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className={`p-8 border-b border-slate-100 flex items-center justify-between ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-50' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-5">
                <div className={`w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center shadow-lg shadow-black/5`}>
                  <span className={`text-2xl font-black ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'text-pink-600' : 'text-blue-600'}`}>
                    {selectedStudent.nama_lengkap.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{selectedStudent.nama_lengkap}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white'}`}>
                      {selectedStudent.kelas}
                    </span>
                    <span className="px-2.5 py-1 bg-white/80 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-200/50">
                      {selectedStudent.asrama || 'ASRAMA'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="p-3 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Data Pribadi */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 rounded-full ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-500' : 'bg-blue-500'}`} />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Data Personal</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nomor Induk Kependudukan (NIK)</label>
                      <p className="text-sm font-mono font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">{selectedStudent.nik || '-'}</p>
                    </div>
                    
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tempat, Tanggal Lahir</label>
                      <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">{selectedStudent.ttl || `${selectedStudent.tempat_lahir}, ${selectedStudent.tanggal_lahir}` || '-'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Jenis Kelamin</label>
                        <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.jenis_kelamin || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Agama</label>
                        <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.agama || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Keluarga & Alamat */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 rounded-full ${selectedStudent.jenis_kelamin?.toLowerCase().startsWith('p') ? 'bg-pink-500' : 'bg-blue-500'}`} />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Keluarga & Alamat</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ayah</label>
                        <p className="text-sm font-black text-slate-700 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 group-hover:border-indigo-200 transition-all">{selectedStudent.ayah || '-'}</p>
                      </div>
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama Ibu</label>
                        <p className="text-sm font-black text-slate-700 bg-rose-50/30 p-4 rounded-2xl border border-rose-100 group-hover:border-rose-200 transition-all">{selectedStudent.ibu || '-'}</p>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alamat Lengkap</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-indigo-200 transition-all">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">{selectedStudent.alamat || 'Alamat tidak tersedia'}</p>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/50">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Kec: {selectedStudent.kecamatan || '-'}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">Kel: {selectedStudent.kelurahan || '-'}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">RT/RW: {selectedStudent.rt || '00'}/{selectedStudent.rw || '00'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Siswa ke-</label>
                      <p className="text-sm font-black text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">{selectedStudent.anak_ke || '-'} dari {selectedStudent.saudara || '-'} bersaudara</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-full py-5 bg-white border border-slate-200 text-slate-600 font-black rounded-[2rem] hover:bg-slate-100 hover:shadow-lg transition-all uppercase tracking-widest text-xs"
              >
                Tutup Profil Siswa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
