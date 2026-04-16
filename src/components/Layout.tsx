import React, { useState, useEffect } from 'react';
import { LogOut, User, LayoutDashboard, History, BarChart3, Search, Bell as BellIcon, X, ChevronRight, Info, Bell } from 'lucide-react';
import Logo from './Logo';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface LayoutProps {
  children: React.ReactNode;
  user: AppUser;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function Layout({ children, user, activeTab = 'dashboard', onTabChange }: LayoutProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  const defaultBanners = [
    {
      id: 'def-1',
      title: "Informasi Kesehatan",
      content: "Jaga kebersihan diri dan lingkungan asrama untuk mencegah penyebaran penyakit.",
      color: "from-indigo-600 to-violet-600",
      icon: Info
    },
    {
      id: 'def-2',
      title: "Update Sistem",
      content: "Fitur Kartu Siswa kini lebih lengkap dengan data orang tua dan alamat.",
      color: "from-emerald-600 to-teal-600",
      icon: BarChart3
    },
    {
      id: 'def-3',
      title: "Pemberitahuan",
      content: "Pastikan semua perizinan sakit telah diverifikasi oleh dokter UKS.",
      color: "from-amber-500 to-orange-600",
      icon: BellIcon
    }
  ];

  const banners = announcements.length > 0 
    ? announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        color: "from-rose-600 to-orange-600",
        icon: Bell,
        author: "Kepala Sekolah"
      }))
    : defaultBanners.map(b => ({ ...b, author: "Sistem" }));

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'riwayat', label: 'Riwayat', icon: History },
    { id: 'statistik', label: 'Statistik', icon: BarChart3 },
    { id: 'profil', label: 'Profil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Logo size="sm" showText={false} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none tracking-tight font-display">SRMA 24 KEDIRI</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Digital Health System</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all">
              <BellIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => auth.signOut()}
              className="ml-1 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Top Banner / Announcement */}
      <AnimatePresence mode="wait">
        {showBanner && banners.length > 0 && banners[bannerIndex] && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 pt-4">
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${banners[bannerIndex].color} p-4 text-white shadow-lg shadow-indigo-100`}>
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      {React.createElement(banners[bannerIndex].icon, { className: "w-5 h-5" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black uppercase tracking-widest opacity-80">{banners[bannerIndex].title}</h4>
                        <span className="px-1.5 py-0.5 bg-white/20 rounded text-[8px] font-black uppercase tracking-tighter border border-white/10">
                          {banners[bannerIndex].author}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-tight mt-0.5">{banners[bannerIndex].content}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBanner(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Decorative circles */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200/60 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className="relative group py-2"
            >
              <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                activeTab === tab.id ? 'scale-110' : 'opacity-50 hover:opacity-100'
              }`}>
                <div className={`p-1 rounded-lg transition-colors ${
                  activeTab === tab.id ? 'text-indigo-600' : 'text-slate-600'
                }`}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${
                  activeTab === tab.id ? 'text-indigo-600' : 'text-slate-600'
                }`}>
                  {tab.label}
                </span>
              </div>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
