import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { AppUser, IzinSakit } from '../types';
import { CheckSquare, Printer, Check, X, FileText, User, Calendar, Home, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { generatePermitPDF } from '../pdfUtils';

interface WaliKelasViewProps {
  user: AppUser;
}

export default function WaliKelasView({ user }: WaliKelasViewProps) {
  const [permits, setPermits] = useState<IzinSakit[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const q = query(
      collection(db, 'izin_sakit'),
      where('status', 'in', ['pending_kelas', 'approved']),
      orderBy('tgl_surat', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IzinSakit));
      // Filter by wali kelas name if user has one (or just show all for demo)
      setPermits(data);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Wali Kelas</h2>
          <p className="text-slate-500 text-sm">Persetujuan akhir dan cetak surat izin</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-600">
          <CheckSquare className="w-4 h-4" />
          {permits.filter(p => p.status === 'pending_kelas').length} Menunggu
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Daftar Perizinan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detail Sakit</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kamar</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
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
                    <div className="text-sm text-slate-600 font-medium">{permit.diagnosa}</div>
                    <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                      {permit.jumlah_hari} Hari ({format(permit.tgl_mulai.toDate(), 'dd/MM')} - {format(permit.tgl_selesai.toDate(), 'dd/MM')})
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Home className="w-3.5 h-3.5 text-slate-400" />
                      {permit.catatan_kamar || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      permit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {permit.status === 'approved' ? 'Approved' : 'Pending Approval'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {permit.status === 'pending_kelas' ? (
                        <button
                          onClick={() => handleApprove(permit.id!)}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          <Check className="w-3.5 h-3.5" /> Setujui
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGeneratePDF(permit)}
                          disabled={!!pdfLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                        >
                          {pdfLoading === permit.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat...</>
                          ) : (
                            <><Printer className="w-3.5 h-3.5" /> Cetak PDF</>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {permits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    Belum ada data perizinan untuk disetujui.
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
