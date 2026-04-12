import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { AppUser, WALI_KELAS_LIST, IzinSakit } from '../types';
import { ClipboardList, Plus, Calendar, User, Activity, Clock, MapPin, Printer, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { generatePermitPDF } from '../pdfUtils';

interface DokterViewProps {
  user: AppUser;
}

export default function DokterView({ user }: DokterViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permits, setPermits] = useState<IzinSakit[]>([]);

  // Form states
  const [nomorSurat, setNomorSurat] = useState(`SRMA-${Date.now().toString().slice(-6)}`);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelas, setKelas] = useState('X-1');
  const [diagnosa, setDiagnosa] = useState('');
  const [jumlahHari, setJumlahHari] = useState(1);
  const [tglMulai, setTglMulai] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [waliKelas, setWaliKelas] = useState(WALI_KELAS_LIST[0].name);

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

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('dokter_uid', '==', user.uid),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit));
      setPermits(data);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (jumlahHari < 1) {
      alert('Jumlah hari minimal 1 hari');
      setLoading(false);
      return;
    }

    const startDate = new Date(tglMulai);
    const endDate = addDays(startDate, jumlahHari - 1);

    try {
      await addDoc(collection(db, 'izin_sakit'), {
        nomor_surat: nomorSurat,
        nama_siswa: namaSiswa,
        kelas: kelas,
        diagnosa: diagnosa,
        jumlah_hari: jumlahHari,
        tgl_mulai: Timestamp.fromDate(startDate),
        tgl_selesai: Timestamp.fromDate(endDate),
        tgl_surat: Timestamp.now(),
        lokasi: 'Kediri',
        nama_dokter: user.name || 'Dokter SRMA',
        nama_wali_kelas: waliKelas,
        status: 'pending_asuh',
        dokter_uid: user.uid,
      });
      setShowForm(false);
      // Reset form
      setNomorSurat(`SRMA-${Date.now().toString().slice(-6)}`);
      setNamaSiswa('');
      setDiagnosa('');
      setJumlahHari(1);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat surat izin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Dokter</h2>
          <p className="text-slate-500 text-sm">Kelola perizinan sakit siswa</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100"
        >
          {showForm ? 'Batal' : <><Plus className="w-5 h-5" /> Buat Surat</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              Form Input Perizinan
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <option key={wk.name} value={wk.name}>{wk.name} ({wk.kelas})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Diagnosa</label>
                <div className="relative">
                  <Activity className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    required
                    value={diagnosa}
                    onChange={(e) => setDiagnosa(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px]"
                    placeholder="Masukkan diagnosa dokter"
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
                  {loading ? 'Menyimpan...' : 'Simpan & Kirim ke Wali Asuh'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Riwayat Perizinan</h3>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">
            {permits.length} Total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diagnosa</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Durasi</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tgl Surat</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permits.map((permit) => (
                <tr key={permit.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{permit.nama_siswa}</div>
                    <div className="text-xs text-slate-500">Kelas {permit.kelas}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 line-clamp-1">{permit.diagnosa}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-900">{permit.jumlah_hari} Hari</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">
                      {format(permit.tgl_mulai.toDate(), 'dd MMM')} - {format(permit.tgl_selesai.toDate(), 'dd MMM')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      permit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      permit.status === 'pending_kelas' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {permit.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {format(permit.tgl_surat.toDate(), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    {permit.status === 'approved' && (
                      <button
                        onClick={() => handleGeneratePDF(permit)}
                        disabled={!!pdfLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                      >
                        {pdfLoading === permit.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat...</>
                        ) : (
                          <><Printer className="w-3.5 h-3.5" /> Cetak</>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {permits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    Belum ada data perizinan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
