import React from 'react';
import { LogOut, User, Stethoscope, Home, CheckSquare } from 'lucide-react';
import { auth } from '../firebase';
import { AppUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: AppUser;
}

export default function Layout({ children, user }: LayoutProps) {
  const getRoleIcon = () => {
    switch (user.role) {
      case 'dokter': return <Stethoscope className="w-5 h-5" />;
      case 'wali_asuh': return <Home className="w-5 h-5" />;
      case 'wali_kelas': return <CheckSquare className="w-5 h-5" />;
    }
  };

  const getRoleLabel = () => {
    switch (user.role) {
      case 'dokter': return 'Dokter';
      case 'wali_asuh': return 'Wali Asuh';
      case 'wali_kelas': return 'Wali Kelas';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">SRMA 24 KEDIRI</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Perizinan Siswa Sakit</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900">{user.name || user.email}</span>
              <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold uppercase tracking-tighter">
                {getRoleIcon()}
                {getRoleLabel()}
              </div>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
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
