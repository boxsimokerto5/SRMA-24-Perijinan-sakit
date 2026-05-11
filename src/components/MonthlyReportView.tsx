import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, Timestamp, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { MonthlyReport, Siswa, AppUser } from '../types';
import { format } from 'date-fns';
import { Plus, FileText, Download, Trash2, X, Star, Camera, Video, ChevronRight, Save, User, Image as ImageIcon, Loader2 } from 'lucide-react';
import { generateMonthlyReportPDF } from '../pdfUtils';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../imageUtils';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const YEARS = [2026, 2027, 2028];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function MonthlyReportView({ user }: { user: AppUser }) {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<MonthlyReport>>({
    periode_bulan: `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`,
    berat_badan: 0,
    tinggi_badan: 0,
    status_kesehatan: 'Sehat',
    ibadah_score: 5,
    adab_score: 5,
    kemandirian_score: 80,
    kemandirian_level: 'Mandiri',
    ekstrakurikuler: []
  });

  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [docPhotoFiles, setDocPhotoFiles] = useState<(File | null)[]>([null, null, null]);
  const [isUploading, setIsUploading] = useState(false);

  // Auto-cleanup functionality
  useEffect(() => {
    const performCleanup = async () => {
      // 2 months in milliseconds (approx)
      const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - TWO_MONTHS_MS);

      const oldReports = reports.filter(report => {
        const reportDate = report.createdAt instanceof Timestamp 
          ? report.createdAt.toDate() 
          : new Date();
        return reportDate < cutoffDate;
      });

      if (oldReports.length > 0) {
        console.log(`Cleaning up ${oldReports.length} old reports...`);
        for (const report of oldReports) {
          try {
            // 1. Delete documentation images from Storage
            for (const photoUrl of report.foto_kegiatan) {
              try {
                const photoRef = ref(storage, photoUrl);
                await deleteObject(photoRef);
              } catch (e) {
                console.warn("Failed to delete storage object (already gone or error):", e);
              }
            }

            // 2. Delete report from Firestore
            await deleteDoc(doc(db, 'monthly_reports', report.id!));
          } catch (error) {
            console.error("Cleanup error for report", report.id, error);
          }
        }
      }
    };

    if (reports.length > 0 && (user.role === 'wali_asuh' || user.role === 'kepala_sekolah')) {
      performCleanup();
    }
  }, [reports, user.role]);

  useEffect(() => {
    const reportsPath = 'monthly_reports';
    const q = query(collection(db, reportsPath), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyReport));
      setReports(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, reportsPath);
    });

    const studentsPath = 'siswa';
    const qStudents = query(collection(db, studentsPath), orderBy('nama_lengkap', 'asc'));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, studentsPath);
    });

    return () => {
      unsubscribe();
      unsubStudents();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsUploading(true);

    try {
      let fotoSiswaUrl = selectedStudent.foto_url || '';
      const documentationUrls: string[] = [];

      // 1. Upload Student Photo if changed
      if (studentPhotoFile) {
        const compressed = await compressImage(studentPhotoFile, 400, 0.7); // Small for profile
        const photoRef = ref(storage, `students/${selectedStudent.id}/profile_${Date.now()}.jpg`);
        await uploadBytes(photoRef, compressed);
        fotoSiswaUrl = await getDownloadURL(photoRef);
        
        // Update Siswa record too
        await updateDoc(doc(db, 'siswa', selectedStudent.id!), {
          foto_url: fotoSiswaUrl
        });
      }

      // 2. Upload Documentation Photos
      for (let i = 0; i < docPhotoFiles.length; i++) {
        const file = docPhotoFiles[i];
        if (file) {
          const compressed = await compressImage(file, 1000, 0.7); // Larger for documentation
          const docRef = ref(storage, `reports/${selectedStudent.id}/${Date.now()}_doc_${i}.jpg`);
          await uploadBytes(docRef, compressed);
          const url = await getDownloadURL(docRef);
          documentationUrls.push(url);
        }
      }

      const reportData: Omit<MonthlyReport, 'id'> = {
        siswa_id: selectedStudent.id!,
        nama_siswa: selectedStudent.nama_lengkap,
        kelas: selectedStudent.kelas,
        asrama: selectedStudent.asrama || '-',
        wali_asuh_name: user.name,
        wali_asuh_uid: user.uid,
        periode_bulan: formData.periode_bulan!,
        berat_badan: Number(formData.berat_badan),
        tinggi_badan: Number(formData.tinggi_badan),
        status_kesehatan: formData.status_kesehatan!,
        catatan_kesehatan: formData.catatan_kesehatan || '',
        ibadah_score: formData.ibadah_score!,
        adab_score: formData.adab_score!,
        kemandirian_score: Number(formData.kemandirian_score),
        kemandirian_level: formData.kemandirian_level!,
        karakter_deskripsi: formData.karakter_deskripsi || '',
        akademik_deskripsi: formData.akademik_deskripsi || '',
        ekstrakurikuler: formData.ekstrakurikuler || [],
        capaian_khusus: formData.capaian_khusus || '',
        foto_siswa_url: fotoSiswaUrl,
        foto_kegiatan: documentationUrls,
        video_url: formData.video_url || '',
        pesan_wali_asuh: formData.pesan_wali_asuh || '',
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'monthly_reports'), reportData);
      setShowForm(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'monthly_reports');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      periode_bulan: `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`,
      berat_badan: 0,
      tinggi_badan: 0,
      status_kesehatan: 'Sehat',
      ibadah_score: 5,
      adab_score: 5,
      kemandirian_score: 80,
      kemandirian_level: 'Mandiri',
      ekstrakurikuler: []
    });
    setSelectedStudent(null);
    setStudentPhotoFile(null);
    setDocPhotoFiles([null, null, null]);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus laporan ini?')) {
      try {
        await deleteDoc(doc(db, 'monthly_reports', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `monthly_reports/${id}`);
      }
    }
  };

  const toggleEskul = (eskul: string) => {
    const current = formData.ekstrakurikuler || [];
    if (current.includes(eskul)) {
      setFormData({ ...formData, ekstrakurikuler: current.filter(i => i !== eskul) });
    } else {
      setFormData({ ...formData, ekstrakurikuler: [...current, eskul] });
    }
  };

  const ESKUL_OPTIONS = ['Pramuka', 'IPSI', 'Paduan Suara', 'Jurnalistik', 'PMR', 'Menari', 'Voly', 'PIK-R'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Bulanan Siswa</h2>
          <p className="text-gray-500">Evaluasi tumbuh kembang bulanan santri</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Buat Laporan</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={report.id}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-teal-50 p-2 rounded-lg">
                  <FileText className="text-teal-600" size={24} />
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => generateMonthlyReportPDF(report)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-100"
                  >
                    <Download size={14} />
                    <span>Cetak PDF</span>
                  </button>
                  {user.uid === report.wali_asuh_uid && (
                    <button
                      onClick={() => handleDelete(report.id!)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <h4 className="font-bold text-gray-800 text-lg">{report.nama_siswa}</h4>
              <p className="text-sm text-gray-500 mb-2">{report.kelas} · {report.asrama}</p>
              
              <div className="flex items-center gap-2 mt-4 text-sm font-medium text-teal-700 bg-teal-50 px-3 py-1 rounded-full w-fit">
                {report.periode_bulan}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex flex-col">
                  <span className="text-gray-400 capitalize">Kesehatan</span>
                  <span className="font-semibold text-gray-700">{report.status_kesehatan}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400">Kemandirian</span>
                  <span className="font-semibold text-gray-700">{report.kemandirian_score}/100</span>
                </div>
              </div>
            </motion.div>
          ))}
          {reports.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Belum ada laporan bulanan yang diterbitkan.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-teal-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Laporan Tumbuh Kembang Bulanan</h3>
                  <p className="text-teal-100 text-sm">Input evaluasi perkembangan santri</p>
                </div>
                <button onClick={() => setShowForm(false)} className="hover:bg-teal-700 p-2 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-8">
                {/* Section 1: Identitas & Periode */}
                <div className="space-y-4">
                  <h4 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-100 pb-2">
                    <User size={18} />
                    <span>Identitas & Periode</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Pilih Siswa</label>
                      <select
                        required
                        className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        onChange={(e) => setSelectedStudent(students.find(s => s.id === e.target.value) || null)}
                      >
                        <option value="">-- Pilih Siswa --</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.nama_lengkap} ({s.kelas})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Foto Profil Santri</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                          {studentPhotoFile ? (
                            <img src={URL.createObjectURL(studentPhotoFile)} alt="Preview" className="w-full h-full object-cover" />
                          ) : selectedStudent?.foto_url ? (
                            <img src={selectedStudent.foto_url} alt="Current" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-full h-full p-2 text-gray-400" />
                          )}
                        </div>
                        <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                          <span>{selectedStudent?.foto_url || studentPhotoFile ? 'Ganti' : 'Upload'}</span>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => setStudentPhotoFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Periode Bulan</label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none"
                          onChange={(e) => {
                            const [year] = formData.periode_bulan!.split(' ').reverse();
                            setFormData({ ...formData, periode_bulan: `${e.target.value} ${year || 2026}` });
                          }}
                        >
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          className="w-24 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none"
                          onChange={(e) => {
                            const [month] = formData.periode_bulan!.split(' ');
                            setFormData({ ...formData, periode_bulan: `${month || 'Januari'} ${e.target.value}` });
                          }}
                        >
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Kesehatan & Fisik */}
                <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                  <h4 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-100 pb-2">
                    <Camera size={18} />
                    <span>Kesehatan & Fisik</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Berat Badan (kg)</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2 rounded-lg border border-gray-300"
                        value={formData.berat_badan}
                        onChange={e => setFormData({ ...formData, berat_badan: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Tinggi Badan (cm)</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2 rounded-lg border border-gray-300"
                        value={formData.tinggi_badan}
                        onChange={e => setFormData({ ...formData, tinggi_badan: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                      <select
                        className="w-full p-2 rounded-lg border border-gray-300"
                        onChange={e => setFormData({ ...formData, status_kesehatan: e.target.value })}
                      >
                        <option value="Sehat">Sehat</option>
                        <option value="Pemulihan">Pemulihan</option>
                        <option value="Sakit">Sakit</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Catatan Kesehatan</label>
                    <textarea
                      placeholder="Catatan kesehatan atau riwayat sakit bulan ini..."
                      className="w-full p-2 rounded-lg border border-gray-300 min-h-[60px]"
                      onChange={e => setFormData({ ...formData, catatan_kesehatan: e.target.value })}
                    />
                  </div>
                </div>

                {/* Section 3: Evaluasi Karakter */}
                <div className="space-y-4">
                  <h4 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-100 pb-2">
                    <Star size={18} />
                    <span>Evaluasi Karakter</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Kedisiplinan Ibadah</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, ibadah_score: star })}
                          >
                            <Star
                              size={28}
                              className={star <= (formData.ibadah_score || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Kesantunan & Adab</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, adab_score: star })}
                          >
                            <Star
                              size={28}
                              className={star <= (formData.adab_score || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Skor Kemandirian (0-100)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        className="w-full accent-teal-600"
                        value={formData.kemandirian_score}
                        onChange={e => setFormData({ ...formData, kemandirian_score: Number(e.target.value) })}
                      />
                      <div className="flex justify-between text-xs font-bold text-teal-600">
                        <span>{formData.kemandirian_score}</span>
                        <input 
                          type="text" 
                          placeholder="Level (e.g. Sangat Mandiri)" 
                          className="text-right border-none p-0 focus:ring-0 w-32"
                          onChange={e => setFormData({ ...formData, kemandirian_level: e.target.value })}
                          defaultValue="Mandiri"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Deskripsi Karakter</label>
                      <textarea
                        required
                        placeholder="Uraian perkembangan sikap dan perilaku..."
                        className="w-full p-2 rounded-lg border border-gray-300 min-h-[80px]"
                        onChange={e => setFormData({ ...formData, karakter_deskripsi: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Akademik & Minat Bakat */}
                <div className="p-4 bg-teal-50/30 rounded-xl space-y-4 border border-teal-100">
                  <h4 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-100 pb-2">
                    <FileText size={18} />
                    <span>Akademik & Minat Bakat</span>
                  </h4>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Evaluasi Belajar</label>
                    <textarea
                      required
                      placeholder="Perkembangan nilai, hafalan, atau pemahaman materi..."
                      className="w-full p-2 rounded-lg border border-gray-300 min-h-[80px]"
                      onChange={e => setFormData({ ...formData, akademik_deskripsi: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Ekstrakurikuler</label>
                    <div className="flex flex-wrap gap-2">
                      {ESKUL_OPTIONS.map(eskul => (
                        <button
                          key={eskul}
                          type="button"
                          onClick={() => toggleEskul(eskul)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            formData.ekstrakurikuler?.includes(eskul)
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50'
                          }`}
                        >
                          {eskul}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Capaian Khusus</label>
                    <input
                      type="text"
                      placeholder="Juara lomba, achievement spesial..."
                      className="w-full p-2.5 rounded-lg border border-gray-300"
                      onChange={e => setFormData({ ...formData, capaian_khusus: e.target.value })}
                    />
                  </div>
                </div>

                {/* Section 5: Lain-lain */}
                <div className="space-y-4">
                   <h4 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-100 pb-2">
                    <Video size={18} />
                    <span>Link Video & Pesan</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Link Video Pesan Ananda (URL)</label>
                      <input
                        type="url"
                        placeholder="https://youtube.com/..."
                        className="w-full p-2.5 rounded-lg border border-gray-300"
                        onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Pesan Wali Asuh</label>
                      <textarea
                        required
                        placeholder="Pesan penutup untuk orang tua..."
                        className="w-full p-2 rounded-lg border border-gray-300 min-h-[60px]"
                        onChange={e => setFormData({ ...formData, pesan_wali_asuh: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Dokumentasi Foto (Maks 3)</label>
                    <div className="grid grid-cols-3 gap-4">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="relative aspect-square bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 hover:border-teal-500 transition-colors flex flex-col items-center justify-center p-2 text-center text-gray-400 overflow-hidden group">
                          {docPhotoFiles[idx] ? (
                            <>
                              <img src={URL.createObjectURL(docPhotoFiles[idx]!)} alt="Doc" className="w-full h-full object-cover" />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newFiles = [...docPhotoFiles];
                                  newFiles[idx] = null;
                                  setDocPhotoFiles(newFiles);
                                }}
                                className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                              <ImageIcon size={24} className="mb-1" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Upload Foto {idx + 1}</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                  const newFiles = [...docPhotoFiles];
                                  newFiles[idx] = e.target.files?.[0] || null;
                                  setDocPhotoFiles(newFiles);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400">Format JPEG/PNG. Maks 3 foto dokumentasi kegiatan bulan ini.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className={`flex-1 ${isUploading ? 'bg-teal-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'} text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Sedang Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        <span>Simpan & Terbitkan Laporan</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
