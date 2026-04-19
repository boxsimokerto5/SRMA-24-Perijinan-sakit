import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';
import { Home, CheckSquare, Mail, Lock, User as UserIcon, ShieldCheck, ArrowRight, Loader2, ClipboardList, CheckCircle } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const performAuth = async (retries = 2): Promise<void> => {
      try {
        if (isLogin) {
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          
          // Send Verification Email
          await sendEmailVerification(userCredential.user);
          
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email,
            name,
            role,
            ...(role === 'guru_mapel' && { mapel }),
            createdAt: new Date().toISOString()
          });
          
          setRegistered(true);
        }
      } catch (err: any) {
        if (err.code === 'auth/network-request-failed' && retries > 0) {
          console.warn(`Auth network error, retrying... (${retries} left)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return performAuth(retries - 1);
        }
        throw err;
      }
    };

    try {
      await performAuth();
    } catch (err: any) {
      console.error('Auth Error:', err);
      if (err.code === 'auth/network-request-failed') {
        setError('Koneksi ke server identitas gagal. Silakan matikan VPN/Ad-blocker.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Email atau password salah.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar.');
      } else {
        setError('Terjadi kesalahan: ' + (err.message || 'Gagal memproses permintaan'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen cool-gradient-bg flex items-center justify-center p-4 font-sans overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-black/5">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex p-4 bg-white rounded-[2rem] shadow-xl shadow-indigo-100 mb-4 border border-indigo-50"
          >
            <Logo size="lg" showText={false} />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display">SRMA 24 KEDIRI</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em] mt-1">Digital Health System</p>
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
                  <p className="text-sm text-slate-500 font-medium">
                    Kami telah mengirimkan tautan verifikasi ke <strong>{email}</strong>. 
                    Silakan periksa kotak masuk atau folder spam Anda sebelum masuk.
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
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      !isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <AnimatePresence mode="wait">
                    {!isLogin && (
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

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                    >
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Jabatan</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(['wali_asuh', 'wali_kelas', 'guru_mapel'] as UserRole[]).map((r) => (
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
                             r === 'wali_kelas' ? <CheckSquare className="w-5 h-5" /> : 
                             <ClipboardList className="w-5 h-5" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">{r.replace('_', ' ')}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {!isLogin && role === 'guru_mapel' && (
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
                    className="group w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span className="uppercase tracking-widest text-xs">{isLogin ? 'Sign In Now' : 'Create Account'}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
