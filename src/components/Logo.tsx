import React from 'react';
import { ShieldPlus, CheckCircle2, Building2 } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Glossy Container */}
      <div className={`${sizeClasses[size]} relative rounded-[25%] bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-2 border border-white/20`}>
        {/* Glossy Reflection */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent skew-y-[-10deg] -translate-y-1/2" />
        
        {/* Logo Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-white">
          {showText && size !== 'sm' && (
            <div className="text-[8px] md:text-[10px] font-black tracking-tighter leading-none mb-1 text-center">
              SRMA 24<br />KEDIRI
            </div>
          )}
          
          <div className="flex items-center justify-center gap-1">
            <ShieldPlus className={`${iconSizes[size]} text-white drop-shadow-md`} />
            {size !== 'sm' && (
              <div className="flex flex-col -gap-1">
                <CheckCircle2 className="w-3 h-3 text-orange-400" />
                <Building2 className="w-3 h-3 text-white/80" />
              </div>
            )}
          </div>

          {showText && size !== 'sm' && (
            <div className="mt-1 text-[6px] md:text-[8px] font-bold uppercase tracking-widest text-center leading-tight">
              PERIZINAN<br />KESEHATAN
            </div>
          )}
        </div>

        {/* Inner Glow */}
        <div className="absolute inset-0 rounded-[25%] shadow-[inset_0_0_20px_rgba(255,255,255,0.2)] pointer-events-none" />
      </div>
    </div>
  );
}
