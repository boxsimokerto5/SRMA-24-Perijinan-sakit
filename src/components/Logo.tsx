import React from 'react';
import { Bell, Star } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-24 h-24',
    lg: 'w-40 h-40',
    xl: 'w-64 h-64'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Glossy Container - Inspired by the banner bell logo */}
      <div className={`${sizeClasses[size]} relative rounded-[28%] bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-700 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-3 border-2 border-white/30`}>
        {/* Glossy Reflection (Top Highlight) */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60" />
        
        {/* Logo Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-white">
          <div className="relative">
            <Bell className={`${iconSizes[size]} text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]`} />
            <div className="absolute -top-1 -right-1 bg-rose-500 rounded-full p-0.5 border border-white shadow-sm">
              <Star className="w-2 h-2 md:w-3 md:h-3 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* Inner Glow and Glass Effect */}
        <div className="absolute inset-0 rounded-[28%] shadow-[inset_0_2px_10px_rgba(255,255,255,0.5)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
    </div>
  );
}
