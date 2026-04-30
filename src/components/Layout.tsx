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
    <div className={`min-h-screen bg-[#f8f3ed] flex flex-col font-sans ${hideChrome ? '' : 'pb-20'}`}>
      {/* Header */}
      {!hideChrome && (
        <header className="bg-[#f8f3ed]/90 backdrop-blur-md sticky top-0 z-30 border-b border-[#d7ccc8]/40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#5d4037] rounded-xl shadow-lg shadow-black/10">
                <Logo size="sm" showText={false} />
              </div>
              <div>
                <h1 className="text-lg font-black text-[#5d4037] leading-none tracking-tight font-display italic">SRMA 24</h1>
                <p className="text-[9px] text-[#8b5e3c]/60 font-bold uppercase tracking-widest mt-0.5">Digital Health System</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-full transition-all relative ${
                    showNotifications ? 'bg-[#5d4037] text-white shadow-lg' : 'text-[#8b5e3c] hover:text-[#5d4037] hover:bg-white/50'
                  }`}
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#f8f3ed] animate-bounce">
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
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-3xl shadow-2xl shadow-black/20 border border-[#d7ccc8]/20 overflow-hidden z-50 origin-top-right"
                      >
                        <div className="p-4 bg-[#5d4037] text-white">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-black uppercase tracking-widest text-[10px] text-amber-100/60">Pemberitahuan</h3>
                            <div className="flex items-center gap-2">
                               {unreadCount > 0 && (
                                 <button 
                                   onClick={markAllAsRead}
                                   className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                   title="Tandai semua dibaca"
                                 >
                                   <CheckSquare className="w-4 h-4" />
                                 </button>
                               )}
                               <button 
                                 onClick={clearNotifications}
                                 className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                 title="Bersihkan semua"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => setShowNotifications(false)}
                                 className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                               >
                                 <X className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                          <p className="text-[10px] opacity-70 font-medium">Anda memiliki {unreadCount} pesan baru</p>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-[#fdfcf0]">
                          {notifications.length > 0 ? (
                            <div className="divide-y divide-[#d7ccc8]/30">
                              {notifications.map((notif) => (
                                <div 
                                  key={notif.id}
                                  onClick={() => markAsRead(notif.id!)}
                                  className={`p-4 hover:bg-white transition-colors cursor-pointer group relative ${
                                    !notif.readBy.includes(user.uid) ? 'bg-amber-50/50' : ''
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                                      notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                      notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                      notif.type === 'error' ? 'bg-rose-50 text-rose-600' :
                                      'bg-[#f8f3ed] text-[#5d4037]'
                                    }`}>
                                      <Bell className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className={`text-xs font-black uppercase tracking-tight ${!notif.readBy.includes(user.uid) ? 'text-[#3e2723]' : 'text-[#8b5e3c]/60'}`}>
                                        {notif.title}
                                      </h4>
                                      <p className="text-[10px] text-[#8b5e3c]/80 mt-1 leading-relaxed font-medium">
                                        {notif.description}
                                      </p>
                                      <span className="text-[9px] text-[#8b5e3c]/40 mt-2 block font-black uppercase">
                                        {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: id }) : 'Baru saja'}
                                      </span>
                                    </div>
                                    {!notif.readBy.includes(user.uid) && (
                                      <div className="w-1.5 h-1.5 bg-[#8b5e3c] rounded-full mt-2" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-12 text-center">
                              <div className="w-16 h-16 bg-[#f8f3ed] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#d7ccc8]/20">
                                <BellIcon className="w-8 h-8 text-[#d7ccc8]" />
                              </div>
                              <h4 className="text-[#5d4037] font-black uppercase tracking-widest text-[10px]">Belum ada notifikasi</h4>
                              <p className="text-[#8b5e3c]/40 text-[9px] font-bold mt-1 uppercase tracking-tighter">
                                Semua pemberitahuan sistem akan muncul di sini.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {notifications.length > 0 && (
                          <div className="p-4 bg-white border-t border-[#d7ccc8]/20 text-center">
                            <button 
                              onClick={() => setShowNotifications(false)}
                              className="text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest hover:text-[#5d4037] transition-colors"
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
                className="p-3 text-[#8b5e3c] hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                title="Keluar"
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
                <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-r ${banners[bannerIndex].color.includes('rose') ? 'from-[#5d4037] to-[#8b5e3c]' : 'from-[#8b5e3c] to-[#a1887f]'} p-5 text-white shadow-xl shadow-black/10 border-b-4 border-black/10`}>
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                        {React.createElement(banners[bannerIndex].icon, { className: "w-5 h-5 text-amber-200" })}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-100 opacity-80 italic">{banners[bannerIndex].title}</h4>
                          <span className="px-1.5 py-0.5 bg-black/20 rounded text-[8px] font-black uppercase tracking-tighter border border-white/5 opacity-60">
                            {banners[bannerIndex].author}
                          </span>
                        </div>
                        <p className="text-sm font-bold leading-snug mt-1 text-white/90">{banners[bannerIndex].content}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowBanner(false)}
                      className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
                  <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/5 rounded-full blur-2xl" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Real-time Clock Bar */}
      {!hideChrome && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-4">
          <div className="bg-[#5d4037] p-[1.5px] rounded-2xl shadow-xl shadow-black/5 border border-[#3e2723]/10">
            <div className="flex items-center justify-center gap-4 py-3 px-6 bg-[#fdfcf0]/95 backdrop-blur-sm rounded-[calc(1rem-1.5px)]">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              <p className="text-[11px] font-black text-[#5d4037] uppercase tracking-[0.3em] font-display flex items-center gap-2 italic">
                {formatRealTime(currentTime)}
              </p>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${hideChrome ? '' : 'max-w-7xl mx-auto w-full px-4 py-8'}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideChrome && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#f8f3ed]/95 backdrop-blur-xl border-t border-[#d7ccc8]/40 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30 pb-safe">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            {tabs.map((tab) => (
              <button 
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className="relative group py-2"
              >
                <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                  activeTab === tab.id ? 'scale-110 mb-2' : 'opacity-40 hover:opacity-100'
                }`}>
                  <div className={`p-2 rounded-xl transition-all ${
                    activeTab === tab.id ? 'bg-[#5d4037] text-white shadow-xl rotate-3' : 'text-[#8b5e3c]'
                  }`}>
                    <tab.icon className="w-6 h-6" />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    activeTab === tab.id ? 'text-[#5d4037]' : 'text-[#8b5e3c]/40'
                  }`}>
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="navTab"
                      className="absolute -top-1 w-1 h-1 bg-[#5d4037] rounded-full"
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
