import { Timestamp } from 'firebase/firestore';

export type UserRole = 'dokter' | 'wali_asuh' | 'wali_kelas';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

export type PermitStatus = 'pending_asuh' | 'pending_kelas' | 'approved';
export type PermitType = 'sakit' | 'umum';

export interface IzinSakit {
  id?: string;
  tipe: PermitType;
  nomor_surat: string;
  nama_siswa: string;
  kelas: string;
  diagnosa?: string; // Untuk tipe sakit
  alasan?: string;   // Untuk tipe umum
  jumlah_hari: number;
  tgl_mulai: Timestamp;
  tgl_selesai: Timestamp;
  tgl_surat: Timestamp;
  lokasi: string;
  nama_dokter?: string;
  nama_wali_kelas: string;
  nama_wali_asuh?: string;
  catatan_kamar?: string;
  status: PermitStatus;
  dokter_uid?: string;
  wali_asuh_uid?: string;
  wali_kelas_uid?: string;
}

export const WALI_KELAS_LIST = [
  { name: "Nadhifa Is'ad, S.Pd", kelas: "X-1" },
  { name: "Diyah Maruti Handayani, S.Pd", kelas: "X-2" },
  { name: "Nella Puji Rahayu, S.Pd", kelas: "X-3" },
  { name: "Ida Fitriana, S.Pd", kelas: "X-4" },
];
