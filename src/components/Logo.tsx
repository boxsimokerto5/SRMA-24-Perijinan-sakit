import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface LogoProps {
  className?: string;
  iconSize?: number;
}

const Logo: React.FC<LogoProps> = ({ className = "text-amber-400", iconSize = 24 }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="p-2 bg-[#3e2723] rounded-xl shadow-lg border border-white/5">
        <ShieldAlert size={iconSize} className="text-amber-400" />
      </div>
      <div>
        <h1 className="text-xl font-black italic tracking-tighter leading-none mt-1">SRMA 24</h1>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60 italic">Kediri Digital</p>
      </div>
    </div>
  );
};

export default Logo;
