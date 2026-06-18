import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Play, 
  RotateCw, 
  Search, 
  Trash2, 
  User, 
  CheckCircle, 
  Calendar, 
  Info, 
  X, 
  Filter, 
  Check, 
  Clock, 
  HelpCircle,
  Hash
} from 'lucide-react';
import { Siswa, JadwalTausiyah, AppUser } from '../types';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface TausiyahSpinnerProps {
  user?: AppUser;
  students: Siswa[];
  history: JadwalTausiyah[];
  onSaveEvaluator?: (name: string, kelas: string, gender: string, date: string) => Promise<void>;
  onDeleteHistory?: (id: string) => Promise<void>;
}

// 100 Premium Realistic Indonesian-Islamic Student Names for padding / default
const DEFAULT_PRESET_NAMES = [
  "Abdallah Hadi", "Abdurrahman Rafif", "Achmad Fawwaz", "Aditya Darmawan", "Ahmad Al-Fatih",
  "Ahmad Dani", "Ahmad Fauzi", "Ahmad Naufal", "Akmal Maulana", "Alfin Syahrul",
  "Ali Zainal Abidin", "Anas Jamil", "Arif Rahman", "Arya Wiguna", "Asyraf Nur",
  "Aulia Rahman", "Azhar Izzuddin", "Bagas Saputra", "Bilal Al-Habasye", "Budi Hermawan",
  "Daffa Ibnu", "Daniel Firdaus", "Dewan Syahputra", "Dimas Aditya", "Dzaki Al-Mubarak",
  "Fadhil Muzakki", "Fadhlur Rahman", "Fajar Ramadhan", "Faisal Akbar", "Farhan Al-Ghifari",
  "Fathurrahman Ghufron", "Fauzan Azima", "Fikri Haikal", "Galang Danu", "Ghazali Rabbani",
  "Gilang Permana", "Habibullah Syarif", "Hafiz Syahbana", "Hamzah Fansuri", "Hanif Al-Amin",
  "Haris Munandar", "Hasan Al-Banna", "Hilmi Zuhdi", "Hussein Al-Attas", "Ibnu Sina",
  "Ihsan Kamil", "Ilham Syah", "Iqbal Thoriq", "Irfan Hakim", "Kamaluddin Syah",
  "Luqmanul Hakim", "M. Ainun Najib", "M. Faza", "M. Syahrun", "M. Tegar",
  "Maulana Ishaq", "Miftahul Khoir", "Muammar Qaddafi", "Mufid Ar-Raihan", "Muhammad Al-Amin",
  "Muhammad Fadil", "Muhammad Hanif", "Muhammad Iqbal", "Muhammad Ridho", "Muhammad Yusuf",
  "Nabil Makarim", "Nizar Zulmi", "Noval Ardiansyah", "Pratama Yudha", "Putra Wijaya",
  "Rafi Wardana", "Rafid Al-Kautsar", "Rahman Al-Ghazali", "Raihan Jamil", "Raka Danendra",
  "Randi Malik", "Reza Fahlevi", "Ridwan Kamil", "Rizal Syahputra", "Rizky Ramadhan",
  "Salman Al-Farisi", "Samuel Akbar", "Satria Mandala", "Sholehuddin Al-Ayyubi", "Sufyan Al-Hadi",
  "Sukron Makmun", "Syamil Mubarak", "Thariq Bin Ziyad", "Taufiq Hidayat", "Ubaidillah Said",
  "Umar Al-Faruq", "Wahyu Hidayah", "Wardana Putra", "Wira Yudhistira", "Yahya Zakaria",
  "Yunus Al-Mubarak", "Yusuf Al-Karim", "Zainal Mustofa", "Zaki Anwar", "Zulfikar Ali"
];

export default function TausiyahSpinner({ 
  user,
  students, 
  history, 
  onSaveEvaluator, 
  onDeleteHistory 
}: TausiyahSpinnerProps) {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState<'semua' | 'Laki-laki' | 'Perempuan'>('semua');
  const [evaluatorDate, setEvaluatorDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [savingLog, setSavingLog] = useState(false);
  const [activeTab, setActiveTab] = useState<'spinner' | 'history'>('spinner');

  // Spinning Engine States
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDegree, setCurrentDegree] = useState(0);
  const [winner, setWinner] = useState<{ id?: string; name: string; kelas: string; gender: string } | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [tickingName, setTickingName] = useState('');

  // Helper to convert Firestore Timestamp / value to Date safely
  const getJsDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  // Helper to check if a specific name is currently within 17 days of any scheduled evaluation
  const getCooldownStatus = (name: string, targetDateStr: string) => {
    if (!name) return { locked: false, remainingDays: 0, scheduledDate: '' };
    const targetDate = new Date(targetDateStr);
    const cleanName = name.replace(" (Siswa Simulasi)", "").trim().toLowerCase();

    for (const item of history) {
      if (!item.nama_siswa) continue;
      const itemCleanName = item.nama_siswa.trim().toLowerCase();
      if (itemCleanName === cleanName) {
        const scheduledDate = getJsDate(item.tanggal);
        if (scheduledDate) {
          // Difference in days: targetDate - scheduledDate
          const diffMs = targetDate.getTime() - scheduledDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          // Cooldown window: within 17 days (both past and future to play safe)
          if (diffDays >= 0 && diffDays < 17) {
            const remaining = 17 - Math.floor(diffDays);
            return {
              locked: true,
              reason: `Cooldown (${remaining} Hari)`,
              remainingDays: remaining,
              scheduledDate: scheduledDate.toLocaleDateString('id', { day: 'numeric', month: 'short' })
            };
          }
          if (diffDays < 0 && diffDays > -17) {
            const remaining = 17 - Math.floor(Math.abs(diffDays));
            return {
              locked: true,
              reason: `Booked (${remaining} Hari)`,
              remainingDays: remaining,
              scheduledDate: scheduledDate.toLocaleDateString('id', { day: 'numeric', month: 'short' })
            };
          }
        }
      }
    }
    return { locked: false, remainingDays: 0, scheduledDate: '' };
  };

  // Generate or pad list to EXACTLY 100 names (filtering out locked ones)
  const pool100 = useMemo(() => {
    // Start with existing real students
    const list: Array<{ id?: string; name: string; kelas: string; gender: string }> = students.map(s => ({
      id: s.id,
      name: s.nama_lengkap,
      kelas: s.kelas || "Kelas Umum",
      gender: s.jenis_kelamin || "Laki-laki"
    }));

    // Filter out the real students who are currently in cooling state relative to the evaluatorDate
    const eligibleReal = list.filter(student => {
      const cooldown = getCooldownStatus(student.name, evaluatorDate);
      return !cooldown.locked;
    });

    const eligiblePool: Array<{ id?: string; name: string; kelas: string; gender: string }> = [...eligibleReal];

    // Pad to exactly 100
    let padCount = 100 - eligiblePool.length;
    if (padCount > 0) {
      let mockIndex = 0;
      for (let i = 0; i < padCount; i++) {
        let mockName = DEFAULT_PRESET_NAMES[mockIndex % DEFAULT_PRESET_NAMES.length];
        mockIndex++;
        
        // Ensure mock name is not locked either
        let guard = 0;
        while (getCooldownStatus(mockName, evaluatorDate).locked && guard < 200) {
          mockName = DEFAULT_PRESET_NAMES[mockIndex % DEFAULT_PRESET_NAMES.length];
          mockIndex++;
          guard++;
        }

        const randomKelasNum = 10 + (i % 3); // Kelas 10, 11, 12
        const randomKelasLetter = ['A', 'B', 'C', 'D'][i % 4];
        eligiblePool.push({
          id: `mock-${i}`,
          name: `${mockName} (Siswa Simulasi)`,
          kelas: `${randomKelasNum} ${randomKelasLetter}`,
          gender: "Laki-laki"
        });
      }
    } else if (eligiblePool.length > 100) {
      // If we still have more than 100, truncate to exactly 100
      return eligiblePool.slice(0, 100);
    }

    return eligiblePool;
  }, [students, history, evaluatorDate]);

  // Find all active students currently in cooldown
  const lockedActiveStudents = useMemo(() => {
    return students
      .map(s => {
        const cooldown = getCooldownStatus(s.nama_lengkap, evaluatorDate);
        return {
          id: s.id,
          name: s.nama_lengkap,
          kelas: s.kelas || "Kelas Umum",
          cooldown
        };
      })
      .filter(s => s.cooldown.locked);
  }, [students, history, evaluatorDate]);

  // Filter pool based on user search in UI
  const filteredPool = useMemo(() => {
    return pool100.filter(entry => {
      const matchesSearch = entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            entry.kelas.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGender = selectedGender === 'semua' || 
                            entry.gender.toLowerCase() === selectedGender.toLowerCase();
      return matchesSearch && matchesGender;
    });
  }, [pool100, searchQuery, selectedGender]);

  // Handle CSS Wheel segments parameters
  const totalSlices = 100;
  const sliceDeg = 360 / totalSlices;

  // Sound and Visual Ticking simulation
  const spinInterval = useRef<NodeJS.Timeout | null>(null);

  const startSpin = () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setWinner(null);
    setShowWinnerModal(false);

    // Dynamic rotation simulation
    const extraRotations = 5 + Math.floor(Math.random() * 5); // 5 to 10 full turns
    const targetSector = Math.floor(Math.random() * totalSlices);
    const stopAngle = extraRotations * 360 + (targetSector * sliceDeg);
    
    let startTimestamp: number | null = null;
    const duration = 6000; // 6 seconds elegant spin

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = timestamp - startTimestamp;
      const t = Math.min(progress / duration, 1);
      
      // Custom easeOutCubic/Quintic formula for continuous slowing down
      const easeOut = 1 - Math.pow(1 - t, 4);
      const angle = stopAngle * easeOut;
      setCurrentDegree(angle);

      // Track the highlighted index & tick sound/visual vibration
      const absoluteAngleNormalized = (360 - (angle % 360)) % 360;
      const indexUnderPointer = Math.floor(absoluteAngleNormalized / sliceDeg) % totalSlices;
      const currentPerson = pool100[indexUnderPointer];
      if (currentPerson) {
        setTickingName(currentPerson.name);
      }

      if (progress < duration) {
        requestAnimationFrame(step);
      } else {
        // Complete spin
        const finalAngleNormalized = (360 - (stopAngle % 360)) % 360;
        const winnerIndex = Math.floor(finalAngleNormalized / sliceDeg) % totalSlices;
        const finalizedWinner = pool100[winnerIndex];
        
        setWinner(finalizedWinner);
        setIsSpinning(false);
        setShowWinnerModal(true);
      }
    };

    requestAnimationFrame(step);
  };

  const handleSimpanPemenang = async () => {
    if (!winner) return;
    try {
      setSavingLog(true);
      // Clean name from simulated label if it has one
      const nameToSave = winner.name.replace(" (Siswa Simulasi)", "");
      if (onSaveEvaluator) {
        await onSaveEvaluator(nameToSave, winner.kelas, winner.gender, evaluatorDate);
      } else {
        await addDoc(collection(db, 'jadwal_tausiyah'), {
          tanggal: Timestamp.fromDate(new Date(evaluatorDate)),
          nama_siswa: nameToSave,
          kelas: winner.kelas,
          gender: winner.gender,
          author_name: user?.name || 'Sistem',
          author_uid: user?.uid || 'system',
          createdAt: Timestamp.now()
        });
      }
      setShowWinnerModal(false);
      setActiveTab('history');
      alert(`Berhasil menjadwalkan ${nameToSave} sebagai Evaluator Tausiyah.`);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan evaluator tausiyah ke cloud database.");
    } finally {
      setSavingLog(false);
    }
  };

  // Canvas confetti component or effect
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; col: string; size: number; delay: number }>>([]);
  
  useEffect(() => {
    if (showWinnerModal) {
      const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#e11d48'];
      const particles = Array.from({ length: 80 }).map((_, idx) => ({
        id: idx,
        x: Math.random() * 100, // Left percentage
        y: Math.random() * 50 - 20, // Start high
        col: colors[idx % colors.length],
        size: Math.random() * 10 + 6,
        delay: Math.random() * 1.5
      }));
      setConfetti(particles);
    } else {
      setConfetti([]);
    }
  }, [showWinnerModal]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation header */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('spinner')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 font-black text-xs uppercase tracking-widest tracking-wider border-b-2 transition-all ${
            activeTab === 'spinner'
              ? 'border-[#3e2723] text-[#3e2723]'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
          Roda Berputar (100 Nama)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 font-black text-xs uppercase tracking-widest tracking-wider border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-[#3e2723] text-[#3e2723]'
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Riwayat Evaluator Tausiyah
          {history.length > 0 && (
            <span className="bg-[#3e2723] text-white font-black text-[9px] px-2 py-0.5 rounded-full shrink-0">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'spinner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: THE COOL SPIN WHEEL */}
          <div className="lg:col-span-7 flex flex-col items-center bg-[#fcfbfa] p-4 xs:p-6 rounded-3xl border border-[#ebdccb]/40 relative overflow-hidden">
            {/* Elegant Header */}
            <div className="text-center mb-4 sm:mb-6">
              <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                Media Undi Evaluator
              </span>
              <h3 className="text-base sm:text-lg font-black text-[#3e2723] uppercase tracking-wide mt-1.5">Undi Pembaca Evaluasi Tausiyah</h3>
              <p className="text-[11px] sm:text-xs text-[#5d4037]/70 font-medium">Tekan tombol SPIN untuk mulai mengacak 100 nama di roda.</p>
            </div>

            {/* THE VISUAL SPINNER */}
            <div className="relative w-64 h-64 xs:w-72 xs:h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 my-4 select-none flex items-center justify-center shrink-0">
              
              {/* GLOW BACKGROUND EFFECT */}
              <div className="absolute inset-0 bg-radial from-amber-500/10 to-transparent blur-3xl rounded-full" />

              {/* OUTSIDE TIMBER BORDER RAMP */}
              <div className="absolute inset-0 rounded-full border-8 sm:border-12 border-[#3e2723] shadow-2xl flex items-center justify-center bg-[#fdfbf7] overflow-hidden" 
                   style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3), 0 10px 30px rgba(62,39,35,0.25)' }}>
                
                {/* WHEEL SVG SECTORS DRAWN */}
                <motion.div 
                  className="absolute w-full h-full"
                  style={{ rotate: currentDegree }}
                >
                  <svg viewBox="0 0 400 400" className="w-full h-full opacity-90">
                    <circle cx="200" cy="200" r="195" fill="none" stroke="#ebdccb" strokeWidth="2" />
                    
                    {/* Draw some visible segments / divider lines */}
                    {Array.from({ length: totalSlices }).map((_, i) => {
                      const angle = i * sliceDeg;
                      const rad = (angle * Math.PI) / 180;
                      const x1 = 200 + 170 * Math.cos(rad);
                      const y1 = 200 + 170 * Math.sin(rad);
                      const x2 = 200 + 195 * Math.cos(rad);
                      const y2 = 200 + 195 * Math.sin(rad);
                      
                      const barCol = i % 2 === 0 ? "#ebdccb" : "#dfcdbb";
                      const textRad = ((angle + sliceDeg/2) * Math.PI) / 180;
                      // Color groups for visual aesthetic
                      let fillSect = "#fcfaf4";
                      if (i % 5 === 0) fillSect = "#f5ebd5";
                      if (i % 10 === 0) fillSect = "#e3d5ca";
                      if (i % 25 === 0) fillSect = "#d7ccc8";

                      return (
                        <g key={i}>
                          {/* Segment line */}
                          <line x1="200" y1="200" x2={x2} y2={y2} stroke="#3e2723" strokeWidth="0.5" opacity="0.15" />
                          
                          {/* Color indicators on edge */}
                          <circle cx={x1} cy={y1} r="2.5" fill={i % 2 === 0 ? "#e67e22" : "#2ecc71"} opacity="0.6" stroke="#fff" strokeWidth="0.5" />
                        </g>
                      );
                    })}
                    
                    {/* Inner elegant gold ring */}
                    <circle cx="200" cy="200" r="140" fill="none" stroke="#d7ccc8" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="200" cy="200" r="100" fill="none" stroke="#3e2723" strokeWidth="1" opacity="0.2" />
                  </svg>
                  
                  {/* Glowing sectors highlight helper */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-full opacity-10 bg-gradient-to-t from-transparent via-amber-500 to-transparent" />
                  </div>
                </motion.div>
              </div>

              {/* PIN POINTER AT THE TOP */}
              <div className="absolute -top-1 left-1/2 -ml-4 z-20">
                <div className="w-8 h-8 relative">
                  <svg viewBox="0 0 24 24" className="w-full h-full text-red-600 drop-shadow-md">
                    <path fill="currentColor" d="M12 2L4 12h16L12 2z" />
                  </svg>
                  {/* Little ruby gem center indicator */}
                  <div className="absolute top-1.5 left-1/2 -ml-1 w-2 h-2 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              {/* INNER SOLID CENTER BOARD */}
              <div className="absolute w-32 h-32 xs:w-36 xs:h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-full bg-white border-2 border-[#3e2723] z-10 flex flex-col items-center justify-center text-center shadow-lg" 
                   style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.15), inset 0 2px 5px rgba(255,255,255,1)' }}>
                
                {/* SPIN BUTTON OR INDICATOR */}
                <button
                  onClick={startSpin}
                  disabled={isSpinning}
                  className="w-24 h-24 xs:w-28 xs:h-28 sm:w-30 sm:h-30 md:w-32 md:h-32 rounded-full bg-[#3e2723] text-white hover:bg-[#5d4037] active:scale-95 disabled:scale-100 disabled:opacity-90 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all shadow-inner border border-stone-800 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-amber-300 ${isSpinning ? 'animate-pulse' : ''}`} />
                  <span className="font-black text-xs xs:text-sm uppercase tracking-widest">SPIN</span>
                  <span className="text-[8px] xs:text-[9px] text-[#ebdccb] italic font-bold">100 Anak Asuh</span>
                </button>
              </div>
            </div>

            {/* REAL-TIME PREVIEW UNDER THE NEEDLE NEEDLE */}
            <div className="w-full max-w-sm bg-white border border-stone-200 py-3.5 px-4 rounded-2xl flex items-center gap-3 shadow-inner mt-4 min-h-[56px] justify-center">
              <span className="shrink-0 text-xs bg-red-100 text-red-800 font-black px-2 py-0.5 rounded uppercase">Under Needle:</span>
              <span className="font-extrabold text-[#3e2723] text-sm animate-pulse truncate col-span-3">
                {tickingName || "Menunggu Putaran..."}
              </span>
            </div>

            {/* INFO NOTES FOOTER */}
            <div className="flex gap-2.5 bg-amber-50 border border-amber-200/50 p-4 rounded-2xl mt-6 text-left max-w-sm">
              <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-relaxed font-semibold">
                Sistem roda berisi <strong>100 Nama Anak Asuh</strong>. Jika jumlah anak asuh asrama yang terdaftar kurang dari 100, sistem secara otomatis melengkapi dengan anak asuh simulasi asrama sehingga undian tetap adil dan masif.
              </div>
            </div>
          </div>

          {/* RIGHT: LIST OF NAMES & FILTERS */}
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm space-y-4">
              <h3 className="font-black text-[#3e2723] text-sm uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-600" />
                Daftar 100 Nama Roda
              </h3>

              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari anak asuh di roda..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#3e2723]"
                />
              </div>

              {/* GENDER PICKER */}
              <div className="flex gap-2">
                {(['semua', 'Laki-laki', 'Perempuan'] as const).map((genderVal) => (
                  <button
                    key={genderVal}
                    onClick={() => setSelectedGender(genderVal)}
                    className={`flex-1 text-[10px] font-black uppercase py-1.5 rounded-lg border transition-all ${
                      selectedGender === genderVal
                        ? 'bg-[#3e2723] text-white border-[#3e2723]'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {genderVal}
                  </button>
                ))}
              </div>

              {/* SCROLLABLE VIEW GRID */}
              <div className="h-96 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-100 pr-1 text-xs">
                {filteredPool.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 italic font-semibold">
                    Anak asuh tidak ditemukan.
                  </div>
                ) : (
                  filteredPool.map((entry, index) => {
                    const originalIndex = pool100.findIndex(p => p.id === entry.id);
                    return (
                      <div key={entry.id} className="p-3 hover:bg-[#fcfbfa] flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="w-5 text-right font-black text-stone-400 font-mono text-[10px]">
                            {originalIndex + 1}
                          </span>
                          <div className="truncate">
                            <p className="font-extrabold text-stone-800 text-xs truncate">{entry.name}</p>
                            <p className="text-[10px] text-stone-400 truncate">Kelas {entry.kelas}</p>
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          entry.id && String(entry.id).startsWith('mock')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {entry.id && String(entry.id).startsWith('mock') ? 'Simulasi' : 'Aktif'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

               {/* SUMMARY STATS */}
              <div className="text-[10px] text-stone-400 italic flex justify-between font-bold pt-1">
                <span>Total Aktif: {students.length} anak asuh</span>
                <span>Total Roda: {pool100.length} anak asuh</span>
              </div>
            </div>

            {/* COOLDOWN / LOCKED STATS AND LIST */}
            {lockedActiveStudents.length > 0 && (
              <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-200/40 space-y-3">
                <h4 className="font-black text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                  Anak Asuh Dalam Masa Cooldown ({lockedActiveStudents.length})
                </h4>
                <p className="text-[10px] text-amber-800/80 leading-relaxed font-semibold">
                  Anak asuh berikut tidak dimasukkan ke dalam roda karena baru saja atau akan dijadwalkan dalam periode <strong>17 hari</strong>:
                </p>
                <div className="max-h-48 overflow-y-auto divide-y divide-amber-100/60 pr-1">
                  {lockedActiveStudents.map(student => (
                    <div key={student.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-extrabold text-stone-850">{student.name}</p>
                        <p className="text-[10px] text-stone-400">Kelas {student.kelas}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {student.cooldown.reason}
                        </span>
                        <p className="text-[9px] text-stone-400 mt-0.5">Tejadwal: {student.cooldown.scheduledDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* HISTORY TAB */
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div>
              <h3 className="font-black text-stone-800 text-sm uppercase tracking-wider">Arsip Riwayat Undian Evaluator</h3>
              <p className="text-xs text-stone-500 font-medium">Anak asuh terpilih yang terdaftar mengevaluasi pembinaan di asrama.</p>
            </div>
            <span className="text-xs bg-[#3e2723] text-[#ebdccb] px-3 py-1 rounded-xl font-bold">
              Total: {history.length}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-16 text-center text-stone-400 italic font-semibold flex flex-col items-center justify-center gap-2">
              <Clock className="w-8 h-8 text-stone-300" />
              Menunggu undian pertama dilakukan. Hasil undian yang diajukan akan direkam di sini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 uppercase text-[9px] font-black tracking-wider border-b divide-x divide-stone-100">
                    <th className="py-3 px-4">No.</th>
                    <th className="py-3 px-4">Tanggal Undi / Tausiyah</th>
                    <th className="py-3 px-4">Nama Evaluator</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Dibuat Oleh</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {history.map((item, idx) => {
                    const friendlyDate = item.tanggal ? 
                      new Date(item.tanggal.seconds * 1000).toLocaleDateString('id', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 
                      'Unknown';
                    
                    return (
                      <tr key={item.id} className="hover:bg-stone-50/50">
                        <td className="py-3.5 px-4 font-black font-mono text-stone-400">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-stone-700">
                          {friendlyDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                              {item.nama_siswa?.charAt(0)}
                            </div>
                            <span className="font-extrabold text-stone-900">{item.nama_siswa}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-stone-600">
                          {item.kelas}
                        </td>
                        <td className="py-4 px-4 text-stone-500 leading-snug">
                          {item.author_name}
                          <p className="text-[10px] text-stone-400">Wali Asuh</p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={async () => {
                              if (item.id && confirm("Hapus log/jadwal evaluasi ini?")) {
                                try {
                                  if (onDeleteHistory) {
                                    await onDeleteHistory(item.id);
                                  } else {
                                    await deleteDoc(doc(db, 'jadwal_tausiyah', item.id));
                                  }
                                } catch (err) {
                                  console.error("Gagal menghapus:", err);
                                  alert("Gagal menghapus riwayat evaluator.");
                                }
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Batalkan Undian"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* WINNER SCREEN / DIALOG CONGRATULATIONS WITH CONFETTI */}
      <AnimatePresence>
        {showWinnerModal && winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWinnerModal(false)}
              className="absolute inset-0 bg-stone-900"
            />

            {/* Custom Confetti Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {confetti.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ y: -50, x: `${c.x}vw`, rotate: 0 }}
                  animate={{ 
                    y: '110vh', 
                    rotate: 360,
                    x: `${c.x + (Math.random() * 20 - 10)}vw` 
                  }}
                  transition={{ 
                    duration: 3 + Math.random() * 3, 
                    delay: c.delay, 
                    ease: 'linear',
                    repeat: Infinity 
                  }}
                  className="absolute rounded-sm"
                  style={{
                    backgroundColor: c.col,
                    width: c.size,
                    height: c.size,
                    opacity: 0.8
                  }}
                />
              ))}
            </div>

            {/* Modal Dialog Body */}
            <motion.div
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-8 text-center shadow-2xl border-4 border-amber-400 overflow-hidden text-stone-900"
            >
              {/* Top Golden Star Badge */}
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-xl mb-4 animate-bounce">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>

              {/* Title Header */}
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">
                🏆 Hasil Undian Evaluator
              </h4>
              <h2 className="text-2xl font-black text-[#3e2723] uppercase tracking-normal mt-2 leading-tight">
                {winner.name.replace(" (Siswa Simulasi)", "")}
              </h2>
              <p className="text-stone-500 text-xs font-bold mt-1">
                Relasi Kelas: {winner.kelas} ({winner.gender})
              </p>

              <hr className="my-6 border-stone-100" />

              {/* EVALUATOR DATE SELECTION FOR COMMITMENT */}
              <div className="space-y-3 text-left">
                <label className="block text-[10px] font-black uppercase text-stone-500 tracking-wider">
                  Tentukan Tanggal Evaluasi Tausiyah:
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={evaluatorDate}
                    onChange={(e) => setEvaluatorDate(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#3e2723]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowWinnerModal(false)}
                  className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-[#3e2723] text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={savingLog}
                  onClick={handleSimpanPemenang}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-[#3e2723] text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {savingLog ? 'Menyimpan...' : 'Jadwalkan'}
                </button>
              </div>

              {/* Corner Close Tag */}
              <button 
                onClick={() => setShowWinnerModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-stone-400 hover:text-black transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
