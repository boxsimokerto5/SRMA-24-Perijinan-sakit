import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_VERSION, GITHUB_CONFIG } from '../constants';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body: string;
  name: string;
}

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState<GitHubRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates();
    
    // Optional: Check every 6 hours if the app stays open
    const interval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    if (!GITHUB_CONFIG.owner || !GITHUB_CONFIG.repo) return;
    
    try {
      setChecking(true);
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/releases/latest`
      );
      
      if (!response.ok) throw new Error('Failed to fetch latest release');
      
      const data: GitHubRelease = await response.json();
      
      // Basic semver-ish comparison (stripping 'v' prefix if present)
      const latestVersion = data.tag_name.replace(/^v/, '');
      const currentVersion = APP_VERSION.replace(/^v/, '');
      
      if (latestVersion !== currentVersion) {
        setUpdateAvailable(data);
        setShowModal(true);

        // System Notification for Android/iOS
        if (Capacitor.isNativePlatform()) {
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: 'Update Aplikasi Tersedia!',
                  body: `Versi baru v${latestVersion} sudah dirilis. Segera perbarui aplikasi Anda.`,
                  id: 1,
                  schedule: { at: new Date(Date.now() + 1000) },
                  sound: 'default',
                  actionTypeId: '',
                  extra: null
                }
              ]
            });
          } catch (notificationError) {
            console.error('Local Notification Error:', notificationError);
          }
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <>
      {/* Floating Notification for Update */}
      <AnimatePresence>
        {!showModal && updateAvailable && (
          <motion.button
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={() => setShowModal(true)}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest border-2 border-white/20"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Update Tersedia (v{updateAvailable.tag_name})
          </motion.button>
        )}
      </AnimatePresence>

      {/* Update Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-0 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-6 shadow-inner">
                  <RefreshCw className="w-10 h-10 animate-spin-slow" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 font-display mb-2">Versi Baru Tersedia!</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Versi <span className="font-black text-indigo-600">v{updateAvailable.tag_name.replace(/^v/, '')}</span> sudah dirilis. 
                  Anda masih menggunakan versi <span className="font-bold text-slate-400">v{APP_VERSION}</span>.
                </p>

                {updateAvailable.body && (
                  <div className="mt-6 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Apa yang baru:</p>
                    <div className="text-xs text-slate-600 font-medium max-h-32 overflow-y-auto custom-scrollbar">
                      {updateAvailable.body.split('\n').map((line, i) => (
                        <p key={i} className="mb-1">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 flex flex-col gap-3">
                <a
                  href={updateAvailable.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Download className="w-4 h-4" /> Download Sekarang
                </a>
                
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                >
                  Nanti Saja
                </button>
              </div>
              
              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                  Disarankan untuk selalu menggunakan versi terbaru untuk keamanan
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
