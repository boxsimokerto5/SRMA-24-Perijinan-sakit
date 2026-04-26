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
          className="fixed inset-0 z-[9999] bg-[#0ea5e9] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Background Decorative Circles */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.1 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            className="absolute w-[500px] h-[500px] bg-white rounded-full"
          />
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.05 }}
            transition={{ duration: 3, delay: 0.5, repeat: Infinity, repeatType: "reverse" }}
            className="absolute w-[300px] h-[300px] bg-white rounded-full"
          />

          <div className="relative flex flex-col items-center">
            {/* Animated Icon Container */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.2 
              }}
              className="mb-8 relative"
            >
              <Logo size="lg" />
              
              {/* Pulse Effect */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0, 0.3]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 border-4 border-white/30 rounded-[25%]"
              />
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
                SRMA 24 KEDIRI
              </h1>
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <HeartPulse className="w-4 h-4 text-rose-300" />
                </motion.div>
                <p className="text-indigo-100 font-bold uppercase tracking-[0.2em] text-xs">
                  Perizinan Siswa Sakit
                </p>
              </div>
            </motion.div>

            {/* Loading Bar */}
            <div className="mt-12 w-48 h-1 bg-[#0369a1] rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-full h-full bg-white/60"
              />
            </div>
          </div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-10 text-white text-[10px] font-medium tracking-widest uppercase"
          >
            Unit Pelayanan Kesehatan Sekolah
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
