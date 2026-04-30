import React, { useState, useEffect, Component, ReactNode } from 'react';
import { auth, db } from './firebase';

// Global error handler for Capacitor/Android to prevent force close
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Prevent the default browser behavior (which might be a crash in some environments)
    event.preventDefault();
  });
}

import { onAuthStateChanged, User, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { AppUser } from './types';
import Auth from './components/Auth';
import Layout from './components/Layout';
import DokterView from './components/DokterView';
import WaliAsuhView from './components/WaliAsuhView';
import WaliKelasView from './components/WaliKelasView';
import KepalaSekolahView from './components/KepalaSekolahView';
import GuruMapelView from './components/GuruMapelView';
import WaliAsramaView from './components/WaliAsramaView';
import SplashScreen from './components/SplashScreen';
import { setupPushNotifications } from './services/notificationService';
import { Loader2, AlertCircle, Mail } from 'lucide-react';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8f3ed] flex items-center justify-center p-4 font-sans text-[#3e2723]">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border-b-8 border-[#5d4037] text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black mb-2 font-display italic">Oops! Terjadi Kesalahan</h2>
            <p className="text-[#8b5e3c]/60 text-sm mb-8 font-medium">
              Aplikasi mengalami kendala teknis. Silakan muat ulang halaman.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#5d4037] text-white font-black rounded-2xl hover:bg-[#3e2723] transition-all shadow-lg shadow-[#5d4037]/20 uppercase tracking-widest text-xs"
            >
              Muat Ulang Sistem
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-8 p-6 bg-[#3e2723] text-amber-100/70 text-[10px] text-left overflow-auto rounded-3xl max-h-40 font-mono border border-white/5">
                {JSON.stringify(this.state.error, null, 2)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Attempt to fetch user data
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            setAppUser(userData);
            setError(null);
            
            // Setup Push Notifications
            setTimeout(async () => {
              try {
                await setupPushNotifications(firebaseUser.uid);
              } catch (pushErr) {
                console.error('Push Notification Setup Error:', pushErr);
              }
            }, 1000);
          } else {
            console.warn('User document not found for UID:', firebaseUser.uid);
            // If user exists in Auth but not in Firestore, they might need to sign up again or be created
            setAppUser(null);
          }
        } catch (err: any) {
          console.error('Error fetching user data:', err);
          if (err.code === 'unavailable' || err.message.includes('offline')) {
            setError("Koneksi ke database terganggu. Silakan periksa koneksi internet Anda.");
          } else {
            setError("Gagal memuat data pengguna. Silakan coba masuk kembali.");
          }
        }
      } else {
        setAppUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f3ed] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#5d4037] animate-spin mx-auto mb-4" />
          <p className="text-[#8b5e3c] font-black uppercase tracking-widest text-[10px] animate-pulse italic">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f3ed] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border-b-8 border-rose-500 text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-[#3e2723] mb-2 font-display italic">Kesalahan Koneksi</h2>
          <p className="text-[#8b5e3c]/60 text-sm mb-8 font-medium italic">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#5d4037] text-white font-black rounded-2xl hover:bg-[#3e2723] transition-all shadow-xl shadow-[#5d4037]/20 uppercase tracking-widest text-xs"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => auth.signOut()}
              className="w-full py-4 bg-white border border-[#d7ccc8]/40 text-[#8b5e3c] font-black rounded-2xl hover:bg-[#f8f3ed] transition-all shadow-sm uppercase tracking-widest text-xs"
            >
              Keluar / Ganti Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !appUser) {
    return <Auth />;
  }

  return (
    <ErrorBoundary>
      <Layout 
        user={appUser} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        hideChrome={['wali_asuh', 'dokter', 'wali_kelas', 'guru_mapel', 'kepala_sekolah', 'wali_asrama'].includes(appUser.role)}
      >
        {!user.emailVerified && (
          <div className="fixed top-20 left-4 right-4 z-[100] bg-[#fdfcf0] border border-[#d7ccc8]/40 p-4 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#f8f3ed] rounded-2xl border border-[#d7ccc8]/20 text-[#5d4037]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#3e2723] leading-none uppercase tracking-widest">
                  Verifikasi Email
                </p>
                <p className="text-[9px] font-bold text-[#8b5e3c]/60 mt-1 italic">
                  Cek inbox Anda untuk keamanan akun maksimal.
                </p>
              </div>
            </div>
            <button 
              onClick={async () => {
                try {
                  await sendEmailVerification(user);
                  alert('Email verifikasi sent!');
                } catch (e) {
                  alert('Error sending email');
                }
              }}
              className="px-6 py-2.5 bg-[#5d4037] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-black/10 shrink-0 hover:bg-[#3e2723] transition-all"
            >
              Kirim Lagi
            </button>
          </div>
        )}
        {appUser.role === 'dokter' && <DokterView user={appUser} activeTab={activeTab} />}
        {appUser.role === 'wali_asuh' && <WaliAsuhView user={appUser} activeTab={activeTab} />}
        {appUser.role === 'wali_kelas' && <WaliKelasView user={appUser} activeTab={activeTab} />}
        {appUser.role === 'guru_mapel' && <GuruMapelView user={appUser} activeTab={activeTab} />}
        {appUser.role === 'kepala_sekolah' && <KepalaSekolahView user={appUser} activeTab={activeTab} />}
        {appUser.role === 'wali_asrama' && <WaliAsramaView user={appUser} activeTab={activeTab} />}
      </Layout>
    </ErrorBoundary>
  );
}
