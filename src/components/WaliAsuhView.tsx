import React, { useState } from 'react';
import { Home, MessageSquare, Send, Clock, User, Printer, Loader2, CheckCircle2, Calendar, Plus, MapPin, ClipboardList, Activity, FileText } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { AppUser, IzinSakit, WALI_KELAS_LIST } from '../types';
import { notifyUserByRole } from '../services/fcmService';
import { format, addDays } from 'date-fns';
import { generatePermitPDF } from '../pdfUtils';

interface WaliAsuhViewProps {
  user: AppUser;
}

export default function WaliAsuhView({ user }: WaliAsuhViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [selectedPermit, setSelectedPermit] = useState<IzinSakit | null>(null);
  const [catatanKamar, setCatatanKamar] = useState<{ [key: string]: string }>({});

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
      where('status', 'in', ['pending_asuh', 'approved']),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit));
      setPermits(data);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Wali Asuh</h2>
          <p className="text-slate-500 text-sm">Kelola perizinan anak asuh</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100"
          >
            {showForm ? 'Batal' : <><Plus className="w-5 h-5" /> Izin Umum</>}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-600">
            <Home className="w-4 h-4" />
            {permits.filter(p => p.status === 'pending_asuh').length} Antrean
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

      <div className="grid grid-cols-1 gap-4">
        {permits.map((permit) => (
          <div 
            key={permit.id} 
            onClick={() => setSelectedPermit(permit)}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all cursor-pointer group ${
            permit.status === 'approved' ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
          }`}>
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`${permit.status === 'approved' ? 'bg-emerald-100' : 'bg-indigo-50'} p-3 rounded-xl group-hover:scale-105 transition-transform`}>
                  {permit.status === 'approved' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : permit.tipe === 'umum' ? (
                    <FileText className="w-6 h-6 text-indigo-600" />
                  ) : (
                    <Home className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">{permit.nama_siswa}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      permit.tipe === 'umum' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {permit.tipe === 'umum' ? 'Izin Umum' : 'Izin Sakit'}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded">
                      Kelas {permit.kelas}
                    </span>
                    {permit.status === 'approved' && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">
                        Selesai
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{permit.tipe === 'umum' ? 'Alasan:' : 'Diagnosa:'}</span> {permit.tipe === 'umum' ? permit.alasan : permit.diagnosa}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd/MM/yyyy') : '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {permit.jumlah_hari} Hari
                    </span>
                    {permit.tipe === 'sakit' && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Dr. {permit.nama_dokter}
                      </span>
                    )}
                    {permit.catatan_kamar && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <Home className="w-3.5 h-3.5" /> {permit.catatan_kamar}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:items-end gap-3 w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
                {permit.status === 'pending_asuh' ? (
                  <>
                    <div className="w-full md:w-64">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Catatan Kamar</label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Contoh: Kamar A25"
                          value={catatanKamar[permit.id!] || ''}
                          onChange={(e) => setCatatanKamar({ ...catatanKamar, [permit.id!]: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdateStatus(permit.id!)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
                    >
                      <Send className="w-4 h-4" />
                      Kirim ke Wali Kelas
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleGeneratePDF(permit)}
                    disabled={!!pdfLoading}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
                  >
                    {pdfLoading === permit.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</>
                    ) : (
                      <><Printer className="w-4 h-4" /> Cetak PDF</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {permits.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="inline-flex p-4 bg-slate-50 rounded-full mb-4">
              <Home className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-bold">Tidak Ada Antrean</h3>
            <p className="text-slate-500 text-sm mt-1">Semua perizinan telah diproses.</p>
          </div>
        )}
      </div>

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
            
            <div className="p-8 space-y-6">
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedPermit.tipe === 'umum' ? 'Alasan Izin' : 'Diagnosa Medis'}</label>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedPermit.tipe === 'umum' ? selectedPermit.alasan : selectedPermit.diagnosa}</p>
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
    </div>
  );
}
