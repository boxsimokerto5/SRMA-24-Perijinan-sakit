import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const id = useId();
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
      <div className={`${sizeClasses[size]} relative flex items-center justify-center overflow-hidden rounded-[25%] bg-white shadow-2xl`}>
        <svg viewBox="0 0 1024 1024" className="w-full h-full">
          <defs>
            <linearGradient id={`main_bg_${id}`} x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1"/>
              <stop offset="1" stopColor="#312E81"/>
            </linearGradient>
            <linearGradient id={`glass_top_${id}`} x1="512" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.2"/>
              <stop offset="1" stopColor="white" stopOpacity="0"/>
            </linearGradient>
            <filter id={`elevate_${id}`} x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="0" dy="30" stdDeviation="50" floodColor="#000" floodOpacity="0.4"/>
            </filter>
          </defs>
          <rect width="1024" height="1024" rx="286" fill={`url(#main_bg_${id})`} />
          <path d="M0 256H1024M0 512H1024M0 768H1024M256 0V1024M512 0V1024M768 0V1024" stroke="white" strokeOpacity="0.05" strokeWidth="2" />
          <g filter={`url(#elevate_${id})`}>
            <path d="M512 220C512 220 780 300 780 500C780 720 512 840 512 840C512 840 244 720 244 500C244 300 512 220 512 220Z" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="40" />
            <path d="M512 360V640M372 500H652" stroke="white" strokeWidth="110" strokeLinecap="round" />
            <circle cx="700" cy="350" r="50" fill="#F43F5E" stroke="white" strokeWidth="15" />
          </g>
          <rect width="1024" height="512" rx="286" fill={`url(#glass_top_${id})`} />
          <rect x="25" y="25" width="974" height="974" rx="271" stroke="white" strokeOpacity="0.15" strokeWidth="10" fill="none" />
        </svg>
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
