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

import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { AppUser } from './types';
import Auth from './components/Auth';
import Layout from './components/Layout';
import DokterView from './components/DokterView';
import WaliAsuhView from './components/WaliAsuhView';
import WaliKelasView from './components/WaliKelasView';
import SplashScreen from './components/SplashScreen';
import { setupPushNotifications } from './services/notificationService';
import { Loader2, AlertCircle } from 'lucide-react';

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Oops! Terjadi Kesalahan</h2>
            <p className="text-slate-500 text-sm mb-6">
              Aplikasi mengalami kendala teknis. Silakan muat ulang halaman.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
            >
              Muat Ulang
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-6 p-4 bg-slate-900 text-slate-100 text-[10px] text-left overflow-auto rounded-lg max-h-40">
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
            
            // Setup Push Notifications (DISABLED TEMPORARILY TO PREVENT CRASH)
            /*
            try {
              await setupPushNotifications(firebaseUser.uid);
            } catch (pushErr) {
              console.error('Push Notification Setup Error:', pushErr);
            }
            */
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

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium animate-pulse">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Kesalahan Koneksi</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => auth.signOut()}
              className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
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
      <Layout user={appUser}>
        {appUser.role === 'dokter' && <DokterView user={appUser} />}
        {appUser.role === 'wali_asuh' && <WaliAsuhView user={appUser} />}
        {appUser.role === 'wali_kelas' && <WaliKelasView user={appUser} />}
      </Layout>
    </ErrorBoundary>
  );
}
