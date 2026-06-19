import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  Users, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  FileSpreadsheet,
  TrendingUp,
  Award,
  ChevronDown
} from 'lucide-react';
import { 
  STAFF_ROSTER_JUNE_2026, 
  SHIFT_LEGEND, 
  StaffSchedule, 
  ShiftDefinition 
} from '../data/rosterData';

// Indonesian day name helper for June 2026
// June 1, 2026 is Monday (Senin)
const getDayNameInIndonesian = (day: number): { name: string; isWeekend: boolean } => {
  const daysInIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  // 1 June 2026 was Monday. So (day - 1) % 7 gives 0 for Monday, 5 for Saturday, 6 for Sunday
  const dayIndex = (day + 0) % 7; // Monday is index 1, Sunday is index 0
  const realDayIndex = (dayIndex === 0) ? 0 : dayIndex; // Adjusted index
  
  // Actually, standard JavaScript Date for June 2026:
  const dateObj = new Date(2026, 5, day); // 5 means June (0-indexed)
  const realOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ...
  
  return {
    name: daysInIndonesian[realOfWeek],
    isWeekend: realOfWeek === 0 || realOfWeek === 6
  };
};

interface JadwalAbsenPiketViewProps {
  user: any;
}

export default function JadwalAbsenPiketView({ user }: JadwalAbsenPiketViewProps) {
  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan' | 'statistik'>('harian');
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date();
    // Default to the current day of the month if it's June 2026. Otherwise, use 18 (representing today's simulation date)
    if (today.getFullYear() === 2026 && today.getMonth() === 5) {
      return Math.min(30, Math.max(1, today.getDate()));
    }
    return 18;
  });
  
  // State to control collapse/expand representing the shifts
  const [openShifts, setOpenShifts] = useState<Record<string, boolean>>({
    'P': true,
    'P2': true,
    'P3': true,
    'S': true,
    'M': true,
    'LP': false, // Collapsed by default to keep layout tidy
    'O': false   // Collapsed by default to keep layout tidy
  });
  
  // Real-time Firestore state
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<any>(null);

  const docId = `2026-06-${String(selectedDay).padStart(2, '0')}`;

  // Fetch picket attendance for the selected day
  useEffect(() => {
    const fetchAttendance = async () => {
      setAttendanceData({});
      setNotes('');
      setSaveStatus(null);
      setLastUpdated(null);
      
      try {
        const docRef = doc(db, 'absen_piket_harian', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAttendanceData(data.attendance || {});
          setNotes(data.notes || '');
          setLastUpdated(data.submittedAt ? data.submittedAt.toDate() : null);
        } else {
          // Initialize with "Hadir" for anyone who has an active shift
          // (not "O" or "LP") on this day, or leave blank so the user can check them
          const initial: Record<string, string> = {};
          STAFF_ROSTER_JUNE_2026.forEach((staff) => {
            const shiftCode = staff.shifts[selectedDay - 1];
            if (shiftCode !== 'O' && shiftCode !== 'LP') {
              initial[staff.nama] = 'Hadir'; // Default to Present
            }
          });
          setAttendanceData(initial);
        }
      } catch (err) {
        console.error("Error loading daily attendance:", err);
      }
    };

    fetchAttendance();
  }, [selectedDay, docId]);

  // Handle status toggle for a staff member
  const handleStatusChange = (name: string, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [name]: status
    }));
  };

  // Save attendance sheet to Firestore
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      const docRef = doc(db, 'absen_piket_harian', docId);
      await setDoc(docRef, {
        date: `2026-06-${String(selectedDay).padStart(2, '0')}`,
        day: selectedDay,
        submittedBy: user.email || 'Anonymous',
        submittedAt: serverTimestamp(),
        attendance: attendanceData,
        notes: notes
      }, { merge: true });

      setSaveStatus({ success: true, message: 'Absensi piket harian berhasil disimpan!' });
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setSaveStatus({ success: false, message: `Gagal menyimpan absensi: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Group staff members by shift on the selected day
  const groupedByShift = React.useMemo(() => {
    const groups: Record<string, Array<{ staff: StaffSchedule; shiftCode: string }>> = {
      'P': [],
      'P2': [],
      'P3': [],
      'S': [],
      'M': [],
      'LP': [],
      'O': []
    };

    STAFF_ROSTER_JUNE_2026.forEach(staff => {
      const shiftCode = staff.shifts[selectedDay - 1];
      if (groups[shiftCode]) {
        groups[shiftCode].push({ staff, shiftCode });
      }
    });

    return groups;
  }, [selectedDay]);

  const { name: dayInIndonesian, isWeekend } = getDayNameInIndonesian(selectedDay);

  // Statistics for June 2026
  const individualStats = React.useMemo(() => {
    return STAFF_ROSTER_JUNE_2026.map(staff => {
      const counts: Record<string, number> = { P: 0, S: 0, M: 0, LP: 0, O: 0, P2: 0, P3: 0 };
      staff.shifts.forEach(shift => {
        if (counts[shift] !== undefined) {
          counts[shift]++;
        }
      });
      // Sum P + P2 + P3 for Total Pagi/Siang/Malam shifts
      const totalP = counts.P + counts.P2 + counts.P3;
      const totalShift = totalP + counts.S + counts.M;
      // Formula for "Jam Kerja" (JK) or similar weight could be calculated.
      // Looking at the table, let's map exactly the stats columns
      return {
        nama: staff.nama,
        counts,
        totalPagi: totalP,
        totalShift
      };
    });
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans" id="jadwal-absen-piket-view-main">
      {/* Brown Themed Hero Header */}
      <div className="relative bg-gradient-to-br from-[#3e2723] to-[#2d1b18] rounded-[2.5rem] p-5 sm:p-6 md:p-8 text-white overflow-hidden shadow-2xl border-b-4 border-amber-950 flex flex-col justify-between min-h-[160px] md:aspect-[16/7] transition-all">
        {/* Background Elements */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        {/* Decorative Badge */}
        <div className="relative z-10 self-start bg-amber-500/20 text-amber-300 border border-amber-500/30 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-4 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          E-Absensi Wali Asuh
        </div>

        {/* Hero Title & Description */}
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight italic" id="jadwal-piket-heading">
            E-ABSENSI <span className="text-amber-400">WALI ASUH</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-300/90 leading-relaxed font-normal">
            Kelola absensi kehadiran dinas serta pantau pembagian shift harian, matriks bulanan, dan statistik jadwal piket Wali Asuh secara real-time dan akurat.
          </p>
        </div>

        {/* Tab Selector inside Title Card */}
        <div className="relative z-10 mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-3 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-stone-800 self-start">
          <button
            onClick={() => setActiveTab('harian')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-xl font-bold transition-all duration-300 ${
              activeTab === 'harian'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Kehadiran Hari Ini
          </button>
          <button
            onClick={() => setActiveTab('bulanan')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-xl font-bold transition-all duration-300 ${
              activeTab === 'bulanan'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Matriks Shift Bulanan
          </button>
          <button
            onClick={() => setActiveTab('statistik')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-xl font-bold transition-all duration-300 ${
              activeTab === 'statistik'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Statistik Dinas
          </button>
        </div>
      </div>

      {/* Main Content Sections based on the Active Tab */}

      {/* 1. PIKET HARIAN TAB */}
      {activeTab === 'harian' && (
        <div className="space-y-8 animate-in fade-in duration-500" id="tab-piket-harian">
          {/* Day Date Selector Bar */}
          <div className="bg-white dark:bg-stone-900 rounded-[2rem] p-6 border border-stone-200 dark:border-stone-800 shadow-xl shadow-stone-100 dark:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  Pilih Tanggal Absensi (Juni 2026)
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Geser atau ketuk nomor hari untuk memantau detail dinas Wali Asuh
                </p>
              </div>

              {/* Day controller chevron */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  disabled={selectedDay === 1}
                  onClick={() => setSelectedDay(prev => Math.max(1, prev - 1))}
                  className="p-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl text-sm font-black italic">
                  {dayInIndonesian}, {selectedDay} Juni 2026
                </span>
                <button
                  disabled={selectedDay === 30}
                  onClick={() => setSelectedDay(prev => Math.min(30, prev + 1))}
                  className="p-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Days Horizontal Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-stone-800">
              {Array.from({ length: 30 }, (_, idx) => {
                const dayNum = idx + 1;
                const { name: dayName, isWeekend: dayIsWeekend } = getDayNameInIndonesian(dayNum);
                const isSelected = selectedDay === dayNum;
                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDay(dayNum)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all duration-300 border ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-500/30 scale-105'
                        : dayIsWeekend
                        ? 'bg-rose-50/70 border-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/10 dark:border-rose-900/20 dark:text-rose-400'
                        : 'bg-stone-50 border-stone-100 text-stone-700 hover:bg-stone-100 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-tighter opacity-80">{dayName.substring(0, 3)}</span>
                    <span className="text-lg font-black">{dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Shifts for the Day */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Shifts Column Legend & Live Duty */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-stone-800 dark:text-stone-200 uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Daftar Dinas Personel ({dayInIndonesian} {selectedDay} Juni)
                </h3>
                <span className="text-xs text-stone-500 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-full font-semibold">
                  Total Wali Asuh: 20 Orang
                </span>
              </div>

              {/* Grouped Lists */}
              {Object.entries({
                'P': 'Pagi FUL (07:00 - 16:00)',
                'P2': 'Pagi Shift 2 (07:00 - 15:00)',
                'P3': 'Pagi Shift 3 (08:00 - 16:00)',
                'S': 'Siang (15:00 - 22:00)',
                'M': 'Malam (15:00 - 08:00)',
                'LP': 'Libur Piket (Standby / Off-duty)',
                'O': 'OFF / Lepas Dinas'
              }).map(([code, header]) => {
                const members = groupedByShift[code] || [];
                const legend = SHIFT_LEGEND[code];

                if (members.length === 0) return null;

                const isOpen = !!openShifts[code];

                return (
                  <div key={code} className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/60 dark:border-stone-800/80 shadow-sm overflow-hidden transition-all duration-300">
                    {/* Shift Clickable Header */}
                    <button
                      onClick={() => setOpenShifts(prev => ({ ...prev, [code]: !prev[code] }))}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-left focus:outline-none hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black select-none border shrink-0 ${legend.color}`}>
                          {code}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-stone-800 dark:text-stone-100 leading-tight">{header}</h4>
                          <span className="text-[11px] text-stone-400 font-medium tracking-wide">
                            {legend.time}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg">
                          {members.length} Orang
                        </span>
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="text-stone-400"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="border-t border-stone-100 dark:border-stone-800 bg-stone-50/20"
                        >
                          <div className="p-4 sm:p-5">
                            {/* Members on Duty Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {members.map(({ staff }) => {
                                const isNonDuty = code === 'O' || code === 'LP';
                                const currentStatus = attendanceData[staff.nama] || '';

                                return (
                                  <div 
                                    key={staff.nama} 
                                    className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                                      isNonDuty 
                                        ? 'bg-stone-50 dark:bg-stone-800/30 border-stone-150 dark:border-stone-850'
                                        : currentStatus === 'Hadir'
                                        ? 'bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/5 dark:border-emerald-900/30'
                                        : currentStatus === 'Sakit' || currentStatus === 'Izin'
                                        ? 'bg-amber-50/30 border-amber-100 dark:bg-amber-950/5 dark:border-amber-900/30'
                                        : currentStatus === 'Alfa'
                                        ? 'bg-rose-50/30 border-rose-100 dark:bg-rose-950/5 dark:border-rose-900/30'
                                        : 'bg-stone-50/50 dark:bg-stone-850 border-stone-150 dark:border-stone-800/65'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 flex items-center justify-center bg-stone-200 dark:bg-stone-700/60 rounded-full text-[10px] font-black text-stone-600 dark:text-stone-400 shadow-sm">
                                          {staff.no}
                                        </span>
                                        <span className="text-xs font-black text-stone-700 dark:text-stone-200">
                                          {staff.nama}
                                        </span>
                                      </div>
                                      {isNonDuty && (
                                        <span className="text-[10px] bg-stone-150 dark:bg-stone-850 text-stone-500 py-0.5 px-2 rounded-md font-bold uppercase tracking-tight">
                                          Libur / Off
                                        </span>
                                      )}
                                    </div>

                                    {/* Attendance Selector Buttons (Only if on Active Shift duty) */}
                                    {!isNonDuty && (
                                      <div className="mt-2.5 flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                                        {[
                                          { label: 'Hadir', value: 'Hadir', activeClass: 'bg-emerald-600 text-white shadow-sm' },
                                          { label: 'Izin', value: 'Izin', activeClass: 'bg-amber-600 text-white shadow-sm' },
                                          { label: 'Sakit', value: 'Sakit', activeClass: 'bg-amber-600 text-white shadow-sm' },
                                          { label: 'Alfa', value: 'Alfa', activeClass: 'bg-rose-600 text-white shadow-sm' }
                                        ].map((opt) => (
                                          <button
                                            key={opt.value}
                                            onClick={() => handleStatusChange(staff.nama, opt.value)}
                                            className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                                              currentStatus === opt.value
                                                ? opt.activeClass
                                                : 'text-stone-500 hover:bg-stone-200/50 dark:hover:bg-stone-700/40 hover:text-stone-700'
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* 2. Logging & Submit Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#2d1b18] text-white rounded-[2rem] border border-stone-805 shadow-xl p-6 space-y-6 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

                <h3 className="text-lg font-black flex items-center gap-2 border-b border-stone-800 pb-3 text-stone-100 italic">
                  <UserCheck className="w-5 h-5 text-amber-500" />
                  REKAP ABSENSI HARIAN
                </h3>

                {/* Info summary */}
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-xl">
                    <span className="text-stone-400 font-medium">Tanggal Roster:</span>
                    <span className="font-extrabold text-amber-400">{selectedDay} Juni 2026</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-xl">
                    <span className="text-stone-400 font-medium">Hari Aktif Roster:</span>
                    <span className="font-extrabold">{dayInIndonesian}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-xl">
                    <span className="text-stone-400 font-medium">Personel Wajib Hadir:</span>
                    <span className="font-extrabold text-emerald-400">
                      {20 - (groupedByShift.O?.length || 0) - (groupedByShift.LP?.length || 0)} Orang
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-xl">
                    <span className="text-stone-400 font-medium">Hadir Terkonfirmasi:</span>
                    <span className="font-extrabold text-emerald-400">
                      {Object.values(attendanceData).filter(v => v === 'Hadir').length} Orang
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-xl">
                    <span className="text-stone-400 font-medium">Izin / Sakit / Alfa:</span>
                    <span className="font-extrabold text-amber-500">
                      {Object.values(attendanceData).filter(v => ['Izin', 'Sakit', 'Alfa'].includes(v)).length} Orang
                    </span>
                  </div>
                </div>

                {/* Additional Notes area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                    Catatan Kegiatan / Kejadian Piket
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Operan piket berjalan tertib, asrama kondusif, semua wali asuh hadir tepat waktu sesuai shift..."
                    className="w-full bg-stone-900 border border-stone-850 p-3 rounded-xl text-xs font-medium text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  />
                </div>

                {/* Action Submit Button */}
                <button
                  onClick={handleSaveAttendance}
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-505 text-white py-3.5 px-4 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-[98%] transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Menyimpan...' : 'Simpan Absensi Piket'}
                </button>

                {/* Save Feedback Alerts */}
                {saveStatus && (
                  <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    saveStatus.success 
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' 
                      : 'bg-rose-950/40 border-rose-800 text-rose-400'
                  }`}>
                    {saveStatus.success ? <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" /> : <XCircle className="w-4.5 h-4.5 flex-shrink-0" />}
                    <span>{saveStatus.message}</span>
                  </div>
                )}

                {/* Last submission identifier */}
                {lastUpdated && (
                  <div className="text-[11px] text-stone-500 text-center font-medium italic">
                    Diperbaharui terakhir pada: {lastUpdated.toLocaleString('id-ID')}
                  </div>
                )}
              </div>

              {/* Note / Guide list */}
              <div className="bg-stone-50 dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-[1.8rem] p-5 space-y-3.5">
                <h4 className="text-xs font-black text-stone-800 dark:text-stone-200 flex items-center gap-1.5 uppercase">
                  <Info className="w-4 h-4 text-stone-500" />
                  Petunjuk Absensi Piket
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed font-semibold">
                  <li>Pencatatan absensi ini hanya untuk memonitor kesiap-siagaan Wali Asuh yang dinas hari ini.</li>
                  <li>Secara default, status diinisiasi "Hadir" bagi personel dengan jadwal shift terdaftar.</li>
                  <li>Bila ada pertukaran dinas (parov), sesuaikan status dan cantumkan dalam kolom Catatan Piket.</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. JADWAL BULANAN (GRID) TAB */}
      {activeTab === 'bulanan' && (
        <div className="bg-white dark:bg-stone-900 rounded-[2rem] p-6 border border-stone-200 dark:border-stone-800 shadow-xl space-y-6 animate-in fade-in duration-500" id="tab-piket-bulanan">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                Matriks Pembagian Shift Wali Asuh
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Peta penugasan shift periode Juni 2026. Warna sel mencerminkan tipe shift.
              </p>
            </div>
            
            {/* Quick Export / Download mock as indicator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                Juni 2026
              </span>
            </div>
          </div>

          {/* Color legend guide row */}
          <div className="flex flex-wrap gap-2.5 p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-100 dark:border-stone-800/60">
            {Object.entries(SHIFT_LEGEND).map(([code, def]) => (
              <div key={code} className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className={`px-2 py-0.5 rounded-lg border text-[9px] uppercase font-black ${def.color}`}>
                  {code}
                </span>
                <span className="text-stone-600 dark:text-stone-400">{def.name}</span>
              </div>
            ))}
          </div>

          {/* Horizontally scrollable roster Grid */}
          <div className="overflow-x-auto rounded-2xl border border-stone-150 dark:border-stone-800 max-h-[550px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#3e2723] text-white text-xs sticky top-0 z-20">
                <tr className="divide-x divide-amber-950">
                  <th className="py-3 px-3 font-extrabold text-center w-12 select-none">No</th>
                  <th className="py-3 px-4 font-extrabold w-48 sticky left-0 bg-[#3e2723] z-30 shadow-md">Nama Wali Asuh</th>
                  {Array.from({ length: 30 }, (_, i) => {
                    const dayNum = i + 1;
                    const { name: dayName, isWeekend: dayIsWeekend } = getDayNameInIndonesian(dayNum);
                    return (
                      <th 
                        key={dayNum} 
                        onClick={() => setSelectedDay(dayNum)}
                        className={`py-2 px-2 text-center font-black min-w-[36px] cursor-pointer hover:bg-amber-800 transition select-none ${
                          dayIsWeekend ? 'bg-rose-950/60' : ''
                        }`}
                      >
                        <div className="text-[9px] font-medium uppercase opacity-75">{dayName.substring(0, 1)}</div>
                        <div className="text-xs">{dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-xs font-semibold">
                {STAFF_ROSTER_JUNE_2026.map((staff, rowIndex) => (
                  <tr 
                    key={staff.nama} 
                    className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition divide-x divide-stone-100 dark:divide-stone-800"
                  >
                    <td className="py-2.5 px-3 text-center text-stone-500 font-extrabold bg-stone-50/40 dark:bg-stone-850/20">{staff.no}</td>
                    <td className="py-2.5 px-4 font-black text-stone-700 dark:text-stone-200 sticky left-0 bg-white dark:bg-stone-900 z-10 shadow-sm border-r border-stone-100 dark:border-stone-800">
                      {staff.nama}
                    </td>
                    {staff.shifts.map((shiftCode, idx) => {
                      const def = SHIFT_LEGEND[shiftCode] || { color: 'bg-stone-100 text-stone-600' };
                      const isTargetDay = selectedDay === (idx + 1);

                      return (
                        <td 
                          key={idx} 
                          onClick={() => setSelectedDay(idx + 1)}
                          title={`${staff.nama} - Tanggal ${idx + 1} Juni: ${def.name || shiftCode}`}
                          className={`py-2 px-1 text-center cursor-pointer transition relative group ${
                            isTargetDay ? 'ring-2 ring-amber-500 ring-inset ring-offset-1 dark:ring-offset-stone-900 z-10' : ''
                          }`}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-black uppercase border select-none transition-transform group-hover:scale-105 duration-200 ${def.color}`}>
                            {shiftCode}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick interactive alert guide banner */}
          <div className="p-4 bg-amber-50 dark:bg-stone-850 border border-amber-100 dark:border-stone-800 rounded-2xl flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-[11px] text-amber-900 dark:text-stone-300 font-semibold leading-relaxed">
              Tips: Klik pada sembarang kepala tanggal (kolom hari) atau isi sel shift untuk merubah fokus tanggal pada menu <strong className="cursor-pointer underline text-amber-700 hover:text-amber-800" onClick={() => setActiveTab('harian')}>Piket Harian</strong> di atas.
            </p>
          </div>
        </div>
      )}

      {/* 3. STATISTIK DINAS TAB */}
      {activeTab === 'statistik' && (
        <div className="bg-white dark:bg-stone-900 rounded-[2rem] p-6 border border-stone-200 dark:border-stone-800 shadow-xl space-y-6 animate-in fade-in duration-500" id="tab-piket-statistik">
          <div>
            <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              Statistik & Akumulasi Tugas Jaga
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Berikut adalah total dinas masing-masing Wali Asuh selama bulan Juni 2026.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-transparent p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4">
              <div className="p-3 bg-emerald-600 text-white rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Staf Terdaftar</h4>
                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-400">20 Wali Asuh</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-transparent p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-4">
              <div className="p-3 bg-blue-600 text-white rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Akumulasi Shift</h4>
                <span className="text-2xl font-black text-blue-800 dark:text-blue-400">420 Shift Jaga</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#3e2723]/5 to-[#3e2723]/10 p-5 rounded-2xl border border-amber-900/10 flex items-center gap-4">
              <div className="p-3 bg-amber-850 text-white rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#3e2723] dark:text-stone-400 uppercase tracking-wider">Target Pemulihan Pintu Jaga</h4>
                <span className="text-2xl font-black text-amber-900 dark:text-amber-305">100% On-Duty</span>
              </div>
            </div>
          </div>

          {/* Responsive list of staff statistics */}
          <div className="border border-stone-150 dark:border-stone-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-stone-50 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 font-extrabold uppercase border-b border-stone-150 dark:border-stone-800">
                <tr className="divide-x divide-stone-150 dark:divide-stone-800">
                  <th className="py-3.5 px-4 text-center w-12">No</th>
                  <th className="py-3.5 px-4 w-52">Nama Wali Asuh</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-50/20 dark:bg-emerald-950/10">P/P2/P3</th>
                  <th className="py-3.5 px-3 text-center bg-blue-50/20 dark:bg-blue-950/10">S</th>
                  <th className="py-3.5 px-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10">M</th>
                  <th className="py-3.5 px-3 text-center bg-amber-50/20 dark:bg-amber-955/10">LP</th>
                  <th className="py-3.5 px-3 text-center bg-rose-50/20 dark:bg-rose-950/10">OFF</th>
                  <th className="py-3.5 px-4 text-center font-black bg-stone-100 dark:bg-stone-800">Total Dinas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150 dark:divide-stone-850 text-stone-605 dark:text-stone-400 font-bold">
                {individualStats.map((item, index) => (
                  <tr key={item.nama} className="hover:bg-stone-50/30 dark:hover:bg-stone-800/10 transition divide-x divide-stone-150 dark:divide-stone-850">
                    <td className="py-3 px-4 text-center font-extrabold font-mono text-stone-400">{index + 1}</td>
                    <td className="py-3 px-4 font-black text-stone-800 dark:text-stone-200">{item.nama}</td>
                    <td className="py-3 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">{item.totalPagi} Shift</td>
                    <td className="py-3 px-3 text-center font-black text-blue-600 dark:text-blue-400">{item.counts.S} Shift</td>
                    <td className="py-3 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">{item.counts.M} Shift</td>
                    <td className="py-3 px-3 text-center font-black text-amber-600 dark:text-amber-400">{item.counts.LP} Kali</td>
                    <td className="py-3 px-3 text-center font-black text-rose-600 dark:text-rose-400">{item.counts.O} Kali</td>
                    <td className="py-3 px-4 text-center font-black bg-stone-50 dark:bg-stone-850/30 text-stone-900 dark:text-white">
                      {item.totalShift} Shift
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
