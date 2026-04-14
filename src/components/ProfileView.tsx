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
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-600 to-blue-600" />
        <div className="relative z-10">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-xl mx-auto flex items-center justify-center border-4 border-white mb-4">
            <User className="w-12 h-12 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">{user.name}</h2>
          <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-1">{user.role.replace('_', ' ')}</p>
          <p className="text-xs text-slate-400 mt-1">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900">Keamanan Akun</h4>
              <p className="text-xs text-slate-500">Ganti kata sandi dan verifikasi.</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-slate-300 rotate-45" />
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900">Notifikasi</h4>
              <p className="text-xs text-slate-500">Atur preferensi pemberitahuan.</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-slate-300 rotate-45" />
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-rose-50 p-6 rounded-3xl border border-rose-100 flex items-center justify-center gap-3 text-rose-600 font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Keluar Aplikasi
        </button>
      </div>
    </div>
  );
}
