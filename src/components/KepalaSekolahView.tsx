import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
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
  ShieldCheck
} from 'lucide-react';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';

interface KepalaSekolahViewProps {
  user: AppUser;
}

export default function KepalaSekolahView({ user }: KepalaSekolahViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  
  // Memorandum States
  const [activeTab, setActiveTab] = useState<'perizinan' | 'memorandum'>('perizinan');
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

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 self-start">
        <button
          onClick={() => setActiveTab('perizinan')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'perizinan' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Perizinan
        </button>
        <button
          onClick={() => setActiveTab('memorandum')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'memorandum' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Mail className="w-4 h-4" /> Memorandum
        </button>
      </div>

      {activeTab === 'perizinan' ? (
        <>
          {/* Header & Stats */}
      <div className="flex overflow-x-auto pb-4 gap-4 custom-scrollbar snap-x">
        <div className="flex-none w-40 bg-blue-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <BarChart3 className="w-5 h-5 text-blue-700" />
            </div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total</p>
            <h3 className="text-2xl font-black text-blue-900">{stats.total}</h3>
          </div>
        </div>
        
        <div className="flex-none w-40 bg-rose-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <TrendingUp className="w-5 h-5 text-rose-700" />
            </div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Sakit</p>
            <h3 className="text-2xl font-black text-rose-900">{stats.sakit}</h3>
          </div>
        </div>

        <div className="flex-none w-40 bg-indigo-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <FileText className="w-5 h-5 text-indigo-700" />
            </div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Umum</p>
            <h3 className="text-2xl font-black text-indigo-900">{stats.umum}</h3>
          </div>
        </div>

        <div className="flex-none w-40 bg-amber-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <ClipboardList className="w-5 h-5 text-amber-700" />
            </div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Catatan</p>
            <h3 className="text-2xl font-black text-amber-900">{stats.catatan}</h3>
          </div>
        </div>

        <div className="flex-none w-40 bg-orange-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <AlertTriangle className="w-5 h-5 text-orange-700" />
            </div>
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Pending</p>
            <h3 className="text-2xl font-black text-orange-900">{stats.pending}</h3>
          </div>
        </div>

        <div className="flex-none w-40 bg-emerald-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all snap-start">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center mb-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            </div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Selesai</p>
            <h3 className="text-2xl font-black text-emerald-900">{stats.selesai}</h3>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
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
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <Plus className="w-3 h-3 rotate-45 text-slate-400" />
                </button>
              )}
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status</option>
              <option value="pending_asuh">Menunggu Wali Asuh</option>
              <option value="pending_kelas">Menunggu Wali Kelas</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>
        </div>
      </div>

      {/* List Perizinan */}
      <div className="grid grid-cols-1 gap-4">
        {filteredPermits.map((permit) => (
          <div 
            key={permit.id}
            onClick={() => setSelectedPermit(permit)}
            className={`group p-6 rounded-3xl shadow-sm border transition-all cursor-pointer ${
              permit.tipe === 'sakit' ? 'bg-rose-50 border-rose-100 hover:border-rose-300' :
              permit.tipe === 'umum' ? 'bg-blue-50 border-blue-100 hover:border-blue-300' :
              'bg-purple-50 border-purple-100 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform ${
                  permit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600' :
                  permit.tipe === 'umum' ? 'bg-blue-100 text-blue-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {permit.tipe === 'sakit' ? <Activity className="w-6 h-6" /> :
                   permit.tipe === 'umum' ? <FileText className="w-6 h-6" /> :
                   <ClipboardList className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900">{permit.nama_siswa}</h3>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg ${
                      permit.tipe === 'sakit' ? 'bg-rose-200 text-rose-800' :
                      permit.tipe === 'umum' ? 'bg-blue-200 text-blue-800' :
                      'bg-purple-200 text-purple-800'
                    }`}>
                      {permit.tipe}
                    </span>
                    <span className="px-2 py-0.5 bg-white/60 text-slate-600 text-[9px] font-black uppercase rounded-lg border border-white/20">
                      Kelas {permit.kelas}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {permit.nomor_surat} • {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight border ${
                      permit.tipe === 'sakit' ? 'bg-rose-100 text-rose-600 border-rose-200' :
                      permit.tipe === 'umum' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                      'bg-purple-100 text-purple-600 border-purple-200'
                    }`}>
                      {permit.tipe === 'umum' ? 'Wali Asuh → Wali Kelas' :
                       permit.tipe === 'catatan' ? 'Wali Kelas → Wali Asuh' :
                       'Dokter → Wali Asuh → Wali Kelas'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                  permit.status === 'approved' || permit.status === 'acknowledged' ? 'bg-emerald-500 text-white' :
                  permit.status.startsWith('pending') ? 'bg-amber-500 text-white' :
                  'bg-white text-slate-500 border border-slate-100'
                }`}>
                  {permit.status.replace('_', ' ')}
                </span>
                <Plus className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
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
