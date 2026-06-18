import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Loader2, Search, User, Mail, Shield, Trash2, Plus, X, BookOpen, Key, Check, Info, ShieldAlert } from 'lucide-react';
import { AppUser, UserRole } from '../types';

export default function UserManagementView({ user }: { user: AppUser }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('wali_asuh');
  const [newMapel, setNewMapel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Delete protection / Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleLabels: Record<UserRole, string> = {
    'wali_asuh': 'Wali Asuh',
    'wali_asrama': 'Wali Asrama',
    'wali_kelas': 'Wali Kelas',
    'guru_mapel': 'Guru Mapel',
    'dokter': 'Dokter',
    'kepala_sekolah': 'Kepala Sekolah'
  };

  const roleColors: Record<UserRole, string> = {
    'wali_asuh': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'wali_asrama': 'bg-amber-50 text-amber-700 border-amber-100',
    'wali_kelas': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'guru_mapel': 'bg-sky-50 text-sky-700 border-sky-100',
    'dokter': 'bg-rose-50 text-rose-700 border-rose-100',
    'kepala_sekolah': 'bg-purple-50 text-purple-700 border-purple-100'
  };

  // Real-time listener for the users
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: AppUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userList.push({
          uid: doc.id,
          email: data.email || '',
          name: data.name || 'No Name',
          role: data.role || 'wali_asuh',
          mapel: data.mapel,
          fcmToken: data.fcmToken,
        });
      });
      // Sort users by name
      userList.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Validasis
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      setFormError('Mohon isi semua field wajib.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setFormError('Password minimal harus 6 karakter.');
      return;
    }
    if (newRole === 'guru_mapel' && !newMapel.trim()) {
      setFormError('Sebutkan mata pelajaran untuk Guru Mapel.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Initialize secondary app so we don't disturb current user session
      let secondaryApp;
      if (getApps().some(app => app.name === 'SecondaryAdminApp')) {
        secondaryApp = getApp('SecondaryAdminApp');
      } else {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAdminApp');
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      
      // 2. Create user inside secondary Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newEmail.trim().toLowerCase(), 
        newPassword.trim()
      );
      const newUid = userCredential.user.uid;

      // 3. Write document to primary Firestore database
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        role: newRole,
        ...(newRole === 'guru_mapel' && { mapel: newMapel.trim() }),
        createdAt: new Date().toISOString()
      });

      setFormSuccess(`Akun berhasil dibuat dengan UID: ${newUid}`);
      
      // Reset form fields
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('wali_asuh');
      setNewMapel('');

      // Auto close after 2s
      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess('');
      }, 1500);

    } catch (err: any) {
      console.error("Error creating user account:", err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('Email sudah digunakan oleh akun lain.');
      } else if (err.code === 'auth/invalid-email') {
        setFormError('Format email tidak valid.');
      } else if (err.code === 'auth/weak-password') {
        setFormError('Password terlalu lemah.');
      } else {
        setFormError('Gagal mendaftarkan akun: ' + (err.message || 'Error tidak diketahui'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (uidToDelete: string) => {
    setDeleting(true);
    try {
      // Delete document from Firestore users collection
      await deleteDoc(doc(db, 'users', uidToDelete));
      
      // Clean up confirmation state
      setDeleteId(null);
      alert('Akun berhasil dihapus dari database.');
    } catch (err: any) {
      console.error("Error deleting user document:", err);
      alert('Gagal menghapus user: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left pb-20">
      
      {/* Header Banner */}
      <div className="relative bg-slate-900 rounded-3xl p-6 md:p-8 text-white overflow-hidden shadow-xl border border-white/15">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none uppercase italic">Kontrol Seluruh User</h1>
              <p className="text-slate-300 text-[10px] md:text-xs font-bold mt-2 uppercase tracking-[0.15em] italic opacity-85">
                Panel Administrasi Akun Sistem Terpadu Pembinaan Anak Asuh
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 border border-emerald-500/30 w-full md:w-auto font-display italic"
          >
            <Plus className="w-4 h-4" />
            Tambahkan Akun Baru
          </button>
        </div>
      </div>

      {/* Stats and Controls */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        
        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search */}
          <div className="relative group md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            <input
              type="text"
              placeholder="Cari user berdasarkan nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold font-display italic text-slate-800 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs font-black uppercase tracking-wider text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all cursor-pointer appearance-none"
            >
              <option value="all">SEMUA HAK AKSES</option>
              {Object.entries(roleLabels).map(([roleVal, label]) => (
                <option key={roleVal} value={roleVal}>{label.toUpperCase()}</option>
              ))}
            </select>
          </div>

        </div>

        {/* User Card List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Memuat data user...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[2rem]">
            <User className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
              Tidak ada akun yang ditemukan <br /> yang sesuai dengan kriteria pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((u) => {
              const isCurrentUser = u.uid === user.uid;
              return (
                <div 
                  key={u.uid} 
                  className={`p-5 rounded-3xl border transition-all ${
                    isCurrentUser 
                      ? 'border-indigo-100 bg-indigo-50/10 shadow-indigo-100/10 shadow-lg' 
                      : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                  } flex flex-col justify-between gap-4`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black border uppercase tracking-wider ${roleColors[u.role as UserRole] || 'bg-slate-50 text-slate-700'}`}>
                        {roleLabels[u.role as UserRole] || u.role}
                      </span>
                      {isCurrentUser && (
                        <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-lg font-display">
                          AKUN ANDA
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 font-display shrink-0 text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-xs text-slate-800 line-clamp-1">{u.name}</h3>
                        <p className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {u.email}
                        </p>
                        {u.role === 'guru_mapel' && u.mapel && (
                          <p className="text-[9px] text-sky-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                            <BookOpen className="w-3 h-3" />
                            {u.mapel}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer / Controls */}
                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-slate-300">UID: {u.uid.slice(0, 10)}...</span>
                    {!isCurrentUser && (
                      <button
                        onClick={() => setDeleteId(u.uid)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center active:scale-90"
                        title="Hapus user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full border border-slate-100 shadow-2xl p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-500 border border-rose-100">
              <ShieldAlert className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black font-display uppercase italic tracking-tight text-slate-900">Konfirmasi Penghapusan</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Menghapus profil pengguna akan <strong className="text-rose-600">segera memblokir akses login</strong> mereka ke seluruh portal. Tindakan ini tidak bisa dibatalkan!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all"
              >
                Batalkan
              </button>
              <button
                onClick={() => handleDeleteUser(deleteId)}
                disabled={deleting}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Hapus!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 text-left overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h4 className="font-black text-xs uppercase tracking-widest font-display italic">Pendaftaran Credential Baru</h4>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateUser} className="p-6 md:p-8 space-y-5">
              
              {formError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shrink-0" />
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  {formSuccess}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                    placeholder="Masukkan nama staf"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                    placeholder="nama@sekolah.id"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Baru</label>
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan / Akses</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs font-black uppercase tracking-wider text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  {Object.entries(roleLabels).map(([roleVal, label]) => (
                    <option key={roleVal} value={roleVal}>{label.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Mapel (conditionally shown for guru_mapel) */}
              {newRole === 'guru_mapel' && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    required
                    value={newMapel}
                    onChange={(e) => setNewMapel(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                    placeholder="Contoh: Matematika"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] italic font-display"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Daftarkan Account Baru'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
