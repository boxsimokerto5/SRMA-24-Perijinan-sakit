import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, Timestamp, orderBy, deleteDoc, doc, serverTimestamp, updateDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { MonthlyReport, Siswa, AppUser } from '../types';
import { format } from 'date-fns';
import { Plus, FileText, Download, Trash2, X, Star, Camera, Video, ChevronRight, Save, User, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
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
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Auto-cleanup functionality - Run only once on mount
  useEffect(() => {
    let isMounted = true;
    const performCleanup = async () => {
      if (reports.length === 0 || !user.uid) return;
      
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // 2 months in milliseconds (approx)
      const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - TWO_MONTHS_MS);

      const oldReports = reports.filter(report => {
        const reportDate = report.createdAt instanceof Timestamp 
          ? report.createdAt.toDate() 
          : new Date();
        // Ensure we only try to clean up our own reports unless we are admin
        return reportDate < cutoffDate && (report.wali_asuh_uid === userId || user.role === 'kepala_sekolah');
      });

      if (oldReports.length > 0) {
        console.log(`Cleaning up ${oldReports.length} old reports...`);
        for (const report of oldReports) {
          if (!isMounted) break;
          try {
            // 1. Delete documentation images from Storage safely
            if (report.foto_kegiatan && Array.isArray(report.foto_kegiatan)) {
              for (const photoUrl of report.foto_kegiatan) {
                try {
                  if (photoUrl && photoUrl.includes('firebasestorage')) {
                    const photoRef = ref(storage, photoUrl);
                    await deleteObject(photoRef);
                  }
                } catch (e) {
                  console.warn("Failed to delete storage object (already gone or error):", e);
                }
              }
            }

            // 2. Delete report from Firestore
            await deleteDoc(doc(db, 'monthly_reports', report.id!));
          } catch (error) {
            console.error(`Cleanup failure for report ${report.id}:`, error);
            // Handle individual delete error but don't crash the whole cleanup
            try {
              handleFirestoreError(error, OperationType.DELETE, `monthly_reports/${report.id}`);
            } catch (innerErr) {
              // Ignore inner throw to allow cleanup to continue
            }
          }
        }
      }
    };

    if (loading === false && (user.role === 'wali_asuh' || user.role === 'kepala_sekolah')) {
      performCleanup();
    }

    return () => { isMounted = false; };
  }, [loading, user.role, user.uid, reports]); // Added user.uid and reports to deps for safety

  useEffect(() => {
    const reportsPath = 'monthly_reports';
    // Filter reports if not admin to comply with secure rules
    const q = user.role === 'wali_asuh'
      ? query(collection(db, reportsPath), where('wali_asuh_uid', '==', user.uid), orderBy('createdAt', 'desc'))
      : query(collection(db, reportsPath), orderBy('createdAt', 'desc'));

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
  }, [user.uid, user.role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsUploading(true);
    setUploadStatus('Menyiapkan data...');

    try {
      let fotoSiswaUrl = selectedStudent.foto_url || '';
      const batchTimestamp = Date.now();

      // 1. Compress and Upload Student Photo if changed
      if (studentPhotoFile) {
        setUploadStatus('Mengompres foto profil...');
        const compressed = await compressImage(studentPhotoFile, 400, 0.7);
        setUploadStatus('Mengunggah foto profil...');
        const photoRef = ref(storage, `students/${selectedStudent.id}/profile_${batchTimestamp}.jpg`);
        await uploadBytes(photoRef, compressed);
        fotoSiswaUrl = await getDownloadURL(photoRef);
        
        await updateDoc(doc(db, 'siswa', selectedStudent.id!), {
          foto_url: fotoSiswaUrl
        });
      }

      // 2. Parallel Compress and Upload Documentation Photos
      setUploadStatus('Memproses & mengunggah dokumentasi (0%)...');
      let completedCount = 0;
      const totalToUpload = docPhotoFiles.filter(f => f !== null).length;

      const uploadPromises = docPhotoFiles.map(async (file, i) => {
        if (!file) return null;
        // Compress - reduced to 800 for faster mobile upload
        const compressed = await compressImage(file, 800, 0.7);
        // Upload
        const docRef = ref(storage, `reports/${selectedStudent.id}/${batchTimestamp}_doc_${i}.jpg`);
        await uploadBytes(docRef, compressed);
        const url = await getDownloadURL(docRef);
        
        completedCount++;
        setUploadStatus(`Mengunggah dokumentasi (${Math.round((completedCount / totalToUpload) * 100)}%)...`);
        return url;
      });

      const results = await Promise.all(uploadPromises);
      const documentationUrls = results.filter((url): url is string => url !== null);

      setUploadStatus('Menyimpan laporan...');
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
      
      setUploadStatus('Berhasil!');
      setTimeout(() => {
        setShowForm(false);
        resetForm();
        setUploadStatus('');
      }, 1500);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Gagal mengunggah laporan. Silakan cek koneksi internet Anda atau coba kompres foto terlebih dahulu.');
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

  const getRecordDate = (fieldVal: any): Date | null => {
    if (!fieldVal) return null;
    if (typeof fieldVal.toDate === 'function') return fieldVal.toDate();
    if (fieldVal instanceof Date) return fieldVal;
    if (typeof fieldVal === 'string') return new Date(fieldVal);
    if (fieldVal.seconds) return new Date(fieldVal.seconds * 1000);
    return null;
  };

  const handleAutoFill = async () => {
    if (!selectedStudent) {
      alert('Silakan pilih siswa terlebih dahulu.');
      return;
    }

    setIsAutoFilling(true);
    try {
      const studentName = selectedStudent.nama_lengkap;
      const periodStr = formData.periode_bulan || `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
      const [monthName, yearStr] = periodStr.split(' ');
      const year = parseInt(yearStr) || new Date().getFullYear();
      const monthIndex = MONTHS.indexOf(monthName) !== -1 ? MONTHS.indexOf(monthName) : new Date().getMonth();
      const startRange = new Date(year, monthIndex, 1);
      const endRange = new Date(year, monthIndex + 1, 0, 23, 59, 59);

      const checkInPeriod = (dateObj: Date | null) => {
        if (!dateObj) return false;
        return dateObj >= startRange && dateObj <= endRange;
      };

      // 1. Fetch izin_sakit
      const izinSakitQuery = query(
        collection(db, 'izin_sakit'),
        where('nama_siswa', '==', studentName)
      );
      const izinSakitSnap = await getDocs(izinSakitQuery);
      const inPeriodIzin = izinSakitSnap.docs
        .map(doc => doc.data())
        .filter(data => {
          const d = getRecordDate(data.tgl_surat || data.tgl_mulai);
          return checkInPeriod(d);
        });

      // 2. Fetch jurnal_keperawatan
      const jurnalQuery = query(
        collection(db, 'jurnal_keperawatan'),
        where('nama_siswa', '==', studentName)
      );
      const jurnalSnap = await getDocs(jurnalQuery);
      const inPeriodJurnal = jurnalSnap.docs
        .map(doc => doc.data())
        .filter(data => {
          const d = getRecordDate(data.tgl_mulai);
          return checkInPeriod(d);
        });

      // 3. Fetch progress_records
      const progressQuery = query(
        collection(db, 'progress_records'),
        where('nama_siswa', '==', studentName)
      );
      const progressSnap = await getDocs(progressQuery);
      const inPeriodProgress = progressSnap.docs
        .map(doc => doc.data())
        .filter(data => {
          const d = getRecordDate(data.tgl_catatan);
          return checkInPeriod(d);
        });

      // 4. Fetch dormitory_incidents
      const incidentsQuery = query(
        collection(db, 'dormitory_incidents'),
        where('subject', '==', studentName)
      );
      const incidentsSnap = await getDocs(incidentsQuery);
      const inPeriodIncidents = incidentsSnap.docs
        .map(doc => doc.data())
        .filter(data => {
          const d = getRecordDate(data.date);
          return checkInPeriod(d);
        });

      // Process and Summarize Health
      let hStatus = 'Sehat';
      let hNotes = '';
      const sickLeaves = inPeriodIzin.filter(i => i.tipe === 'sakit');
      if (sickLeaves.length > 0 || inPeriodJurnal.length > 0) {
        hStatus = 'Pemulihan';
        const diagnoses = [
          ...sickLeaves.map(i => `${i.diagnosa || 'Sakit'} (${i.jumlah_hari || 1} hari)`),
          ...inPeriodJurnal.map(j => j.keterangan_sakit)
        ];
        hNotes = `Sempat menderita: ${Array.from(new Set(diagnoses)).join(', ')}.`;
      } else {
        hNotes = 'Kondisi fisik sangat sehat walafiat, aktif mengikuti seluruh rangkaian kegiatan sekolah dan asrama tanpa ada kendala medis.';
      }

      // Process and Summarize Academics
      let acadDesc = '';
      if (inPeriodProgress.length > 0) {
        const recordsText = inPeriodProgress.map(p => `"${p.isi_catatan}" (Oleh ${p.author_name})`).join('; ');
        acadDesc = `Menunjukkan partisipasi aktif. Catatan perkembangan guru: ${recordsText}.`;
      } else {
        acadDesc = 'Proses pembelajaran berjalan dengan sangat baik dan tertib. Nilai tugas harian stabil dan menunjukkan pemahaman materi pelajaran yang memuaskan.';
      }

      // Process and Summarize Discipline/Incidents
      let charDesc = '';
      let autoAdabScore = 5;
      let autoIbadahScore = 5;
      if (inPeriodIncidents.length > 0) {
        const incidentsText = inPeriodIncidents.map(i => `Kejadian ${i.incident_description} (Lokasi: ${i.asrama || 'Asrama'})`).join('. ');
        charDesc = `Ananda secara umum baik, namun terdapat catatan pembinaan: ${incidentsText}. Telah dilakukan bimbingan intensif dan resolusi masalah.`;
        autoAdabScore = Math.max(3, 5 - inPeriodIncidents.length);
      } else {
        charDesc = 'Menampilkan budi pekerti yang luhur, taat beribadah tepat waktu, serta menghormati ustadz/ustadzah dan sesama rekan santri dengan penuh kesantunan.';
      }

      // Build the automatic Message to Parents
      const autoPesan = `Alhamdulillah, ananda ${studentName} telah melewati bulan ${monthName} dengan penuh perjuangan. ${
        hStatus !== 'Sehat' ? 'Meskipun sempat memerlukan perawatan kesehatan singkat, ananda tetap menunjukkan semangat juang tinggi.' : 'Kondisi kesehatan ananda sangat prima bulan ini.'
      } Kami senantiasa mendoakan dan membimbing agar kedisiplinan, akademik, dan ibadah ananda terus meningkat ke tingkat yang lebih mulia. Mohon doa restu dari Bapak/Ibu sekalian.`;

      // Fill form data
      setFormData(prev => ({
        ...prev,
        status_kesehatan: hStatus,
        catatan_kesehatan: hNotes,
        akademik_deskripsi: acadDesc,
        karakter_deskripsi: charDesc,
        adab_score: autoAdabScore,
        ibadah_score: autoIbadahScore,
        pesan_wali_asuh: autoPesan
      }));

      alert(`✨ Rangkuman Berhasil Dibuat!\nDitemukan:\n• ${inPeriodIzin.length + inPeriodJurnal.length} Catatan Kesehatan\n• ${inPeriodProgress.length} Catatan Akademik\n• ${inPeriodIncidents.length} Catatan Kedisiplinan\n\nFormulir perkembangan bulanan telah diisi otomatis.`);
    } catch (err) {
      console.error('Error during auto fill: ', err);
      alert('Gagal melakukan rekapitulasi otomatis. Silakan isi form secara manual.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const getWhatsAppShareLink = (report: MonthlyReport) => {
    const starString = (score: number) => {
      return Array(score || 0).fill('⭐').join('');
    };

    const text = `*LAPORAN PERKEMBANGAN BULANAN*\n` +
      `*SRMA 24 KEDIRI*\n\n` +
      `*💡 Biodata Siswa:*\n` +
      `• *Siswa:* ${report.nama_siswa}\n` +
      `• *Kelas:* ${report.kelas}\n` +
      `• *Asrama:* ${report.asrama || '-'}\n` +
      `• *Periode:* ${report.periode_bulan}\n\n` +
      `*🩺 Perkembangan Fisik & Kesehatan:*\n` +
      `• *Tinggi / Berat:* ${report.tinggi_badan || 0} cm / ${report.berat_badan || 0} kg\n` +
      `• *Kondisi:* ${report.status_kesehatan || 'Sehat'}\n` +
      `• *Catatan:* ${report.catatan_kesehatan || '-'}\n\n` +
      `*⭐ Evaluasi Karakter & Kepribadian:*\n` +
      `• *Ibadah:* ${starString(report.ibadah_score)} (${report.ibadah_score || 0}/5)\n` +
      `• *Adab:* ${starString(report.adab_score)} (${report.adab_score || 0}/5)\n` +
      `• *Skor Kemandirian:* ${report.kemandirian_score || 0}/100 (${report.kemandirian_level || 'Mandiri'})\n` +
      `• *Deskripsi:* ${report.karakter_deskripsi || '-'}\n\n` +
      `*📚 Akademik & Minat Bakat:*\n` +
      `• *Evaluasi Belajar:* ${report.akademik_deskripsi || '-'}\n` +
      `• *Kegiatan Eskul:* ${report.ekstrakurikuler?.join(', ') || '-'}\n` +
      `• *Capaian Khusus:* ${report.capaian_khusus || '-'}\n\n` +
      `*🎥 Pesan Ananda & Wali Asuh:*\n` +
      `• *Link Video:* ${report.video_url || '-'}\n` +
      `• *Pesan Wali Asuh:* ${report.pesan_wali_asuh || '-'}\n\n` +
      `------------------------\n` +
      `_Laporan ini dikirim melalui Sistem Informasi SRMA 24 Kediri_`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-xl overflow-hidden border border-slate-950 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-white/5 shrink-0">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Laporan Bulanan</h1>
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">
                  REKAPITULASI
                </span>
              </div>
              <p className="text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest italic">
                Evaluasi Tumbuh Kembang Peserta Didik
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="group px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 border-b-4 border-emerald-800 italic"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            Buat Laporan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
          <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs italic">Memuat Laporan...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, idx) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              key={report.id}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-900/5 transition-all relative group overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-slate-50 rounded-[1.25rem] flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                  <FileText className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={24} />
                </div>
                <div className="flex gap-2">
                  <a
                    href={getWhatsAppShareLink(report)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-emerald-100 flex items-center justify-center"
                    title="Kirim Laporan via WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" stroke="none">
                      <path d="M12 .002c-6.627 0-12 5.373-12 12 0 2.159.57 4.187 1.564 5.947l-1.564 5.717 5.86-1.53c1.7.94 3.642 1.47 5.704 1.47 6.628 0 12-5.373 12-12s-5.372-12-12-12zm6.209 15.885c-.269.756-1.566 1.429-2.158 1.517-.514.077-1.18.14-1.91-.093-.456-.146-1.022-.357-1.748-.673-3.155-1.373-5.184-4.57-5.342-4.783-.158-.211-1.282-1.713-1.282-3.267v-.002c0-1.42.716-2.146 1.001-2.438.257-.263.666-.392 1.077-.392.128 0 .245.006.35.011.309.011.52.023.743.514.28.618.96 2.339 1.042 2.51.082.17.135.369.023.597-.101.21-.164.339-.328.531-.164.193-.344.433-.491.58-.164.163-.334.34-.143.668.191.319.851 1.4 1.821 2.261.97.861 2.459 1.488 2.822 1.637.363.15.576.126.791-.122s.918-1.071 1.164-1.439c.246-.368.497-.305.828-.182.332.123 2.102 1.05 2.438 1.218.336.168.56.249.643.393.082.144.082.833-.188 1.589z" />
                    </svg>
                  </a>
                  <button
                    onClick={() => generateMonthlyReportPDF(report)}
                    className="p-2.5 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-xl transition-all border border-slate-100"
                    title="Unduh PDF"
                  >
                    <Download size={16} />
                  </button>
                  {user.uid === report.wali_asuh_uid && (
                    <button
                      onClick={() => handleDelete(report.id!)}
                      className="p-2.5 bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-slate-100"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight italic font-display">{report.nama_siswa}</h4>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-lg border border-slate-200">
                    {report.kelas}
                  </span>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{report.asrama}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-6 text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl w-fit uppercase tracking-widest border border-emerald-100 italic">
                {report.periode_bulan}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1 italic">Kesehatan</span>
                  <span className="text-[11px] font-black text-slate-700 uppercase italic leading-none">{report.status_kesehatan}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1 italic">Kemandirian</span>
                  <span className="text-[11px] font-black text-slate-700 uppercase italic leading-none">{report.kemandirian_score}/100</span>
                </div>
              </div>
            </motion.div>
          ))}
          {reports.length === 0 && (
            <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">
              <FileText size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] italic">Belum ada laporan bulanan diterbitkan</p>
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
                  <p className="text-teal-100 text-sm">Input evaluasi perkembangan peserta didik</p>
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
                      <label className="text-sm font-semibold text-gray-700">Foto Profil Peserta Didik</label>
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

                    {selectedStudent && (
                      <div className="md:col-span-3 flex justify-end pt-3">
                        <button
                          type="button"
                          onClick={handleAutoFill}
                          disabled={isAutoFilling}
                          className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                        >
                          {isAutoFilling ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Mengkonsolidasi & Merangkum Log Perkembangan...</span>
                            </>
                          ) : (
                            <>
                              <span>✨ Rangkum Otomatis dari Log Bulan Ini</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
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
                        <span>{uploadStatus || 'Sedang Mengunggah...'}</span>
                      </>
                    ) : uploadStatus === 'Berhasil!' ? (
                      <>
                        <CheckCircle2 size={20} />
                        <span>Laporan Terbit!</span>
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
