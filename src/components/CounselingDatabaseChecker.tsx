import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Database, X, Clipboard, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface CounselingRecord {
  id: string;
  siswa_name?: string;
  student_name?: string;
  kelas?: string;
  tgl_konseling?: any;
  kategori?: string;
  kasus_kategori?: string;
  permasalahan?: string;
  uraian_masalah?: string;
  solusi?: string;
  tindakan_diambil?: string;
  perkembangan?: string;
  status_tindak_lanjut?: string;
  author_name?: string;
}

export default function CounselingDatabaseChecker({ currentUserEmail }: { currentUserEmail?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Checking counseling database...");
      const snapshot = await getDocs(collection(db, 'student_counselings'));
      const list: CounselingRecord[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRecords(list);
    } catch (err: any) {
      console.error("Failed to query student_counselings from browser:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen]);

  // Only render for specific admin/developer accounts to maintain privacy
  const allowedEmails = ['boxsimokerto5@gmail.com', 'proseshidup1101@gmail.com'];
  if (currentUserEmail && !allowedEmails.includes(currentUserEmail)) {
    return null;
  }

  const handleCopy = () => {
    const text = records.map((r, i) => {
      const dateStr = r.tgl_konseling?.seconds 
        ? new Date(r.tgl_konseling.seconds * 1000).toLocaleString('id-ID')
        : 'N/A';
      return `${i + 1}. SISWA: ${r.siswa_name || r.student_name || 'N/A'} (Kelas ${r.kelas || 'N/A'})
   Tanggal: ${dateStr}
   Kategori/Masalah: ${r.kategori || r.kasus_kategori || 'N/A'}
   Permasalahan: ${r.permasalahan || r.uraian_masalah || 'N/A'}
   Solusi: ${r.solusi || r.tindakan_diambil || 'N/A'}
   Penulis: ${r.author_name || 'N/A'}
   ---`;
    }).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-5 py-3.5 bg-slate-900 border-2 border-amber-400 text-white font-black text-[11px] uppercase tracking-widest rounded-full shadow-2xl hover:scale-105 hover:bg-black active:scale-95 transition-all animate-bounce"
        title="Check Counseling Database"
        id="btn_db_diagnostic"
      >
        <Database className="w-4 h-4 text-amber-400" />
        <span>Cek Database Konseling ({records.length})</span>
      </button>

      {/* Floating Panel / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border-b-8 border-slate-900 overflow-hidden font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-900 text-amber-400 rounded-2xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider leading-none">
                    Inspektor Database Catatan Konseling
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 italic leading-none">
                    Memeriksa data langsung dari Firestore (`student_counselings`)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-900" />
                  <p className="text-[10px] uppercase font-black tracking-widest animate-pulse">Menghubungi Cloud Firestore...</p>
                </div>
              )}

              {error && (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <h4 className="text-xs font-black uppercase">Gagal Mengakses Database</h4>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed font-mono opacity-80">{error}</p>
                </div>
              )}

              {!loading && !error && (
                <>
                  <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-3xl text-center">
                    <p className="text-xs font-black text-amber-800 uppercase tracking-wider">
                      STATISTIK CATATAN KONSELING
                    </p>
                    <p className="text-3xl font-black mt-1 text-slate-900">
                      {records.length}
                    </p>
                    <p className="text-[10px] text-amber-700/70 mt-1 italic font-medium">
                      total dokumen yang ada di dalam database Firestore saat ini
                    </p>
                  </div>

                  {records.length > 0 ? (
                    <div className="space-y-4 mt-2">
                      {records.map((rec, index) => {
                        const dateStr = rec.tgl_konseling?.seconds 
                          ? new Date(rec.tgl_konseling.seconds * 1000).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
                          : 'N/A';

                        return (
                          <div 
                            key={rec.id} 
                            className="p-5 bg-slate-50 border border-slate-200 rounded-3xl hover:border-slate-400 transition-all space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="px-2.5 py-1 bg-slate-900 text-white text-[9px] font-black rounded-lg uppercase tracking-wider">
                                  Dokumen: {rec.id.substring(0, 8)}...
                                </span>
                                <h4 className="text-sm font-black text-slate-900 mt-2">
                                  {rec.siswa_name || rec.student_name || 'Tanpa Nama'}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                  Kelas: {rec.kelas || 'N/A'} • Tanggal: {dateStr}
                                </p>
                              </div>
                              <span className="px-3 py-1 bg-amber-100 text-[#795548] text-[9px] font-black rounded-lg uppercase tracking-wider">
                                {rec.kategori || rec.kasus_kategori || 'Siswa'}
                              </span>
                            </div>

                            <div className="space-y-1.5 border-t border-slate-200/60 pt-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Uraian Masalah:</p>
                              <p className="text-xs text-slate-700 font-medium leading-relaxed italic bg-white p-3 rounded-2xl border border-slate-100">
                                "{rec.permasalahan || rec.uraian_masalah || '-'}"
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Solusi / Tindakan Diambil:</p>
                              <p className="text-xs text-emerald-800 font-medium leading-relaxed bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 italic">
                                "{rec.solusi || rec.tindakan_diambil || '-'}"
                              </p>
                            </div>

                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-200/40 pt-2.5">
                              <span>Wali Asuh: {rec.author_name || 'N/A'}</span>
                              <span className="text-emerald-600">Status: {rec.perkembangan || rec.status_tindak_lanjut || 'Selesai'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-xs font-black uppercase tracking-wider">Tidak Ada Catatan Ditemukan</p>
                      <p className="text-[10px] italic leading-relaxed max-w-sm mx-auto">
                        Koleksi `student_counselings` di database Anda kosong. Belum ada catatan konseling yang tersimpan.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button
                disabled={records.length === 0}
                onClick={handleCopy}
                className="flex items-center gap-2 px-5 py-3 bg-slate-150 active:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-4 h-4" />
                    <span>Salin Semua Data</span>
                  </>
                )}
              </button>
              <button
                onClick={fetchRecords}
                className="px-5 py-3 bg-slate-950 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Segarkan Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
