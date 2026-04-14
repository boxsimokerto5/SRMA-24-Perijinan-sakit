import React from 'react';
import { LogOut, User, LayoutDashboard, History, BarChart3, Search, Bell as BellIcon } from 'lucide-react';
import Logo from './Logo';
import { auth } from '../firebase';
import { AppUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: AppUser;
}

export default function Layout({ children, user }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20">
      {/* Header - Styled to match banner */}
      <header className="bg-indigo-950 sticky top-0 z-20 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <div>
              <h1 className="text-xl font-black text-white leading-none tracking-tight">SRMA 24 KEDIRI</h1>
              <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-widest mt-1">Sistem Perizinan Kesehatan Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all">
              <BellIcon className="w-5 h-5" />
            </button>
            <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all">
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => auth.signOut()}
              className="ml-2 p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Bottom Navigation - Styled to match banner */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-indigo-600">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-bold">Dashboard</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors">
            <History className="w-5 h-5" />
            <span className="text-[10px] font-bold">Riwayat</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors">
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-bold">Statistik</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-bold">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
