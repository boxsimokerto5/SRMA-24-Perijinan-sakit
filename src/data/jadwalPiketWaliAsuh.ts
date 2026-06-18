export interface PiketStaff {
  nama: string;
  jadwal: string[]; // Length 30 representing days 1 to 30 of June 2026
}

export const LIST_WALI_ASUH_PIKET: PiketStaff[] = [
  {
    nama: "Suhariyono",
    jadwal: ["P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S"]
  },
  {
    nama: "Rindani",
    jadwal: ["S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP"]
  },
  {
    nama: "Hariadi",
    jadwal: ["S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O"]
  },
  {
    nama: "Moch. Chabib",
    jadwal: ["S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2"]
  },
  {
    nama: "Dewi Askinu",
    jadwal: ["S", "S", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S"]
  },
  {
    nama: "Aris Mahmud Syafi'i",
    jadwal: ["M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S"]
  },
  {
    nama: "Erna Rizkiani",
    jadwal: ["LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S"]
  },
  {
    nama: "Chusfia Hanik Wihayati",
    jadwal: ["O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S"]
  },
  {
    nama: "A. Zainudin Sholeh",
    jadwal: ["P2", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "S", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M"]
  },
  {
    nama: "Abisarwan Rafif",
    jadwal: ["P2", "S", "S", "S", "M", "LP", "O", "P", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP"]
  },
  {
    nama: "Dwi Chusnul Mufid",
    jadwal: ["P2", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P", "P2", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O"]
  },
  {
    nama: "Amirul Mu'minin Rofico P.K.",
    jadwal: ["P2", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "P2", "S", "S", "M", "LP", "O", "P", "S", "S", "S", "S", "M", "LP", "O", "P3"]
  },
  {
    nama: "Nanang Arifin",
    jadwal: ["S", "M", "LP", "O", "P3", "P2", "S", "S", "S", "S", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "S"]
  },
  {
    nama: "Muji Santoso",
    jadwal: ["S", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "P2", "P2", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S"]
  },
  {
    nama: "Deni Furitrinofi",
    jadwal: ["LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "S", "LP", "O", "P", "P2", "S", "S", "S", "M", "LP", "O", "P2", "P2", "S", "S"]
  },
  {
    nama: "Eko Wahyudi",
    jadwal: ["O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O", "P3", "P3", "S", "S", "M", "LP", "O", "P", "P2", "P2", "S", "S", "S"]
  },
  {
    nama: "Eky Venty Pricilia",
    jadwal: ["P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S", "S", "M"]
  },
  {
    nama: "Teguh Cahyono",
    jadwal: ["S", "O", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "P2", "S", "S", "S", "S", "LP", "O", "P3", "S", "S", "S", "S", "M", "LP", "O"]
  },
  {
    nama: "Akhmad Fadkhurriza I",
    jadwal: ["S", "M", "LP", "O", "P3", "P2", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P", "S"]
  },
  {
    nama: "Afida Saidatul Fuadia",
    jadwal: ["LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "M", "LP", "O", "P2", "S", "S", "S", "S", "S", "LP", "O", "P2", "S", "S", "S"]
  }
];

export interface ShiftInfo {
  code: string;
  name: string;
  time: string;
  colorClass: string;
  bgClass: string;
}

export const SHIFT_DETAILS: Record<string, ShiftInfo> = {
  "P": {
    code: "P",
    name: "Masuk Pagi (P1)",
    time: "07:00 - 16:00",
    colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/50",
    bgClass: "bg-emerald-500"
  },
  "P2": {
    code: "P2",
    name: "Masuk Pagi (P2)",
    time: "07:00 - 15:00",
    colorClass: "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800/50",
    bgClass: "bg-teal-500"
  },
  "P3": {
    code: "P3",
    name: "Masuk Pagi (P3)",
    time: "08:00 - 16:00",
    colorClass: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800/50",
    bgClass: "bg-cyan-500"
  },
  "S": {
    code: "S",
    name: "Berangkat Sore",
    time: "15:00 - 22:00",
    colorClass: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-850/50",
    bgClass: "bg-orange-500"
  },
  "M": {
    code: "M",
    name: "Tugas Malam",
    time: "15:00 - 08:00",
    colorClass: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800/50",
    bgClass: "bg-indigo-500"
  },
  "M1": {
    code: "M1",
    name: "Tugas Malam (M1)",
    time: "19:00 - 08:00",
    colorClass: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800/50",
    bgClass: "bg-purple-500"
  },
  "LP": {
    code: "LP",
    name: "Lepas Piket",
    time: "Libur Setelah Malam",
    colorClass: "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/60 dark:border-slate-800",
    bgClass: "bg-slate-400"
  },
  "O": {
    code: "O",
    name: "Off / Libur",
    time: "Hari Libur Resmi",
    colorClass: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50",
    bgClass: "bg-rose-500"
  }
};
