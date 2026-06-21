import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Sparkles, 
  AlertCircle, 
  Save,
  HelpCircle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { AppUser, JadwalMengajar } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface JadwalMengajarViewProps {
  user: AppUser;
  schedules: JadwalMengajar[];
}

const INDONESIAN_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const STANDARD_CLASSES = [
  '10-A', '10-B', '10-C', '10-D',
  '11-A', '11-B', '11-C', '11-D',
  '12-A', '12-B', '12-C', '12-D'
];
const COMMON_MAPEL = [
  'Matematika', 
  'Fisika', 
  'Kimia', 
  'Biologi', 
  'Bahasa Indonesia', 
  'Bahasa Inggris', 
  'Informatika',
  'Pendidikan Pancasila / PPKn',
  'Pendidikan Agama Islam',
  'Sejarah',
  'Geografi',
  'Ekonomi',
  'Sosiologi',
  'PJOK',
  'Seni Budaya',
];
const STANDARD_TIME_SLOTS = [
  { label: 'Jam 1-2 (07:30 - 09:00)', mulai: '07:30', selesai: '09:00' },
  { label: 'Jam 3-4 (09:15 - 10:45)', mulai: '09:15', selesai: '10:45' },
  { label: 'Jam 5-6 (10:45 - 12:15)', mulai: '10:45', selesai: '12:15' },
  { label: 'Jam 7-8 (13:00 - 14:30)', mulai: '13:00', selesai: '14:30' },
  { label: 'Jam 9-10 (14:30 - 16:00)', mulai: '14:30', selesai: '16:00' },
];

export const JadwalMengajarView: React.FC<JadwalMengajarViewProps> = ({ user, schedules }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields State
  const [hari, setHari] = useState('Senin');
  const [kelas, setKelas] = useState('');
  const [mapel, setMapel] = useState(user.mapel || '');
  const [jamMulai, setJamMulai] = useState('07:30');
  const [jamSelesai, setJamSelesai] = useState('09:00');

  // Filter and grouping states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPreviewDay, setSelectedPreviewDay] = useState<string | 'semua'>('semua');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Map day to current Date-fns day of week to find "Today's Schedule"
  const getIndonesianDayNameOfToday = () => {
    const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
    const translation = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return translation[dayIndex];
  };

  const todayDayName = getIndonesianDayNameOfToday();

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const finalKelas = kelas.trim();
    const finalMapel = mapel.trim();
    
    if (!finalKelas) {
      setErrorMsg('Kelas tidak boleh kosong');
      setLoading(false);
      return;
    }

    if (!finalMapel) {
      setErrorMsg('Mata Pelajaran tidak boleh kosong');
      setLoading(false);
      return;
    }

    if (jamMulai >= jamSelesai) {
      setErrorMsg('Jam mulai harus lebih awal dari jam selesai');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        guru_uid: user.uid,
        guru_name: user.name || 'Guru',
        mapel: finalMapel,
        hari,
        kelas: finalKelas,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        createdAt: Timestamp.now()
      };

      const path = 'jadwal_mengajar';
      await addDoc(collection(db, path), payload);

      setSuccessMsg(`Jadwal mengajar kelas ${finalKelas} hari ${hari} berhasil dimasukkan!`);
      setKelas('');
      
      // Auto dismiss success toast
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg('Gagal menyimpan jadwal. Silakan periksa koneksi Anda.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Schedule
  const handleDelete = async (id: string, kelasInfo: string, hariInfo: string) => {
    try {
      const path = 'jadwal_mengajar';
      await deleteDoc(doc(db, path, id));
      setSuccessMsg(`Jadwal mengajar kelas ${kelasInfo} pada hari ${hariInfo} berhasil dihapus.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menghapus jadwal.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  // Sort and group helper
  const sortSchedules = (list: JadwalMengajar[]) => {
    return [...list].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  };

  // Generate grouped schedules
  const sortedSchedules = sortSchedules(schedules);
  const todaySchedules = sortedSchedules.filter(s => s.hari === todayDayName);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#3e2723] font-display italic tracking-tight">
              KELOLA JADWAL MENGAJAR
            </h2>
            <span className="bg-[#ebdccb] text-[#3e2723] px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">
              MAPEL: {user.mapel || 'UTAMA'}
            </span>
          </div>
          <p className="text-stone-400 text-[9px] font-bold uppercase tracking-wider block mt-1">
            Susun jadwal KBM interaktif dan rapi untuk kemudahan mengajar harian Anda
          </p>
        </div>
        <div className="w-10 h-10 bg-[#3e2723] rounded-2xl flex items-center justify-center text-white shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
          <Calendar className="w-5 h-5 text-amber-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form input jadwal */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-[#d7ccc8]/40 shadow-sm relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-12 -mt-12 opacity-50 pointer-events-none" />
            
            {/* Header Trigger */}
            <button 
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="flex items-center justify-between w-full text-left focus:outline-none select-none group"
            >
              <div className="flex items-center gap-2">
                <Plus className={`w-4 h-4 text-amber-700 transition-transform duration-300 ${isFormOpen ? 'rotate-45' : ''}`} />
                <h3 className="font-black text-[#3e2723] text-sm uppercase tracking-tight italic">
                  Form Input Jadwal
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] bg-stone-100 text-[#3e2723] px-2 py-0.5 rounded font-black tracking-wider uppercase group-hover:bg-[#ebdccb]/50 transition-colors">
                  {isFormOpen ? 'Sembunyikan' : 'Buka Form'}
                </span>
                {isFormOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#3e2723]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400" />
                )}
              </div>
            </button>

            {/* Toggleable Form Body */}
            <AnimatePresence initial={false}>
              {isFormOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleSubmit} className="space-y-5 pt-1">
                    
                    {/* Mata Pelajaran */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                        Mata Pelajaran (MAPEL)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400">
                          <BookOpen className="w-4 h-4 text-[#8b5e3c]" />
                        </span>
                        <input
                          type="text"
                          value={mapel}
                          onChange={(e) => setMapel(e.target.value)}
                          placeholder="Contoh: Matematika, Bahasa Inggris"
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Hari Mengajar */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                        Hari Mengajar
                      </label>
                      <select
                        value={hari}
                        onChange={(e) => setHari(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                      >
                        {INDONESIAN_DAYS.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    {/* Kelas */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                        Kelas Pembelajaran
                      </label>
                      <input
                        type="text"
                        value={kelas}
                        onChange={(e) => setKelas(e.target.value)}
                        placeholder="Contoh: 10-A, 11-B, VII-C"
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-[#3e2723] transition-colors"
                        required
                      />
                    </div>

                    {/* Waktu Mengajar (Pilih Jam Start s/d End) */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#5d4037] block">
                        Jam / Waktu Mengajar
                      </label>
                      <div className="grid grid-cols-11 items-center gap-1.5">
                        <div className="col-span-5 space-y-1">
                          <span className="text-[9px] font-bold text-stone-400 block">Mulai</span>
                          <input
                            type="time"
                            value={jamMulai}
                            onChange={(e) => setJamMulai(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2 px-2 text-xs font-semibold text-center focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                            required
                          />
                        </div>
                        
                        <div className="col-span-1 flex justify-center pt-4">
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-tight">s.d</span>
                        </div>
                        
                        <div className="col-span-5 space-y-1">
                          <span className="text-[9px] font-bold text-stone-400 block">Selesai</span>
                          <input
                            type="time"
                            value={jamSelesai}
                            onChange={(e) => setJamSelesai(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2 px-2 text-xs font-semibold text-center focus:outline-none focus:border-[#3e2723] transition-colors cursor-pointer"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Feedback messages inside card */}
                    <AnimatePresence mode="wait">
                      {successMsg && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/50 text-amber-900 text-[10px] font-bold flex items-start gap-2.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{successMsg}</span>
                        </motion.div>
                      )}

                      {errorMsg && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/50 text-rose-900 text-[10px] font-bold flex items-start gap-2.5"
                        >
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{errorMsg}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#3e2723] hover:bg-[#5d4037] text-white py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 duration-200"
                    >
                      {loading ? (
                        <span className="inline-block w-4 h-4 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-amber-200" />
                          <span>Tambahkan Jadwal</span>
                        </>
                      )}
                    </button>

                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Schedule Display Board */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TODAY SCHEDULE DISPLAY WIDGET */}
          <div className="bg-gradient-to-r from-[#3e2723] to-[#5d4037] rounded-[2rem] p-4 sm:p-5 text-white shadow-xl relative overflow-hidden border border-[#5d4037] flex flex-col md:grid md:grid-cols-12 md:items-center gap-5">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            
            {/* Widget Title & Active Day (Left Column) */}
            <div className="relative z-10 md:col-span-5 space-y-2 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-400/10 rounded-lg flex items-center justify-center text-amber-300 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-black font-display text-xs tracking-tight italic uppercase text-amber-200">
                    JADWAL HARI INI
                  </h3>
                  <span className="bg-amber-400 text-[#3e2723] px-2 py-0.5 rounded-full text-[6.5px] font-black uppercase tracking-wider leading-none">
                    {todayDayName}
                  </span>
                </div>
              </div>
              <p className="text-[9px] text-[#ebdccb] font-bold uppercase tracking-wider leading-relaxed block pl-0.5">
                Memudahkan Anda memantau seluruh jam mengajar harian secara instan dan tepat waktu.
              </p>
            </div>

            {/* List of Today's Classes (Right Column - Dynamic & Slim layout) */}
            <div className="relative z-10 md:col-span-7 w-full text-left">
              {todaySchedules.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {todaySchedules.map((schedule, i) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 px-3.5 rounded-2xl flex items-center justify-between transition-colors relative overflow-hidden group text-left"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="bg-amber-400 text-[#3e2723] px-1.5 py-0.5 rounded text-[6.5px] font-black uppercase tracking-widest block w-max leading-none">
                          {schedule.mapel}
                        </span>
                        <h4 className="text-xs font-black italic font-display uppercase leading-tight tracking-tight text-white mt-1 truncate">
                          KELAS {schedule.kelas}
                        </h4>
                        <div className="flex items-center gap-1 text-[#ebdccb] text-[8.5px] font-semibold leading-none mt-0.5">
                          <Clock className="w-3 h-3 text-amber-300 shrink-0" />
                          <span>{schedule.jam_mulai} - {schedule.jam_selesai}</span>
                        </div>
                      </div>
                      
                      <div className="p-1.5 rounded-xl bg-white/5 text-amber-200 shrink-0 group-hover:translate-x-0.5 transition-transform">
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-5 px-4 text-center sm:text-left sm:flex sm:items-center sm:justify-between bg-white/5 rounded-2xl border border-dashed border-white/10 gap-3">
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                    <div className="text-left">
                      <p className="font-bold text-[10px] uppercase tracking-widest text-[#d7ccc8]">
                        Tidak ada kelas hari ini
                      </p>
                      <p className="text-[8px] text-stone-300 uppercase tracking-wider font-semibold mt-0.5">
                        Nikmati waktu istirahat atau persiapkan materi berkualitas
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WEEKLY TIMETABLE DISPLAY SHEET */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-[#d7ccc8]/40 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                <h3 className="font-black text-[#3e2723] text-sm uppercase tracking-tight italic">
                  Tinjauan Jadwal Mingguan
                </h3>
              </div>
              
              {/* Day filter selectors */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedPreviewDay('semua')}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                    selectedPreviewDay === 'semua'
                      ? 'bg-[#3e2723] text-white shadow-md'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  Semua
                </button>
                {INDONESIAN_DAYS.map(day => {
                  const hasSchedulesForThisDay = sortedSchedules.some(s => s.hari === day);
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedPreviewDay(day)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                        selectedPreviewDay === day
                          ? 'bg-[#3e2723] text-white border-transparent'
                          : hasSchedulesForThisDay
                            ? 'bg-amber-50/50 border-amber-200 text-amber-800 font-black'
                            : 'bg-stone-50 border-stone-100 text-stone-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Displaying schedules grouping */}
            <div className="space-y-6">
              {INDONESIAN_DAYS.filter(day => selectedPreviewDay === 'semua' || selectedPreviewDay === day).map(day => {
                const daySchedules = sortedSchedules.filter(s => s.hari === day);

                if (daySchedules.length === 0) {
                  // Only show placeholder if specifically looking at that day
                  if (selectedPreviewDay !== 'semua') {
                    return (
                      <div key={day} className="text-center py-16 bg-stone-50 rounded-[2rem] border border-stone-200/40">
                        <HelpCircle className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                        <p className="font-black text-[#3e2723] text-xs uppercase tracking-widest">
                          Belum Ada Jadwal Di Hari {day}
                        </p>
                        <p className="text-[9px] text-stone-400 font-black uppercase mt-1 tracking-wider leading-relaxed">
                          Gunakan panel input sebelah kiri untuk menyusun jadwal pembelajaran Anda
                        </p>
                      </div>
                    );
                  }
                  return null;
                }

                return (
                  <div key={day} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-1 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${day === todayDayName ? 'bg-amber-500 animate-ping' : 'bg-[#3e2723]'}`} />
                        <h4 className="font-black text-[#3e2723] text-sm uppercase tracking-tight italic">
                          HARI {day}
                        </h4>
                      </div>
                      <span className="text-[9px] font-black text-stone-400 uppercase tracking-wider leading-none">
                        {daySchedules.length} Kelas
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {daySchedules.map((schedule) => {
                        const isConfirming = confirmingDeleteId === schedule.id;
                        return (
                          <div
                            key={schedule.id}
                            className="group relative bg-[#fcfaf6] p-4 rounded-[1.8rem] border border-[#ebdccb]/50 shadow-sm hover:shadow hover:bg-stone-50 transition-all text-left flex items-center justify-between"
                          >
                            <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-[#8b5e3c] bg-[#f8f3ed] px-2 py-0.5 rounded border border-[#ebdccb]/40">
                                {schedule.mapel}
                              </span>
                              <h5 className="font-display font-black text-sm text-[#3e2723] uppercase tracking-tight mt-1">
                                Kelas {schedule.kelas}
                              </h5>
                              <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-bold leading-none mt-1">
                                <Clock className="w-3.5 h-3.5 text-stone-400" />
                                <span>{schedule.jam_mulai} - {schedule.jam_selesai} WIB</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isConfirming ? (
                                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                  <button
                                    onClick={() => {
                                      handleDelete(schedule.id!, schedule.kelas, schedule.hari);
                                      setConfirmingDeleteId(null);
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors"
                                  >
                                    Yakin?
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(schedule.id || null)}
                                  className="bg-transparent hover:bg-rose-50 border border-transparent hover:border-rose-100 p-2 text-stone-400 hover:text-rose-600 transition-colors"
                                  title="Hapus Jadwal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {sortedSchedules.length === 0 && selectedPreviewDay === 'semua' && (
                <div className="text-center py-24 bg-stone-50 rounded-[2.5rem] border border-stone-200/40">
                  <Calendar className="w-12 h-12 text-[#ebdccb] mx-auto mb-4" />
                  <p className="font-black text-[#3e2723] text-xs uppercase tracking-widest italic">
                    Jadwal Mengajar Anda Masih Kosong
                  </p>
                  <p className="text-[10px] text-stone-400 font-bold max-w-sm mx-auto uppercase mt-2 tracking-widest leading-relaxed">
                    Silakan isi kelas belajar, hari, jam mengajar Anda menggunakan form di sebelah kiri untuk merapikan KBM harian Anda.
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
