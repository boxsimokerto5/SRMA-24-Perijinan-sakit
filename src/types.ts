export type UserRole = 'admin' | 'wali_asuh' | 'wali_asrama' | 'wali_kelas' | 'guru_mapel' | 'kepala_sekolah' | 'dokter';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
  fcmToken?: string;
}

export interface ProgressRecord {
  id?: string;
  nama_siswa: string;
  kelas: string;
  isi_catatan: string;
  tgl_catatan: Date | { toDate: () => Date } | null;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date | { toDate: () => Date } | null;
}

export interface Siswa {
  id: string;
  nama_lengkap: string;
  kelas: string;
  nis: string;
}
