import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { IzinSakit, AppUser, Memorandum, UserRole } from '../types';
import { format } from 'date-fns';
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
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  Activity,
  Send,
  Mail,
  ShieldCheck,
  LogOut,
  Bell
} from 'lucide-react';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';
import ProfileView from './ProfileView';

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
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  
  // Memorandum States
  const [subTab, setSubTab] = useState<'perizinan' | 'memorandum'>('perizinan');
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [newMemo, setNewMemo] = useState({
    perihal: '',
    isi: '',
    penerima: [] as UserRole[]
  });
  const [memoLoading, setMemoLoading] = useState(false);

  useEffect(() => {
    const qPermits = query(
      collection(db, 'izin_sakit'),
      orderBy('tgl_surat', 'desc')
    );

    const unsubscribePermits = onSnapshot(qPermits, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IzinSakit[];
      setPermits(data);
      setLoading(false);
    });

    const qMemos = query(
      collection(db, 'memorandums'),
      orderBy('tgl_memo', 'desc')
    );

    const unsubscribeMemos = onSnapshot(qMemos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Memorandum[];
      setMemos(data);
    });

    return () => {
      unsubscribePermits();
      unsubscribeMemos();
    };
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

  const filteredPermits = permits.filter(p => {
    const matchesSearch = 
      p.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomor_surat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.tipe === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'selesai' ? (p.status === 'approved' || p.status === 'acknowledged') : p.status === filterStatus);
    
    const permitDate = p.tgl_surat?.toDate();
    const matchesDate = (!startDate || (permitDate && permitDate >= new Date(startDate))) &&
                        (!endDate || (permitDate && permitDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999))));

    return matchesSearch && matchesType && matchesStatus && matchesDate;
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
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Statistik Perizinan</h2>
            <p className="text-sm text-slate-500">Analisis data kesehatan siswa secara real-time.</p>
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

        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <h3 className="font-black text-slate-900 mb-6">Tren Mingguan</h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-indigo-50 rounded-t-xl relative group">
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-xl transition-all group-hover:bg-indigo-600" 
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">H-{6-i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'profil') {
    return <ProfileView user={user} />;
  }

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 self-start">
        <button
          onClick={() => setSubTab('perizinan')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            subTab === 'perizinan' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Perizinan
        </button>
        <button
          onClick={() => setSubTab('memorandum')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            subTab === 'memorandum' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Mail className="w-4 h-4" /> Memorandum
        </button>
      </div>

      {subTab === 'perizinan' ? (
        <>
          {/* Header & Stats */}
          {/* Header & Stats */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Card 1: Siswa Sakit */}
              <div 
                onClick={() => { setFilterType('sakit'); setFilterStatus('all'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black">{stats.sakit}</h3>
                    <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Siswa Sakit<br />Hari Ini</p>
                </div>
              </div>

              {/* Card 2: Izin Disetujui */}
              <div 
                onClick={() => { setFilterType('all'); setFilterStatus('selesai'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black">{stats.selesai}</h3>
                    <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Izin<br />Disetujui</p>
                </div>
              </div>

              {/* Card 3: Dokter UKS */}
              <div 
                onClick={() => { setFilterType('all'); setFilterStatus('pending_asuh'); setSubTab('perizinan'); }}
                className="relative overflow-hidden bg-gradient-to-br from-rose-400 to-rose-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black">{stats.pending}</h3>
                    <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Dokter UKS<br />- Periksa</p>
                </div>
              </div>

              {/* Card 4: Memorandum */}
              <div 
                onClick={() => setSubTab('memorandum')}
                className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-amber-600 p-5 rounded-[2.5rem] shadow-xl text-white group transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-4xl font-black">{memos.length}</h3>
                    <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
                      <Mail className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Kepala Sekolah<br />- Memo</p>
                </div>
              </div>
            </div>
          )}

          {/* Riwayat Terakhir Header */}
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {activeTab === 'dashboard' ? 'Riwayat Terakhir' : 'Daftar Perizinan'}
            </h2>
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setFilterStatus('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Lihat Semua
            </button>
          </div>

          {/* Filters & Search - Show in Riwayat tab or if searching in Dashboard */}
          {(activeTab === 'riwayat' || searchTerm) && (
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
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="sakit">Izin Sakit</option>
                    <option value="umum">Izin Umum</option>
                    <option value="catatan">Catatan</option>
                  </select>
                </div>
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
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 truncate">{permit.nama_siswa} ({permit.kelas})</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded uppercase tracking-tighter shrink-0">
                  {permit.tipe === 'sakit' ? 'Dokter → Wali Asuh → Wali Kelas' : 
                   permit.tipe === 'umum' ? 'Wali Asuh → Wali Kelas' : 
                   'Wali Kelas → Wali Asuh'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                {permit.tipe === 'sakit' ? 'Izin Sakit' : permit.tipe === 'umum' ? 'Izin Umum' : 'Catatan'} • {permit.status === 'approved' || permit.status === 'acknowledged' ? 'Izin PDF Dikirim' : 'Menunggu Verifikasi'}
              </p>
            </div>
            <div className="text-slate-300">
              <Plus className="w-5 h-5 rotate-45" />
            </div>
          </div>
        ))}

        {filteredPermits.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-900 font-bold">Tidak Ada Data</h3>
            <p className="text-slate-500 text-sm mt-1">Tidak ditemukan perizinan yang sesuai dengan filter.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button 
        onClick={() => setShowMemoModal(true)}
        className="fixed bottom-24 right-6 bg-indigo-950 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-30 hover:scale-105 transition-transform active:scale-95"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-black uppercase tracking-widest">Buat Memo Baru</span>
      </button>
      </>
      ) : (
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
              <div 
                key={memo.id}
                onClick={() => setSelectedMemo(memo)}
                className="group bg-cyan-50 p-6 rounded-3xl shadow-sm border border-cyan-100 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-100 text-cyan-600 rounded-2xl group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">{memo.perihal}</h3>
                      <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                        {memo.nomor_memo} • {memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMM yyyy') : '-'}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {memo.penerima.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-white/60 border border-white/20 text-cyan-700 text-[9px] font-black rounded uppercase">
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-slate-300 group-hover:text-cyan-500 transition-colors" />
                </div>
              </div>
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
      )}

      {/* Modal Buat Memo */}
      {showMemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-900">Buat Memorandum Baru</h3>
              </div>
              <button onClick={() => setShowMemoModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSendMemo} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penerima</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllPenerima}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                      newMemo.penerima.length === 3 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    SEMUA STAF
                  </button>
                  {(['dokter', 'wali_asuh', 'wali_kelas'] as UserRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => togglePenerima(role)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                        newMemo.penerima.includes(role) ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {role.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perihal / Subjek</label>
                <input
                  required
                  value={newMemo.perihal}
                  onChange={e => setNewMemo(prev => ({ ...prev, perihal: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900"
                  placeholder="Contoh: Instruksi Kebersihan UKS"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Isi Memorandum</label>
                <textarea
                  required
                  rows={6}
                  value={newMemo.isi}
                  onChange={e => setNewMemo(prev => ({ ...prev, isi: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-700 leading-relaxed"
                  placeholder="Tuliskan pesan atau instruksi Bapak di sini..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMemoModal(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={memoLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {memoLoading ? 'Mengirim...' : <><Send className="w-4 h-4" /> Kirim Memo</>}
                </button>
              </div>
            </form>
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
                  <h3 className="font-bold text-slate-900">Detail Memorandum</h3>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penerima</label>
                <div className="flex flex-wrap gap-2">
                  {selectedMemo.penerima.map(r => (
                    <span key={r} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase">
                      {r.replace('_', ' ')}
                    </span>
                  ))}
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
                  <p className="font-bold text-slate-900">{selectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-bold text-slate-900">{selectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {selectedPermit.tipe === 'sakit' ? 'Diagnosa Medis' : (selectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Isi Catatan')}
                </label>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedPermit.tipe === 'sakit' ? selectedPermit.diagnosa : (selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.isi_catatan)}
                  </p>
                </div>
              </div>

              {selectedPermit.tipe !== 'catatan' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Masa Izin</label>
                    <p className="text-sm font-bold text-slate-900">{selectedPermit.jumlah_hari} Hari</p>
                    <p className="text-[10px] text-slate-500">
                      {selectedPermit.tgl_mulai && typeof selectedPermit.tgl_mulai.toDate === 'function' ? format(selectedPermit.tgl_mulai.toDate(), 'dd MMM yyyy') : '?'} - {selectedPermit.tgl_selesai && typeof selectedPermit.tgl_selesai.toDate === 'function' ? format(selectedPermit.tgl_selesai.toDate(), 'dd MMM yyyy') : '?'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Saat Ini</label>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        {selectedPermit.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Kelas</label>
                  <p className="text-xs font-semibold text-slate-700">{selectedPermit.nama_wali_kelas}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wali Asuh</label>
                  <p className="text-xs font-semibold text-slate-700">{selectedPermit.nama_wali_asuh || '-'}</p>
                </div>
              </div>

              {selectedPermit.catatan_kamar && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasi Kamar</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <MapPin className="w-4 h-4" />
                    {selectedPermit.catatan_kamar}
                  </div>
                </div>
              )}

              {/* Log Tindakan Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Log Tindakan & Perkembangan
                </label>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedPermit.tindakan && selectedPermit.tindakan.length > 0 ? (
                    selectedPermit.tindakan.map((t, idx) => (
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
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedPermit(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Tutup
              </button>
              {(selectedPermit.status === 'approved' || selectedPermit.status === 'acknowledged') && (
                <button
                  onClick={() => {
                    generatePermitPDF(selectedPermit);
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
    </div>
  );
}
