import { Timestamp } from 'firebase/firestore';

export type UserRole = 'dokter' | 'wali_asuh' | 'wali_kelas' | 'kepala_sekolah' | 'guru_mapel';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  mapel?: string;
  fcmToken?: string;
}

export type PermitStatus = 'pending_asuh' | 'pending_kelas' | 'approved' | 'pending_ack' | 'acknowledged';
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

export const WALI_KELAS_LIST = [
  { name: "Nadhifa Is'ad, S.Pd", kelas: "X-4" },
  { name: "Diyah Maruti Handayani, S.Pd", kelas: "X-3" },
  { name: "Nella Puji Rahayu, S.Pd", kelas: "X-2" },
  { name: "Ida Fitriana, S.Pd", kelas: "X-1" },
];
