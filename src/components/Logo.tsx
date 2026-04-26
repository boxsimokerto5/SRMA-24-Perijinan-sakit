import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const id = useId().replace(/:/g, '');
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
      <div className={`${sizeClasses[size]} relative filter drop-shadow-xl`}>
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Outer Blue Gradient */}
            <linearGradient id={`bgGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            
            {/* Glossy Effect */}
            <linearGradient id={`glossGrad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0.1" />
            </linearGradient>

            <filter id={`shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Border/Glow */}
          <circle cx="100" cy="100" r="98" stroke="white" strokeWidth="1" className="opacity-40" />
          
          {/* Main Blue Circle Base */}
          <circle cx="100" cy="100" r="92" fill={`url(#bgGrad-${id})`} />
          
          {/* Inner White Circle */}
          <circle cx="100" cy="75" r="50" fill="white" />
          <circle cx="100" cy="75" r="50" stroke="#0ea5e9" strokeWidth="3" fill="none" />

          {/* Stethoscope Path */}
          <g transform="translate(100, 75)">
            {/* Head/Ear pieces */}
            <path d="M-25 -35 Q-25 -45 -10 -45 L10 -45 Q25 -45 25 -35" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="-25" cy="-35" r="3" fill="#0369a1" />
            <circle cx="25" cy="-35" r="3" fill="#0369a1" />
            
            {/* Tube forming a heart-like enclosure */}
            <path d="M0 -45 L0 -25" stroke="#0369a1" strokeWidth="4" fill="none" />
            <path d="M0 -25 C-45 -25 -45 35 0 45 C45 35 45 -25 0 -25" stroke="#0369a1" strokeWidth="4" fill="none" />
            
            {/* Chest piece circle */}
            <circle cx="30" cy="0" r="10" fill="white" stroke="#0369a1" strokeWidth="3" />
            <circle cx="30" cy="0" r="6" stroke="#0369a1" strokeWidth="1" fill="none" />
          </g>

          {/* Heart and Cross */}
          <g transform="translate(100, 85)">
            {/* Heart */}
            <path d="M0 25 C-25 15 -35 -15 -15 -25 C-5 -30 5 -20 10 -15 C15 -20 25 -30 35 -25 C55 -15 45 15 20 25 L10 32 Z" fill="#ef4444" transform="translate(-10, -10)" />
            
            {/* Cross Container */}
            <rect x="-12" y="-12" width="24" height="24" rx="4" fill="white" stroke="#0369a1" strokeWidth="1.5" />
            {/* Cross Symbol */}
            <rect x="-8" y="-2" width="16" height="4" fill="#0369a1" />
            <rect x="-2" y="-8" width="4" height="16" fill="#0369a1" />

            {/* Caduceus-like wing detail in cross (simplified) */}
            <path d="M-4 -4 L4 4 M-4 4 L4 -4" stroke="#0369a1" strokeWidth="1" />
            <circle cx="0" cy="0" r="1" fill="#0369a1" />
          </g>

          {/* Hospital/School Icon */}
          <g transform="translate(135, 115)" fill="#0369a1">
            <path d="M-8 0 L8 0 L8 10 L-8 10 Z" />
            <path d="M-10 0 L0 -8 L10 0 Z" />
            <rect x="-2" y="2" width="4" height="8" fill="white" />
            <rect x="-3" y="-2" width="6" height="2" fill="white" />
          </g>

          {/* Text Content */}
          <g style={{ filter: `url(#shadow-${id})` }}>
            <text x="100" y="145" textAnchor="middle" fill="white" className="font-black" style={{ fontSize: '18px', letterSpacing: '0.5px' }}>
              SURAT KESEHATAN
            </text>
            <text x="100" y="162" textAnchor="middle" fill="white" className="font-bold opacity-90" style={{ fontSize: '11px', letterSpacing: '1px' }}>
              UKS SRMA 24 KEDIRI
            </text>
          </g>

          {/* Top Gloss */}
          <path d="M20 60 Q100 10 180 60" stroke={`url(#glossGrad-${id})`} strokeWidth="12" strokeLinecap="round" className="opacity-40" />
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
