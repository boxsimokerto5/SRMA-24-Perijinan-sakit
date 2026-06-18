export interface ShiftDefinition {
  code: string;
  name: string;
  time: string;
  color: string; // Tailwind class
}

export const SHIFT_LEGEND: Record<string, ShiftDefinition> = {
  'P': { code: 'P', name: 'Pagi FUL', time: '07:00 - 16:00', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60' },
  'P2': { code: 'P2', name: 'Pagi Shift 2', time: '07:00 - 15:00', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60' },
  'P3': { code: 'P3', name: 'Pagi Shift 3', time: '08:00 - 16:00', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/60' },
  'S': { code: 'S', name: 'Siang', time: '15:00 - 22:00', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60' },
  'M': { code: 'M', name: 'Malam', time: '15:00 - 08:00', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/60' },
  'LP': { code: 'LP', name: 'Libur Piket', time: 'Standby / Libur Piket', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60' },
  'O': { code: 'O', name: 'OFF / Libur Lepas', time: 'Libur + Lepas Tugas', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60' }
};

export interface StaffSchedule {
  no: number;
  nama: string;
  shifts: string[]; // Length 30, index 0 is June 1st, index 29 is June 30th
}

export const STAFF_ROSTER_JUNE_2026: StaffSchedule[] = [
  {
    no: 1,
    nama: "Suhariyono",
    shifts: ["P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M"]
  },
  {
    no: 2,
    nama: "Rindani",
    shifts: ["S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP"]
  },
  {
    no: 3,
    nama: "Hariadi",
    shifts: ["S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O"]
  },
  {
    no: 4,
    nama: "Moch. Chabib",
    shifts: ["S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2"]
  },
  {
    no: 5,
    nama: "Dewi Askinu",
    shifts: ["S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S"]
  },
  {
    no: 6,
    nama: "Aris Mahmud Syafi'i",
    shifts: ["M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S"]
  },
  {
    no: 7,
    nama: "Erna Rizkiani",
    shifts: ["LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S"]
  },
  {
    no: 8,
    nama: "Chusfia Hanik Wihayati",
    shifts: ["O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S"]
  },
  {
    no: 9,
    nama: "A. Zainudin Sholeh",
    shifts: ["P2", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M"]
  },
  {
    no: 10,
    nama: "Abisarwan Rafif",
    shifts: ["P2", "S", "S", "S", "M", "LP", "O", "P", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP"]
  },
  {
    no: 11,
    nama: "Dwi Chusnul Mufid",
    shifts: ["P2", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "P2", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O"]
  },
  {
    no: 12,
    nama: "Amirul Mu'minin Rofico P.K.",
    shifts: ["P2", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "P2", "S", "S", "M", "LP", "O", "P", "S", "S", "S", "S", "M", "LP", "O", "P3"]
  },
  {
    no: 13,
    nama: "Nanang Arifin",
    shifts: ["S", "M", "LP", "O", "P3", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "S"]
  },
  {
    no: 14,
    nama: "Muji Santoso",
    shifts: ["M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "P2", "P2", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S"]
  },
  {
    no: 15,
    nama: "Deni Furitrinofi",
    shifts: ["LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S"]
  },
  {
    no: 16,
    nama: "Eko Wahyudi",
    shifts: ["O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "P3", "S", "S", "M", "LP", "O", "P", "P2", "P2", "S", "S", "S"]
  },
  {
    no: 17,
    nama: "Eky Venty Pricilia",
    shifts: ["O", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M"]
  },
  {
    no: 18,
    nama: "Teguh Cahyono",
    shifts: ["S", "O", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "P2", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O"]
  },
  {
    no: 19,
    nama: "Akhmad Fadkhurriza I",
    shifts: ["S", "M", "LP", "O", "P3", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "S"]
  },
  {
    no: 20,
    nama: "Afida Saidatul Fuadia",
    shifts: ["LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S"]
  }
];
