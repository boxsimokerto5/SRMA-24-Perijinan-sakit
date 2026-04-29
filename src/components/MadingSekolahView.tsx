import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { AppUser, MadingPost } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Send, Plus, X, User, Clock, BookOpen, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MadingSekolahViewProps {
  user: AppUser;
}

export default function MadingSekolahView({ user }: MadingSekolahViewProps) {
  const [posts, setPosts] = useState<MadingPost[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'mading'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MadingPost));
      setPosts(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'mading');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'mading'), {
        content: content.trim(),
        authorName: user.name,
        authorUid: user.uid,
        authorRole: user.role,
        createdAt: serverTimestamp()
      });
      setContent('');
      setShowInput(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'mading');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      dokter: 'Dokter',
      wali_asuh: 'Wali Asuh',
      wali_kelas: 'Wali Kelas',
      kepala_sekolah: 'Kepala Sekolah',
      guru_mapel: 'Guru Mapel',
      wali_asrama: 'Wali Asrama'
    };
    return labels[role] || role;
  };

  return (
    <div className="w-full h-full space-y-6 animate-in fade-in duration-700 pb-24 px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm sticky top-0 z-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-display tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#075e6e]" />
            Mading Sekolah
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Edisi Catatan Harian Warga Sekolah</p>
        </div>
        
        <button
          onClick={() => setShowInput(true)}
          className="w-full sm:w-auto p-4 bg-[#075e6e] text-white rounded-2xl shadow-xl shadow-[#075e6e]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-sm"
        >
          <PenTool className="w-5 h-5" />
          <span>Tulis Catatan Baru</span>
        </button>
      </div>

      {/* Diary Entry Input Modal */}
      <AnimatePresence>
        {showInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#fdfbf6] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white"
            >
              <div className="p-8 space-y-6 relative">
                 <button 
                  onClick={() => setShowInput(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                    <PenTool className="w-6 h-6 text-[#075e6e]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Buat Catatan Baru</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bagikan informasi atau inspirasi</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Tuliskan isi catatan mading di sini..."
                      className="w-full min-h-[200px] p-6 bg-white rounded-[2rem] border-2 border-slate-100 focus:border-[#075e6e] outline-none transition-all font-medium text-slate-700 resize-none shadow-inner"
                      disabled={loading}
                    />
                    <div className="absolute top-0 bottom-0 left-8 w-[2px] bg-red-100/50 pointer-events-none" />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Identitas Penulis</p>
                      <p className="text-xs font-black text-[#075e6e]">{user.name} <span className="text-slate-400 text-[10px] font-bold">• {getRoleLabel(user.role)}</span></p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !content.trim()}
                    className="w-full py-4 bg-[#075e6e] text-white font-black rounded-2xl shadow-xl shadow-[#075e6e]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-[#085a6a]"
                  >
                    {loading ? (
                      <Clock className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Posting ke Mading
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mading List View */}
      <div className="space-y-4">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center"
          >
            {/* Meta Info Sidebar (Left) */}
            <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 sm:w-48 shrink-0">
               <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 text-[#075e6e] shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900 truncate leading-tight">{post.authorName}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getRoleLabel(post.authorRole)}</p>
              </div>
              <div className="hidden sm:block mt-2 h-px w-full bg-slate-50" />
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <Clock className="w-3 h-3" />
                <p className="text-[9px] font-black uppercase tracking-tight">
                  {post.createdAt ? format(post.createdAt.toDate(), 'HH:mm • dd/MM', { locale: id }) : '--:--'}
                </p>
              </div>
            </div>

            {/* Content Section (Center/Right) */}
            <div className="flex-1 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 group-hover:bg-white transition-colors duration-300">
               <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                {post.content}
              </p>
            </div>

            {/* Mobile Time (only visible on mobile as small accent) */}
            <div className="sm:hidden flex justify-end">
              <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                {post.createdAt ? format(post.createdAt.toDate(), 'HH:mm | dd MMM yyyy') : '-'}
              </span>
            </div>
          </motion.div>
        ))}

        {posts.length === 0 && (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
            <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada catatan di mading</p>
            <button
              onClick={() => setShowInput(true)}
              className="mt-6 text-[#075e6e] font-black text-sm hover:underline"
            >
              Mulai menulis catatan pertama
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
