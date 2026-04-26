import React, { useState, useEffect } from 'react';
import { LogOut, User, LayoutDashboard, History, BarChart3, Search, Bell as BellIcon, X, ChevronRight, Info, Bell, Trash2, CheckSquare } from 'lucide-react';
import Logo from './Logo';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser, Announcement, AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc, arrayUnion, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface LayoutProps {
  children: React.ReactNode;
  user: AppUser;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hideChrome?: boolean;
}

export default function Layout({ children, user, activeTab = 'dashboard', onTabChange, hideChrome = false }: LayoutProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.readBy.includes(user.uid)).length;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRealTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date).replace(/\./g, ':');
  };

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

  // Notifications listener
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientRoles', 'array-contains', user.role),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, [user.role]);

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        readBy: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.readBy.includes(user.uid)).forEach(n => {
        batch.update(doc(db, 'notifications', n.id!), {
          readBy: arrayUnion(user.uid)
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const clearNotifications = async () => {
    if (!confirm('Hapus semua notifikasi?')) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id!));
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const defaultBanners = [
    {
      id: 'def-1',
      title: "Informasi Kesehatan",
      content: "Jaga kebersihan diri dan lingkungan asrama untuk mencegah penyebaran penyakit.",
      color: "from-sky-600 to-blue-600",
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
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans ${hideChrome ? '' : 'pb-20'}`}>
      {/* Header */}
      {!hideChrome && (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/60 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#0ea5e9] rounded-xl shadow-lg shadow-sky-200">
                <Logo size="sm" showText={false} />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 leading-none tracking-tight font-display">SRMA 24 KEDIRI</h1>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Digital Health System</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 rounded-full transition-all relative ${
                    showNotifications ? 'bg-[#0ea5e9] text-white shadow-lg shadow-sky-200' : 'text-slate-400 hover:text-[#0ea5e9] hover:bg-sky-50'
                  }`}
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNotifications(false)}
                        className="fixed inset-0 z-40 bg-black/5 backdrop-blur-sm md:hidden"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl shadow-sky-200/50 border border-sky-50 overflow-hidden z-50 origin-top-right"
                      >
                        <div className="p-4 bg-[#0ea5e9] text-white">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-black uppercase tracking-widest text-xs">Pemberitahuan</h3>
                            <div className="flex items-center gap-2">
                               {unreadCount > 0 && (
                                 <button 
                                   onClick={markAllAsRead}
                                   className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                   title="Tandai semua dibaca"
                                 >
                                   <CheckSquare className="w-4 h-4" />
                                 </button>
                               )}
                               <button 
                                 onClick={clearNotifications}
                                 className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                 title="Bersihkan semua"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => setShowNotifications(false)}
                                 className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                               >
                                 <X className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                          <p className="text-[10px] opacity-80 font-medium">Anda memiliki {unreadCount} pesan baru yang belum dibaca</p>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                          {notifications.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                              {notifications.map((notif) => (
                                <div 
                                  key={notif.id}
                                  onClick={() => markAsRead(notif.id!)}
                                  className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative ${
                                    !notif.readBy.includes(user.uid) ? 'bg-sky-50/30' : ''
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                                      notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                      notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                      notif.type === 'error' ? 'bg-rose-100 text-rose-600' :
                                      'bg-sky-100 text-sky-600'
                                    }`}>
                                      <Bell className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className={`text-sm font-bold ${!notif.readBy.includes(user.uid) ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {notif.title}
                                      </h4>
                                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        {notif.description}
                                      </p>
                                      <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                                        {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: id }) : 'Baru saja'}
                                      </span>
                                    </div>
                                    {!notif.readBy.includes(user.uid) && (
                                      <div className="w-2 h-2 bg-sky-600 rounded-full mt-2" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-12 text-center">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BellIcon className="w-8 h-8 text-slate-300" />
                              </div>
                              <h4 className="text-slate-900 font-black uppercase tracking-widest text-xs">Belum ada notifikasi</h4>
                              <p className="text-slate-400 text-xs mt-1">
                                Semua pemberitahuan sistem akan muncul di sini.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {notifications.length > 0 && (
                          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                            <button 
                              onClick={() => setShowNotifications(false)}
                              className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-sky-600 transition-colors"
                            >
                              Tutup Panel
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

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
      )}

      {/* Top Banner / Announcement */}
      {!hideChrome && (
        <AnimatePresence mode="wait">
          {showBanner && banners.length > 0 && banners[bannerIndex] && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 pt-4">
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${banners[bannerIndex].color} p-4 text-white shadow-lg shadow-sky-100`}>
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
      )}

      {/* Real-time Clock Bar */}
      {!hideChrome && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-4">
          <div className="animate-flowing-bg bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 p-[2px] rounded-2xl shadow-lg shadow-sky-100/50">
            <div className="flex items-center justify-center gap-4 py-2 px-6 bg-white/90 backdrop-blur-sm rounded-[calc(1rem-2px)]">
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-ping" />
              <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.25em] flex items-center gap-2">
                {formatRealTime(currentTime)}
              </p>
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-ping" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${hideChrome ? '' : 'max-w-7xl mx-auto w-full px-4 py-4'}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideChrome && (
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
                    activeTab === tab.id ? 'text-[#0ea5e9]' : 'text-slate-600'
                  }`}>
                    <tab.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${
                    activeTab === tab.id ? 'text-[#0ea5e9]' : 'text-slate-600'
                  }`}>
                    {tab.label}
                  </span>
                </div>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute -bottom-0 left-0 right-0 h-1 bg-[#0ea5e9] rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
