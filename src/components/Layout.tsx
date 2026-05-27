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
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hideChrome?: boolean;
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, activeTab, onTabChange, hideChrome, children }) => {
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
    { id: 'students', label: 'Data Peserta Didik', icon: Users },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'health', label: 'Kesehatan', icon: Heart },
    { id: 'messages', label: 'Pesan', icon: MessageCircle },
    { id: 'settings', label: 'Setelan', icon: Settings },
  ];

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -320 }}
        className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 z-50 lg:relative lg:translate-x-0 transform transition-none flex flex-col`}
      >
        <div className="p-10">
          <Logo />
        </div>

        <nav className="flex-1 px-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (onTabChange) onTabChange(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all italic group ${
                activeTab === item.id 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 translate-x-2' 
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-sky-400' : 'group-hover:text-sky-600'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-8">
          <div className="bg-slate-50 rounded-[2.5rem] p-6 border border-slate-200 flex items-center gap-4 group cursor-pointer hover:bg-slate-100 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-sky-400/10 rounded-full -mr-6 -mt-6 blur-xl" />
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
              <User className="w-6 h-6 text-sky-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-900 uppercase truncate italic">{user.name}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">{user.role?.replace('_', ' ')}</p>
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
        <header className="h-24 px-6 lg:px-12 flex items-center justify-between border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-3 bg-white border border-slate-200 rounded-xl text-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-4">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                System Status: <span className="text-slate-900">Active & Secured</span>
             </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 transition-all relative">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
