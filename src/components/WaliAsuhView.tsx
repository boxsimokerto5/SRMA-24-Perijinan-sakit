import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { AppUser, IzinSakit } from '../types';
import { notifyUserByRole } from '../services/fcmService';
import { Home, MessageSquare, Send, Clock, User, Printer, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { generatePermitPDF } from '../pdfUtils';

interface WaliAsuhViewProps {
  user: AppUser;
}

export default function WaliAsuhView({ user }: WaliAsuhViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [catatanKamar, setCatatanKamar] = useState<{ [key: string]: string }>({});

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
          <p className="text-slate-500 text-sm">Verifikasi lokasi kamar siswa sakit</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-600">
          <Home className="w-4 h-4" />
          {permits.filter(p => p.status === 'pending_asuh').length} Antrean
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {permits.map((permit) => (
          <div key={permit.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
            permit.status === 'approved' ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-200'
          }`}>
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`${permit.status === 'approved' ? 'bg-emerald-100' : 'bg-indigo-50'} p-3 rounded-xl`}>
                  {permit.status === 'approved' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Home className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">{permit.nama_siswa}</h3>
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
                    <span className="font-semibold text-slate-700">Diagnosa:</span> {permit.diagnosa}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {format(permit.tgl_surat.toDate(), 'dd/MM/yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {permit.jumlah_hari} Hari
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Dr. {permit.nama_dokter}
                    </span>
                    {permit.catatan_kamar && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <Home className="w-3.5 h-3.5" /> {permit.catatan_kamar}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
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
    </div>
  );
}
