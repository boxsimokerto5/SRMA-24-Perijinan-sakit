import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST, Memorandum } from '../types';
import { notifyUserByRole } from '../services/fcmService';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2, Plus, MapPin, ClipboardList, CheckCircle2, MessageSquare, Send, Mail, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { generatePermitPDF, generateMemorandumPDF } from '../pdfUtils';

interface WaliKelasViewProps {
  user: AppUser;
}

export default function WaliKelasView({ user }: WaliKelasViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [memos, setMemos] = useState<Memorandum[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [showCatatanForm, setShowCatatanForm] = useState(false);

  // Form states for Catatan Siswa
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [isiCatatan, setIsiCatatan] = useState('');

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('status', 'in', ['pending_kelas', 'approved', 'pending_ack', 'acknowledged']),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit));
      // Filter by wali kelas name if user has one (or just show all for demo)
      setPermits(data);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'memorandums'),
      where('penerima', 'array-contains', 'wali_kelas'),
      orderBy('tgl_memo', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memorandum));
      setMemos(data);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (permitId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'izin_sakit', permitId), {
        status: 'approved',
        wali_kelas_uid: user.uid,
      });

      // Notify Dokter
      notifyUserByRole('dokter', 'Izin Disetujui', `Izin sakit siswa telah disetujui oleh Wali Kelas.`);
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui perizinan');
    } finally {
      setLoading(false);
    }
  };

  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

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

  const handleSubmitCatatan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        tipe: 'catatan',
        nomor_surat: `SRMA-C-${Date.now().toString().slice(-6)}`,
        nama_siswa: namaSiswa,
        kelas: kelas,
        isi_catatan: isiCatatan,
        tgl_surat: Timestamp.now(),
        nama_wali_kelas: user.name,
        wali_kelas_uid: user.uid,
        status: 'pending_ack',
      });

      // Notify Wali Asuh
      notifyUserByRole('wali_asuh', 'Catatan Siswa Baru', `Wali Kelas ${user.name} mengirimkan catatan penting untuk siswa ${namaSiswa}.`);

      setShowCatatanForm(false);
      setNamaSiswa('');
      setIsiCatatan('');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim catatan');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: permits.length,
    pending: permits.filter(p => p.status === 'pending_kelas').length,
    selesai: permits.filter(p => p.status === 'approved' || p.status === 'acknowledged').length,
    memos: memos.length
  };

  return (
    <div className="space-y-8">
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
      </div>

      {showCatatanForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Input Catatan Penting Siswa
            </h3>
          </div>
          <form onSubmit={handleSubmitCatatan} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Isi Catatan / Perkembangan</label>
                <div className="relative">
                  <ClipboardList className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    required
                    value={isiCatatan}
                    onChange={(e) => setIsiCatatan(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px]"
                    placeholder="Contoh: Siswa mengalami penurunan fokus belajar..."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Kirim ke Wali Asuh</>}
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
        {permits.map((permit) => (
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

      {/* Floating Action Button (FAB) */}
      <button 
        onClick={() => setShowCatatanForm(true)}
        className="fixed bottom-24 right-6 bg-indigo-950 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-30 hover:scale-105 transition-transform active:scale-95"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-black uppercase tracking-widest">Buat Catatan Baru</span>
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
                  <p className="font-bold text-slate-900">{selectedPermit.nama_siswa}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</label>
                  <p className="font-bold text-slate-900">{selectedPermit.kelas}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diagnosa Medis</label>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedPermit.diagnosa}</p>
                </div>
              </div>

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
                      selectedPermit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      selectedPermit.status === 'pending_kelas' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {selectedPermit.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

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
              {selectedPermit.status === 'approved' && (
                <button
                  onClick={() => {
                    handleGeneratePDF(selectedPermit);
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

      {/* Modal Konfirmasi Persetujuan */}
      {confirmApproveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Konfirmasi Setujui</h3>
              <p className="text-slate-500 text-sm">
                Apakah Anda yakin ingin menyetujui perizinan sakit siswa ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setConfirmApproveId(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleApprove(confirmApproveId);
                  setConfirmApproveId(null);
                }}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Setujui'}
              </button>
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
    </div>
  );
}
