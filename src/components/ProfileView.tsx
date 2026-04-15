import React from 'react';
import { auth } from '../firebase';
import { AppUser } from '../types';
import { User, ShieldCheck, Bell, LogOut, Plus } from 'lucide-react';

interface ProfileViewProps {
  user: AppUser;
}

export default function ProfileView({ user }: ProfileViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-slate-900" />
        <div className="relative z-10">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl mx-auto flex items-center justify-center border-4 border-white mb-4">
            <User className="w-12 h-12 text-slate-900" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 font-display tracking-tight">{user.name}</h2>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-1">{user.role.replace('_', ' ')}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 font-display">Keamanan Akun</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ganti kata sandi & verifikasi</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-slate-300 rotate-45" />
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 font-display">Notifikasi</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atur preferensi pemberitahuan</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-slate-300 rotate-45" />
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-rose-50 p-6 rounded-[2rem] border border-rose-100 flex items-center justify-center gap-3 text-rose-600 font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-lg shadow-rose-100"
        >
          <LogOut className="w-5 h-5" /> Keluar Aplikasi
        </button>
      </div>
    </div>
  );
}
