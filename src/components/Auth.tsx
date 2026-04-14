import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';
import { Home, CheckSquare, Mail, Lock, User as UserIcon, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('wali_asuh');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email,
            name,
            role,
            createdAt: new Date().toISOString()
          });
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
        setError('Koneksi ke server identitas gagal. Ini biasanya disebabkan oleh pemblokir iklan, VPN, atau gangguan jaringan. Silakan coba matikan VPN/Ad-blocker atau gunakan jaringan lain.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Email atau password salah. Jika Anda belum punya akun, silakan klik "Create Account" di bawah.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Silakan gunakan email lain atau masuk menggunakan akun yang sudah ada.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Metode login Email/Password belum diaktifkan di Firebase Console. Silakan hubungi administrator.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        setError('Terjadi kesalahan: ' + (err.message || 'Gagal memproses permintaan'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="inline-flex mb-4">
            <Logo size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-white">SRMA 24 KEDIRI</h2>
          <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest mt-1">Perizinan Siswa Sakit</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Pilih Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['wali_asuh', 'wali_kelas'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        role === r 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {r === 'wali_asuh' && <Home className="w-5 h-5" />}
                      {r === 'wali_kelas' && <CheckSquare className="w-5 h-5" />}
                      <span className="text-[10px] font-bold uppercase tracking-tighter">{r.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
