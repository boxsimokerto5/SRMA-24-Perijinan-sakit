import React from 'react';
import { LogOut, User, Home, CheckSquare, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { auth } from '../firebase';
import { AppUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: AppUser;
}

export default function Layout({ children, user }: LayoutProps) {
  const getRoleIcon = () => {
    switch (user.role) {
      case 'dokter': return <Logo size="sm" showText={false} />;
      case 'wali_asuh': return <Home className="w-5 h-5" />;
      case 'wali_kelas': return <CheckSquare className="w-5 h-5" />;
      case 'kepala_sekolah': return <ShieldCheck className="w-5 h-5" />;
    }
  };

  const getRoleLabel = () => {
    switch (user.role) {
      case 'dokter': return 'Dokter';
      case 'wali_asuh': return 'Wali Asuh';
      case 'wali_kelas': return 'Wali Kelas';
      case 'kepala_sekolah': return 'Kepala Sekolah';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-indigo-600 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl shadow-sm">
              <Logo size="sm" showText={false} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight tracking-tight">SRMA 24 KEDIRI</h1>
              <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest opacity-80">Perizinan Siswa Sakit</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-white">{user.name || user.email}</span>
              <div className="flex items-center gap-1 text-[10px] text-indigo-200 font-black uppercase tracking-tighter">
                <div className="w-4 h-4 flex items-center justify-center">
                  {getRoleIcon()}
                </div>
                {getRoleLabel()}
              </div>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="p-2.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">© 2024 SRMA 24 KEDIRI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
