import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-24 h-24',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  const textSizes = {
    sm: 'text-[6px]',
    md: 'text-[10px]',
    lg: 'text-[14px]',
    xl: 'text-[18px]'
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} relative flex items-center justify-center overflow-hidden rounded-full bg-white shadow-xl`}>
        <img 
          src="https://i.ibb.co/h1dHjpr0/1777387841295.jpg" 
          alt="SRMA 24 KEDIRI Logo"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src = "https://img.icons8.com/color/512/hospital.png";
          }}
        />
      </div>
      
      {showText && size !== 'sm' && (
        <div className="mt-4 text-center">
          <p className={`font-black text-slate-900 uppercase tracking-[0.2em] ${textSizes[size]}`}>
            Sekolah Rakyat Menengah Atas
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
             <div className="h-[1px] w-8 bg-slate-200" />
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Digital Health Hub</span>
             <div className="h-[1px] w-8 bg-slate-200" />
          </div>
        </div>
      )}
    </div>
  );
}
