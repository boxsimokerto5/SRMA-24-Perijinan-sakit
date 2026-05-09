import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartPulse } from 'lucide-react';
import Logo from './Logo';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for exit animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#4F46E5] to-[#312E81] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
             <motion.div 
               animate={{ 
                 rotate: 360,
                 scale: [1, 1.1, 1]
               }}
               transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-white/10 rounded-full blur-3xl" 
             />
             <motion.div 
               animate={{ 
                 rotate: -360,
                 scale: [1, 1.2, 1]
               }}
               transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
               className="absolute -bottom-1/4 -left-1/4 w-[800px] h-[800px] bg-indigo-400/10 rounded-full blur-3xl" 
             />
          </div>

          <div className="relative flex flex-col items-center">
            {/* Animated Icon Container */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 15,
                delay: 0.3 
              }}
              className="mb-12 relative p-4"
            >
              <div className="relative z-10 bg-white p-2 rounded-[2.5rem] shadow-2xl">
                <Logo size="xl" showText={false} />
              </div>
              
              {/* Pulse Effect */}
              <motion.div
                animate={{ 
                  scale: [1, 1.5],
                  opacity: [0.5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut"
                }}
                className="absolute inset-0 border-2 border-white/40 rounded-[3rem]"
              />
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center px-6"
            >
              <h1 className="text-5xl font-black text-white tracking-widest mb-4 italic drop-shadow-2xl">
                SRMA 24 KEDIRI
              </h1>
              <div className="flex items-center justify-center gap-4">
                <div className="h-[1px] w-12 bg-white/30" />
                <p className="text-indigo-100 font-black uppercase tracking-[0.4em] text-[10px]">
                  Digital Health Hub
                </p>
                <div className="h-[1px] w-12 bg-white/30" />
              </div>
            </motion.div>

            {/* Premium Loading Progress */}
            <div className="mt-20 w-64 h-1 bg-white/10 rounded-full overflow-hidden relative border border-white/5">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ 
                  duration: 2.5,
                  ease: "easeInOut"
                }}
                className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
              />
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-12 flex flex-col items-center gap-2"
          >
            <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase">
              Powered by SRMA 24 Tech
            </p>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <motion.div 
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                  className="w-1 h-1 bg-cyan-400 rounded-full" 
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
