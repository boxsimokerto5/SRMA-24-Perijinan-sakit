import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  Menu, 
  User,
  Heart,
  MessageCircle,
  FileText
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AppUser } from '../types';
import Logo from './Logo';

// Views placeholders
import WaliAsuhView from './WaliAsuhView';
import WaliAsramaView from './WaliAsramaView';
import WaliKelasView from './WaliKelasView';
import GuruMapelView from './GuruMapelView';
import KepalaSekolahView from './KepalaSekolahView';

interface LayoutProps {
  user: AppUser;
}

const Layout: React.FC<LayoutProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Data Santri', icon: Users },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'health', label: 'Kesehatan', icon: Heart },
    { id: 'messages', label: 'Pesan', icon: MessageCircle },
    { id: 'settings', label: 'Setelan', icon: Settings },
  ];

  const renderView = () => {
    switch (user.role) {
      case 'wali_asuh':
        return <WaliAsuhView user={user} />;
      case 'wali_asrama':
        return <WaliAsramaView user={user} />;
      case 'wali_kelas':
        return <WaliKelasView user={user} />;
      case 'guru_mapel':
        return <GuruMapelView user={user} />;
      case 'kepala_sekolah':
        return <KepalaSekolahView user={user} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-stone-400 font-bold italic">
            Role not configured. Please contact administrator.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#fcf8f5] flex">
      {/* Sidebar - Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -320 }}
        className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-[#d7ccc8]/40 z-50 lg:relative lg:x-0 transform transition-none flex flex-col`}
      >
        <div className="p-10">
          <Logo />
        </div>

        <nav className="flex-1 px-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all italic group ${
                activeTab === item.id 
                  ? 'bg-[#3e2723] text-white shadow-xl shadow-amber-900/10 translate-x-2' 
                  : 'text-[#8b5e3c]/40 hover:text-[#3e2723] hover:bg-stone-50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-amber-400' : 'group-hover:text-amber-600'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-8">
          <div className="bg-[#fcf8f5] rounded-[2.5rem] p-6 border border-[#d7ccc8]/20 flex items-center gap-4 group cursor-pointer hover:bg-[#f8f5f2] transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-400/10 rounded-full -mr-6 -mt-6 blur-xl" />
            <div className="w-12 h-12 bg-[#3e2723] rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
              <User className="w-6 h-6 text-amber-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-[#3e2723] uppercase truncate italic">{user.name}</p>
              <p className="text-[8px] font-black text-[#8b5e3c]/60 uppercase tracking-widest italic">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center gap-3 py-4 text-[9px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors italic"
          >
            <LogOut className="w-4 h-4" />
            Sign Out Session
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 px-6 lg:px-12 flex items-center justify-between border-b border-[#d7ccc8]/20 bg-white/50 backdrop-blur-md sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-3 bg-white border border-[#d7ccc8]/40 rounded-xl text-[#3e2723]"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-4">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <p className="text-[9px] font-black text-[#8b5e3c]/60 uppercase tracking-widest italic">
                System Status: <span className="text-[#3e2723]">Active & Secured</span>
             </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-3 bg-white border border-[#d7ccc8]/40 rounded-xl text-[#8b5e3c] hover:bg-stone-50 transition-all relative">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Layout;
