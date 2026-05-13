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
        <svg viewBox="0 0 1024 1024" className="w-full h-full p-4">
          {/* Background */}
          <rect width="1024" height="1024" fill="white" />
          
          {/* House Roof */}
          <path 
            d="M150 320 L512 80 L874 320" 
            stroke="#202020" 
            strokeWidth="60" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="none" 
          />
          
          {/* The Fountain Pen */}
          <g transform="translate(40, -40)">
            {/* Pen Body */}
            <rect x="780" y="120" width="70" height="500" rx="15" fill="#202020" />
            {/* Clip */}
            <rect x="850" y="180" width="15" height="150" rx="5" fill="#202020" />
            {/* Red Grip/Band */}
            <rect x="780" y="380" width="70" height="80" fill="#BA1B1B" />
            {/* Red Ribs on Band */}
            <rect x="780" y="400" width="70" height="4" fill="#202020" opacity="0.2" />
            <rect x="780" y="420" width="70" height="4" fill="#202020" opacity="0.2" />
            <rect x="780" y="440" width="70" height="4" fill="#202020" opacity="0.2" />
            {/* Fountain Pen Nib */}
            <path d="M780 620 L815 760 L850 620 Z" fill="#BA1B1B" />
            <path d="M813 620 L817 720" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Logo Text - Approximate styling */}
          <text 
            x="440" 
            y="520" 
            textAnchor="middle" 
            fill="#202020" 
            style={{ 
              fontSize: '170px', 
              fontWeight: '900', 
              fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
              letterSpacing: '-5px'
            }}
          >
            Sekolah
          </text>
          
          <text 
            x="440" 
            y="720" 
            textAnchor="middle" 
            fill="#202020" 
            style={{ 
              fontSize: '190px', 
              fontWeight: '900', 
              fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
              letterSpacing: '-5px'
            }}
          >
            Rakyat
          </text>
          
          {/* Red Smile Arc */}
          <path 
            d="M480 560 Q530 620 580 560" 
            stroke="#BA1B1B" 
            strokeWidth="25" 
            strokeLinecap="round" 
            fill="none" 
          />

          {/* Open Book at the bottom */}
          <g transform="translate(0, 30)">
            <path 
              d="M120 880 Q512 800 904 880" 
              stroke="#202020" 
              strokeWidth="70" 
              strokeLinecap="round" 
              fill="none" 
            />
            <path 
              d="M150 860 Q512 815 874 860" 
              stroke="#BA1B1B" 
              strokeWidth="45" 
              strokeLinecap="round" 
              fill="none" 
            />
          </g>
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
