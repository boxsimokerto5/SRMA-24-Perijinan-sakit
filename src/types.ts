import { Timestamp } from 'firebase/firestore';

export type UserRole = 'dokter' | 'wali_asuh' | 'wali_kelas' | 'kepala_sekolah' | 'guru_mapel' | 'wali_asrama';
export const WALI_KELAS_LIST: { name: string; kelas: string }[] = [
  { name: "Nadhifa Is'ad, S.Pd", kelas: "X-1" },
  { name: "Diyah Maruti Handayani, S.Pd", kelas: "X-2" },
  { name: "Nella Puji Rahayu, S.Pd", kelas: "X-3" },
  { name: "Ida Fitriana, S.Pd", kelas: "X-4" },
];

export interface HealthCheckProposal {
  id?: string;
  proposer_name: string;
  proposer_uid: string;
  asrama: string;
  tgl_usulan: Timestamp;
  daftar_siswa: string[]; // List of student names
  status: 'pending' | 'processed';
  keterangan?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  mapel?: string;
  fcmToken?: string;
}

export type PermitStatus = 'pending_asuh' | 'pending_kelas' | 'approved' | 'rejected' | 'pending_ack' | 'acknowledged';
export type PermitType = 'sakit' | 'umum' | 'catatan';

export interface LogTindakan {
  waktu: Timestamp;
  oleh: string;
  peran: string;
  pesan: string;
}

export interface IzinSakit {
  id?: string;
  tipe: PermitType;
  nomor_surat: string;
  nama_siswa: string;
  kelas: string;
  diagnosa?: string; // Untuk tipe sakit
  alasan?: string;   // Untuk tipe umum
  isi_catatan?: string; // Untuk tipe catatan
  jumlah_hari?: number;
  tgl_mulai?: Timestamp;
  tgl_selesai?: Timestamp;
  tgl_surat: Timestamp;
  tgl_disetujui?: Timestamp;
  lokasi?: string;
  nama_dokter?: string;
  nama_wali_kelas: string;
  nama_wali_asuh?: string;
  catatan_kamar?: string;
  status: PermitStatus;
  dokter_uid?: string;
  wali_asuh_uid?: string;
  wali_kelas_uid?: string;
  tindakan?: LogTindakan[];
}

export interface Memorandum {
  id?: string;
  nomor_memo: string;
  perihal: string;
  isi: string;
  tgl_memo: Timestamp;
  penerima: UserRole[];
  pengirim_name: string;
  pengirim_uid: string;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  authorName: string;
  authorUid: string;
  isActive: boolean;
}

export interface PinjamHP {
  id?: string;
  nama_siswa: string;
  kelas: string;
  keperluan: string;
  tgl_pinjam: Timestamp;
  tgl_kembali?: Timestamp;
  status: 'dipinjam' | 'dikembalikan';
  wali_asuh_name: string;
  wali_asuh_uid: string;
  penerima_kembali_name?: string;
  penerima_kembali_uid?: string;
}

export interface Siswa {
  id?: string;
  nik: string;
  nisn?: string;
  nomor_kk: string;
  nama_lengkap: string;
  kelas: string;
  asrama?: string;
  ttl?: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  umur: number;
  jenis_kelamin: string;
  agama: string;
  kecamatan?: string;
  kelurahan?: string;
  alamat?: string;
  rt?: string;
  rw?: string;
  anak_ke?: number;
  saudara?: number;
  ayah?: string;
  ibu?: string;
  niy?: string;
  niy_waliklas?: string;
  foto_url?: string;
}

export interface LaptopRequest {
  id?: string;
  nomor_surat: string;
  tgl_request: Timestamp;
  guru_name: string;
  guru_uid: string;
  mapel: string;
  kelas: string;
  daftar_siswa: string[]; // List of student names
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

export interface HPRequest {
  id?: string;
  nomor_surat: string;
  tgl_request: Timestamp;
  guru_name: string;
  guru_uid: string;
  mapel: string;
  kelas: string;
  daftar_siswa: string[]; // List of student names
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

export interface AppNotification {
  id?: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: Timestamp;
  readBy: string[];
  recipientRoles: UserRole[];
  link?: string;
}

export interface MadingPost {
  id?: string;
  content: string;
  authorName: string;
  authorUid: string;
  authorRole: UserRole;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProgressRecord {
  id?: string;
  nama_siswa: string;
  kelas: string;
  isi_catatan: string;
  author_name: string;
  author_uid: string;
  author_role: UserRole;
  tgl_catatan: Timestamp;
  is_acknowledged?: boolean;
}

export interface MonthlyReport {
  id?: string;
  siswa_id: string; // ID from siswa collection
  nama_siswa: string;
  kelas: string;
  asrama: string;
  wali_asuh_name: string;
  wali_asuh_uid: string;
  periode_bulan: string; // e.g., "Mei 2026"
  
  // Kesehatan & Fisik
  berat_badan: number;
  tinggi_badan: number;
  status_kesehatan: string;
  catatan_kesehatan: string;
  
  // Evaluasi Karakter
  ibadah_score: number; // 1-5
  adab_score: number;   // 1-5
  kemandirian_score: number; // 0-100
  kemandirian_level: string; // e.g., "Sangat Mandiri"
  karakter_deskripsi: string;
  
  // Akademik & Minat Bakat
  akademik_deskripsi: string;
  ekstrakurikuler: string[];
  capaian_khusus: string;
  
  // Dokumentasi
  foto_siswa_url?: string;
  foto_kegiatan: string[]; // URLs or base64 (prefer URLs if uploaded)
  video_url?: string;
  
  // Pesan Wali Asuh
  pesan_wali_asuh: string;
  
  createdAt: Timestamp;
}

export interface Agenda {
  id?: string;
  title: string;
  description: string;
  date: Timestamp;
  author_name: string;
  author_uid: string;
  author_role: UserRole;
  sharedWith: UserRole[];
  createdAt: Timestamp;
}

export interface WallMessage {
  id?: string;
  content: string;
  author_name: string;
  author_uid: string;
  author_role: UserRole;
  wall_type: 'asrama' | 'asuh' | 'kelas';
  createdAt: Timestamp;
}

export interface EvaluationNote {
  id?: string;
  description: string;
  date: Timestamp;
  author_name: string;
  author_uid: string;
  asrama: string;
  createdAt: Timestamp;
}

export interface DormitoryIncident {
  id?: string;
  date: Timestamp;
  time: string;
  subject: string;
  incident_description: string;
  improvement_efforts: string;
  author_name: string;
  author_uid: string;
  author_role: UserRole;
  asrama: string;
  createdAt: Timestamp;
}

export interface SarprasReport {
  id?: string;
  asrama: string;
  item_name: string;
  damage_description: string;
  location: string;
  author_name: string;
  author_uid: string;
  tgl_lapor: Timestamp;
  status: 'pending' | 'on_progress' | 'fixed';
  tindakan_oleh_name?: string;
  tindakan_oleh_role?: string;
  tgl_tindakan?: Timestamp;
  keterangan_tindakan?: string;
}

export interface Ketidakhadiran {
  id?: string;
  nomor_surat?: string;
  tgl_absen: Timestamp;
  keterangan_kegiatan: string;
  kelas: string;
  daftar_siswa: string[]; // List of student names
  deskripsi: string; // Keterangan tambahan
  author_name: string;
  author_uid: string;
  author_role: UserRole;
  createdAt: Timestamp;
}

export interface PenangananJurnal {
  waktu: Timestamp;
  oleh_name: string;
  oleh_role: string;
  tindakan: string;
}

export interface JurnalKeperawatan {
  id?: string;
  nama_siswa: string;
  kelas: string;
  keterangan_sakit: string;
  tgl_mulai: Timestamp;
  status: 'dirawat' | 'sembuh';
  tgl_sembuh?: Timestamp;
  penanganan: PenangananJurnal[];
  created_by_name: string;
  created_by_uid: string;
  created_by_role: string;
}


export const normalizeKelas = (kelas: string): string => {
  if (!kelas) return '';
  // Trim and convert to upper case for consistency
  let cleanKelas = kelas.trim().toUpperCase();
  
  // Mapping for specific class aliases
  const mapping: { [key: string]: string } = {
    'X-A': 'X-4', 'X-B': 'X-3', 'X-C': 'X-2', 'X-D': 'X-1',
    'XA': 'X-4', 'XB': 'X-3', 'XC': 'X-2', 'XD': 'X-1',
    'X 1': 'X-1', 'X 2': 'X-2', 'X 3': 'X-3', 'X 4': 'X-4',
    'XI 1': 'XI-1', 'XI 2': 'XI-2', 'XI 3': 'XI-3', 'XI 4': 'XI-4',
    'XII 1': 'XII-1', 'XII 2': 'XII-2', 'XII 3': 'XII-3', 'XII 4': 'XII-4',
    'X1': 'X-1', 'X2': 'X-2', 'X3': 'X-3', 'X4': 'X-4',
    'XI1': 'XI-1', 'XI2': 'XI-2', 'XI3': 'XI-3', 'XI4': 'XI-4',
    'XII1': 'XII-1', 'XII2': 'XII-2', 'XII3': 'XII-3', 'XII4': 'XII-4'
  };

  // If directly in mapping, return it
  if (mapping[cleanKelas]) return mapping[cleanKelas];

  // Otherwise, handle general space/dash issues
  // Ensure "X - 1" or "X 1" becomes "X-1"
  return cleanKelas.replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, '-').replace('--', '-');
};
