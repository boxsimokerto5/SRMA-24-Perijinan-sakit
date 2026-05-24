import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';

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
    <div className="fixed inset-0 bg-[#0ea5e9] flex flex-col items-center justify-center overflow-hidden z-[9999]">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-black/10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div 
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="inline-flex p-5 bg-white rounded-[2.5rem] shadow-2xl shadow-black/20 mb-8 border border-white/50"
        >
          <Logo size="lg" showText={false} />
        </motion.div>
        
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight font-display uppercase">
          SRMA 24
        </h1>
        
        <div className="flex items-center gap-4">
          <div className="w-8 h-[2px] bg-white/30" />
          <p className="text-white font-black uppercase tracking-[0.3em] text-[10px] italic">
            Cerdas Bersama Tumbuh Setara
          </p>
          <div className="w-8 h-[2px] bg-white/30" />
        </div>
      </motion.div>
      
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] italic">
          Digital Health System
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
