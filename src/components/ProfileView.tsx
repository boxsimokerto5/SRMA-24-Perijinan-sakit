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
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-[#d7ccc8]/40 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-[#3e2723]" />
        <div className="relative z-10">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl mx-auto flex items-center justify-center border-4 border-white mb-4">
            <User className="w-12 h-12 text-[#3e2723]" />
          </div>
          <h2 className="text-2xl font-black text-[#3e2723] font-display tracking-tight italic">{user.name}</h2>
          <p className="text-[10px] font-black text-[#5d4037] uppercase tracking-[0.2em] mt-1 bg-[#f8f3ed] w-fit mx-auto px-3 py-1 rounded-full border border-[#d7ccc8]/20">
            {user.role.replace('_', ' ')} {user.mapel ? `(${user.mapel})` : ''}
          </p>
          <p className="text-xs text-[#8b5e3c]/40 mt-3 font-medium uppercase tracking-widest">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#d7ccc8]/40 flex items-center justify-between group cursor-pointer hover:bg-[#fdfcf0] transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#f8f3ed] text-[#8b5e3c] rounded-2xl group-hover:bg-[#5d4037] group-hover:text-white transition-all duration-500 border border-[#d7ccc8]/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-[#3e2723] font-display italic">Keamanan Akun</h4>
              <p className="text-[10px] font-bold text-[#8b5e3c]/40 uppercase tracking-widest">Ganti kata sandi & verifikasi</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-[#d7ccc8] rotate-45" />
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#d7ccc8]/40 flex items-center justify-between group cursor-pointer hover:bg-[#fdfcf0] transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#f8f3ed] text-[#8b5e3c] rounded-2xl group-hover:bg-[#5d4037] group-hover:text-white transition-all duration-500 border border-[#d7ccc8]/20">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-[#3e2723] font-display italic">Notifikasi</h4>
              <p className="text-[10px] font-bold text-[#8b5e3c]/40 uppercase tracking-widest">Atur preferensi pemberitahuan</p>
            </div>
          </div>
          <Plus className="w-5 h-5 text-[#d7ccc8] rotate-45" />
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-rose-50 p-6 rounded-[2rem] border border-rose-100 flex items-center justify-center gap-3 text-rose-600 font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-xl shadow-rose-100/50"
        >
          <LogOut className="w-5 h-5" /> Keluar Aplikasi
        </button>
      </div>
    </div>
  );
}
