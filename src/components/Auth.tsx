import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';
import { Home, CheckSquare, Mail, Lock, User as UserIcon, ShieldCheck, ArrowRight, Loader2, ClipboardList, CheckCircle, Stethoscope, Building, Eye, EyeOff } from 'lucide-react';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('wali_asuh');
  const [mapel, setMapel] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [retryStatus, setRetryStatus] = useState('');
  const [shake, setShake] = useState(false);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);

  // Detect if user is already authenticated but missing profile
  React.useEffect(() => {
    const checkAuthStatus = () => {
      if (auth.currentUser) {
        setIsCompletingProfile(true);
        if (!email) setEmail(auth.currentUser.email || '');
        if (!name) setName(auth.currentUser.displayName || '');
      } else {
        setIsCompletingProfile(false);
      }
    };
    checkAuthStatus();
    // Listening for auth changes to update state immediately
    const unsubscribe = auth.onAuthStateChanged(checkAuthStatus);
    return () => unsubscribe();
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const roleLabels: Record<UserRole, string> = {
    'wali_asuh': 'Wali Asuh',
    'wali_asrama': 'Wali Asrama',
    'wali_kelas': 'Wali Kelas',
    'guru_mapel': 'Guru Mapel',
    'dokter': 'Dokter',
    'kepala_sekolah': 'Kepsek'
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Masukkan email Anda terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError('Tautan atur ulang password telah dikirim ke email Anda.');
    } catch (err: any) {
      setError('Gagal mengirim email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // App.tsx handles state change, and Auth handles profile completion if needed
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Gagal masuk dengan Google: ' + (err.message || 'Terjadi kesalahan.'));
        triggerShake();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!navigator.onLine) {
      setError('Anda sedang offline. Silakan periksa koneksi internet Anda.');
      triggerShake();
      return;
    }

    if (!isCompletingProfile && password.length < 6) {
      setError('Password harus minimal 6 karakter.');
      triggerShake();
      return;
    }

    setError('');
    setRetryStatus('');
    setLoading(true);

    const performAuth = async (retries = 2): Promise<void> => {
      try {
        if (isCompletingProfile && auth.currentUser) {
          // Just save the profile for already logged in user
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            name: name.trim(),
            role,
            ...(role === 'guru_mapel' && { mapel: mapel.trim() }),
            createdAt: new Date().toISOString()
          });
          // App.tsx will pick up the change
          return;
        }

        const authPromise = isLogin 
          ? signInWithEmailAndPassword(auth, cleanEmail, password)
          : (async () => {
              const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
              try {
                await sendEmailVerification(userCredential.user);
              } catch (e) {
                console.warn('Verification email failed to send:', e);
              }
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: cleanEmail,
                name: name.trim(),
                role,
                ...(role === 'guru_mapel' && { mapel: mapel.trim() }),
                createdAt: new Date().toISOString()
              });
              setRegistered(true);
            })();

        // Add 15s timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 15000)
        );

        await Promise.race([authPromise, timeoutPromise]);
      } catch (err: any) {
        if ((err.code === 'auth/network-request-failed' || err.message === 'timeout') && retries > 0) {
          setRetryStatus(`Masalah koneksi. Mencoba kembali... (${retries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return performAuth(retries - 1);
        }
        throw err;
      }
    };

    try {
      await performAuth();
    } catch (err: any) {
      console.error('Auth Error:', err);
      triggerShake();
      if (err.code === 'auth/network-request-failed' || err.message === 'timeout') {
        setError('Koneksi sangat lambat atau terputus. Silakan coba lagi nanti.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email atau password salah. Pastikan Anda sudah terdaftar atau gunakan Google Login.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Gunakan email lain atau silakan Masuk.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan. Akun dibekukan sementara. Tunggu beberapa menit.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid (contoh: nama@sekolah.id).');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Minimal 6 karakter.');
      } else {
        setError('Terjadi kendala: ' + (err.message || 'Kesalahan sistem tidak terduga.'));
      }
    } finally {
      setLoading(false);
      setRetryStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0ea5e9] flex items-center justify-center p-4 font-sans overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-black/10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          x: shake ? [-10, 10, -10, 10, 0] : 0
        }}
        transition={{ 
          x: { duration: 0.4 } 
        }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex p-4 bg-white rounded-[2.5rem] shadow-xl shadow-black/10 mb-4 border border-white/50"
          >
            <Logo size="lg" showText={false} />
          </motion.div>
          <h2 className="text-3xl font-black text-white tracking-tight font-display uppercase">SRMA 24 KEDIRI</h2>
          <p className="text-sky-100 text-sm font-bold uppercase tracking-[0.2em] mt-1">Digital Health System</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-widest bg-black/20 py-2 px-4 rounded-full w-fit mx-auto border border-white/10">
            <ShieldCheck className="w-4 h-4" />
            Terverifikasi & Aman
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white p-8 md:p-10">
          <AnimatePresence mode="wait">
            {registered ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Verifikasi Email</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Kami telah mengirimkan tautan verifikasi ke <strong>{email}</strong>. 
                    <br />
                    <span className="text-amber-600 font-bold">Email verifikasi biasanya berada di folder spam, silahkan cek disana.</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRegistered(false);
                    setIsLogin(true);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  Kembali ke Login
                </button>
              </motion.div>
            ) : (
              <motion.div key="form">
                <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                  <button 
                    onClick={() => {
                        setIsLogin(true);
                        setIsCompletingProfile(false);
                    }}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      isLogin && !isCompletingProfile ? 'bg-[#0ea5e9] text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Masuk
                  </button>
                  <button 
                    onClick={() => {
                        setIsLogin(false);
                        setIsCompletingProfile(false);
                    }}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      !isLogin && !isCompletingProfile ? 'bg-[#0ea5e9] text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Daftar Baru
                  </button>
                </div>

                {isCompletingProfile && (
                  <div className="mb-8 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1 text-center">Lengkapi Profil Anda</h3>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-relaxed text-center">
                      Anda sudah terverifikasi, silakan pilih jabatan untuk masuk ke dashboard.
                    </p>
                  </div>
                )}

                {!isLogin && !isCompletingProfile && (
                  <div className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-relaxed text-center mb-1">
                      Bergabunglah untuk akses riwayat kesehatan & perizinan siswa secara real-time.
                    </p>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest text-center italic">
                      Email verivikasi biasanya berada di folder spam ,silahkan cek disana
                    </p>
                  </div>
                )}

                {retryStatus && (
                  <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">{retryStatus}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <AnimatePresence mode="wait">
                    {(isCompletingProfile || !isLogin) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5"
                      >
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                        <div className="relative group">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                            placeholder="Masukkan nama lengkap"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isCompletingProfile && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                          placeholder="nama@sekolah.id"
                        />
                      </div>
                    </div>
                  )}

                  {!isCompletingProfile && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                        {isLogin && (
                          <button 
                            type="button" 
                            onClick={handleResetPassword}
                            className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600"
                          >
                            Lupa Password?
                          </button>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {isLogin && !isCompletingProfile && (
                    <div className="flex items-center gap-2 ml-1">
                      <button 
                        type="button"
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                          rememberMe ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-100' : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {rememberMe && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>Ingat Saya</span>
                    </div>
                  )}

                  {(isCompletingProfile || !isLogin) && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                    >
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Jabatan</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['wali_asuh', 'wali_asrama', 'wali_kelas', 'guru_mapel'] as UserRole[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRole(r)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                              role === r 
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            }`}
                          >
                            {r === 'wali_asuh' ? <Home className="w-5 h-5" /> : 
                             r === 'wali_asrama' ? <Building className="w-5 h-5" /> :
                             r === 'wali_kelas' ? <CheckSquare className="w-5 h-5" /> : 
                             <ClipboardList className="w-5 h-5" />}
                            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-none">{roleLabels[r]}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {!isLogin && !isCompletingProfile && role === 'guru_mapel' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5"
                    >
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                      <div className="relative group">
                        <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          required
                          value={mapel}
                          onChange={(e) => setMapel(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                          placeholder="Contoh: Matematika"
                        />
                      </div>
                    </motion.div>
                  )}

                  {isCompletingProfile && role === 'guru_mapel' && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                      <div className="relative group">
                        <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          required
                          value={mapel}
                          onChange={(e) => setMapel(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                          placeholder="Contoh: Matematika"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-3"
                    >
                      <div className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-pulse" />
                      {error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full py-4 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black rounded-2xl shadow-xl shadow-black/10 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span className="uppercase tracking-[0.2em] text-[10px]">
                            {isCompletingProfile ? 'Simpan Profil' : (isLogin ? 'Masuk Sekarang' : 'Daftar Akun')}
                        </span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {isLogin && !isCompletingProfile && (
                    <div className="space-y-4 pt-2">
                       <div className="flex items-center gap-4">
                         <div className="flex-1 h-px bg-slate-100" />
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Atau</span>
                         <div className="flex-1 h-px bg-slate-100" />
                       </div>
                       <button
                         type="button"
                         onClick={handleGoogleLogin}
                         disabled={loading}
                         className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                       >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12.48 10.92v3.28h7.84c-.24 1.84-.9 3.47-1.92 4.67-1.2 1.2-3.04 2.2-6.12 2.2-4.92 0-8.91-4-8.91-8.91s4-8.91 8.91-8.91c2.61 0 4.65.88 6.07 2.29l2.31-2.31c-2.1-2-5-3.23-8.38-3.23C5.48 0 0 5.48 0 12.23s5.48 12.23 12.23 12.23c3.67 0 6.44-1.2 8.63-3.48 2.21-2.21 2.91-5.32 2.91-7.85 0-.58-.05-1.12-.13-1.66h-11.18z" />
                          </svg>
                          <span className="text-[10px] uppercase tracking-widest">Masuk dengan Google</span>
                       </button>
                    </div>
                  )}

                  {isCompletingProfile && (
                    <button
                      type="button"
                      onClick={() => auth.signOut()}
                      className="w-full py-2 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:text-rose-600 transition-all font-display text-center"
                    >
                      Bukan akun Anda? Keluar
                    </button>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
