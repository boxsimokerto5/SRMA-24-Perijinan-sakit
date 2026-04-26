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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-display tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#075e6e]" />
            Mading Sekolah
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Edisi Catatan Harian Warga Sekolah</p>
        </div>
        
        <button
          onClick={() => setShowInput(true)}
          className="p-4 bg-[#075e6e] text-white rounded-2xl shadow-xl shadow-[#075e6e]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-black text-sm"
        >
          <PenTool className="w-5 h-5" />
          <span className="hidden sm:inline">Tulis Catatan</span>
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
                        <Plus className="w-5 h-5" />
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

      {/* Mading Wall - Diary Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative"
          >
            {/* Paper Shadow Effect */}
            <div className="absolute inset-0 bg-slate-200 rounded-[2.5rem] translate-x-1 translate-y-1 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform" />
            
            <div className="relative bg-[#fdfbf6] p-8 rounded-[2.5rem] border-2 border-white shadow-sm flex flex-col min-h-[250px] overflow-hidden">
              {/* Diary Holes Effect */}
              <div className="absolute top-0 left-8 right-8 h-8 flex justify-between px-4">
                {[1,2,3,4,5,6].map(h => (
                  <div key={h} className="w-4 h-4 rounded-full bg-slate-100 shadow-inner -mt-2" />
                ))}
              </div>

              {/* Red Margin Line */}
              <div className="absolute top-0 bottom-0 left-8 w-[2px] bg-red-200/40" />

              <div className="flex-1 mt-4">
                <blockquote className="text-slate-800 font-medium leading-relaxed italic whitespace-pre-wrap">
                  "{post.content}"
                </blockquote>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#075e6e]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight">{post.authorName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getRoleLabel(post.authorRole)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end text-slate-400">
                    <Clock className="w-3 h-3" />
                    <p className="text-[9px] font-black uppercase tracking-tighter">
                      {post.createdAt ? format(post.createdAt.toDate(), 'HH:mm', { locale: id }) : '--:--'}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {post.createdAt ? format(post.createdAt.toDate(), 'EEEE, dd MMM', { locale: id }) : '-'}
                  </p>
                </div>
              </div>

              {/* Decorative Tape Effect */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-6 bg-[#075e6e]/10 backdrop-blur-sm -rotate-2" />
            </div>
          </motion.div>
        ))}

        {posts.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
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
