import React from 'react';
import { auth } from '../firebase';
import { AppUser } from '../types';
import { User, ShieldCheck, Bell, LogOut, Plus } from 'lucide-react';

interface ProfileViewProps {
  user: AppUser;
}

export default function ProfileView({ user }: ProfileViewProps) {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-12 lg:p-16 rounded-[4rem] shadow-xl border border-stone-100 text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-48 bg-[#3e2723] overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -right-24 -top-24 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
        </div>
        <div className="relative z-10 pt-10">
          <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl mx-auto flex items-center justify-center border-8 border-white mb-8 group-hover:scale-105 transition-transform duration-500 overflow-hidden relative">
             <div className="absolute inset-0 bg-[#3e2723]/5" />
             <User className="w-16 h-16 text-[#3e2723] relative z-10" />
          </div>
          <h2 className="text-4xl font-black text-[#3e2723] font-display tracking-tight italic uppercase mb-2 leading-none">
            {user.name}
          </h2>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="px-5 py-2 bg-[#fcfaf6] rounded-[1.25rem] border-2 border-stone-100/50 text-[11px] font-black uppercase tracking-[0.2em] italic text-[#3e2723]">
              {user.role.replace('_', ' ')} {user.mapel ? `(${user.mapel})` : ''}
            </span>
          </div>
          <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.4em] italic leading-none">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3.5rem] border-2 border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all text-left flex items-center justify-between group overflow-hidden border-b-8 border-stone-200 cursor-pointer">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:bg-[#3e2723] group-hover:text-white transition-all duration-500">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-[#3e2723] font-display italic uppercase tracking-tight">Keamanan Akun</h4>
              <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] mt-2 italic">Ganti kata sandi & verifikasi</p>
            </div>
          </div>
          <Plus className="w-6 h-6 text-stone-200 group-hover:text-[#3e2723] group-hover:rotate-45 transition-all duration-500 shrink-0" />
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] border-2 border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-stone-900/5 transition-all text-left flex items-center justify-between group overflow-hidden border-b-8 border-stone-200 cursor-pointer">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:bg-[#3e2723] group-hover:text-white transition-all duration-500">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-[#3e2723] font-display italic uppercase tracking-tight">Notifikasi</h4>
              <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] mt-2 italic">Atur preferensi pemberitahuan</p>
            </div>
          </div>
          <Plus className="w-6 h-6 text-stone-200 group-hover:text-[#3e2723] group-hover:rotate-45 transition-all duration-500 shrink-0" />
        </div>
      </div>

      <div className="max-w-md mx-auto pt-6">
        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-[#3e2723] p-8 rounded-[2.5rem] border-b-8 border-black flex items-center justify-center gap-6 text-white font-black uppercase tracking-[0.3em] hover:bg-rose-600 hover:border-rose-900 transition-all duration-500 shadow-2xl active:scale-95 italic text-sm"
        >
          <LogOut className="w-6 h-6" /> Keluar Aplikasi
        </button>
      </div>
    </div>
  );
}
