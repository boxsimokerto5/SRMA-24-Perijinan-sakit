import { Timestamp } from 'firebase/firestore';

export type UserRole = 'dokter' | 'wali_asuh' | 'wali_kelas' | 'kepala_sekolah';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
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
}

export const WALI_KELAS_LIST = [
  { name: "Nadhifa Is'ad, S.Pd", kelas: "X-1" },
  { name: "Diyah Maruti Handayani, S.Pd", kelas: "X-2" },
  { name: "Nella Puji Rahayu, S.Pd", kelas: "X-3" },
  { name: "Ida Fitriana, S.Pd", kelas: "X-4" },
];
