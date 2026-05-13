import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';

interface SplashScreenProps {
  onComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-[#3e2723] flex flex-col items-center justify-center overflow-hidden z-[9999]">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-amber-400 rounded-3xl flex items-center justify-center shadow-2xl mb-8">
          <ShieldAlert className="w-12 h-12 text-[#3e2723]" />
        </div>
        
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
          SRMA 24 KEDIRI
        </h1>
        <div className="flex items-center gap-3">
          <div className="w-12 h-[1px] bg-amber-400/40" />
          <p className="text-amber-200/60 text-[10px] font-black uppercase tracking-[0.4em] italic">
            Kediri Digital System
          </p>
          <div className="w-12 h-[1px] bg-amber-400/40" />
        </div>
      </motion.div>
      
      <div className="absolute bottom-12 text-white/20 text-[10px] font-black uppercase tracking-widest italic">
        Building Future Leaders
      </div>
    </div>
  );
};

export default SplashScreen;
