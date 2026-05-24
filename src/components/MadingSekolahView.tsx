import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { AppUser, MadingPost } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Send, Plus, X, User, Clock, BookOpen, Trash2, Check, Loader2 } from 'lucide-react';
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

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    
    try {
      await deleteDoc(doc(db, 'mading', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'mading');
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
    <div className="w-full h-full space-y-6 animate-in fade-in duration-700 pb-32 min-h-screen bg-[#fcfaf6] selection:bg-[#3e2723] selection:text-white">
      {/* Modern Compact Header */}
      <div className="w-full px-2 sm:px-4">
        <div className="relative bg-[#3e2723] rounded-2xl px-4 py-5 md:py-6 shadow-xl overflow-hidden border border-[#5d4037] max-w-7xl mx-auto text-left">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full -mr-30 -mt-30 blur-2xl animate-pulse" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-xl shadow-lg backdrop-blur-md border border-white/10 -rotate-2 hover:rotate-0 transition-transform duration-500 shrink-0">
                <BookOpen className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white font-display tracking-tight leading-none uppercase italic">
                  Mading Sekolah
                </h2>
                <div className="flex items-center gap-2 mt-1.5 col-span-2">
                  <span className="h-1 w-6 bg-amber-400 rounded-full" />
                  <p className="text-[8px] font-black text-amber-100/60 uppercase tracking-[0.2em] italic">
                    PAPAN INFORMASI DIGITAL TERPADU
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowInput(true)}
              className="w-full sm:w-auto px-4 py-2 bg-[#fcfaf6] text-[#3e2723] rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 hover:bg-white transition-all shadow-md active:scale-95 border-b-2 border-stone-200 italic shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Tulis Catatan Baru
            </button>
          </div>
        </div>
      </div>

      {/* Modern Post Input Modal */}
      <AnimatePresence>
        {showInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-xl"
            >
              <div className="bg-white rounded-[3rem] shadow-2xl p-8 sm:p-12 relative overflow-hidden border border-slate-100">
                <button 
                  onClick={() => {
                    setShowInput(false);
                    setContent('');
                  }}
                  className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors z-30"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="relative z-10 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-900 font-display italic tracking-tighter">
                      Informasi Baru
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600/60 uppercase tracking-widest bg-indigo-50 w-fit px-3 py-1 rounded-full border border-indigo-100">
                      <Clock className="w-3 h-3" />
                      {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="relative">
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Ketik informasi yang ingin Anda bagikan..."
                        className="w-full min-h-[250px] bg-slate-50 rounded-[2.5rem] p-8 outline-none border-2 border-slate-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-900 resize-none leading-relaxed placeholder:text-slate-300 italic"
                        disabled={loading}
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1 flex items-center gap-4 bg-slate-50 p-5 rounded-[2rem] border border-slate-100 w-full shadow-inner">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-none italic">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{getRoleLabel(user.role)}</p>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-xs border-b-4 border-indigo-800 italic"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 rotate-45" /> Bagikan</>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col space-y-6 w-full px-4 sm:px-6 py-8 max-w-7xl mx-auto">
        {posts.map((post, idx) => {
          const isMe = post.authorUid === user.uid;
          const isAdminUser = user.role === 'kepala_sekolah';

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`relative max-w-[92%] sm:max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-2 px-6 py-2 rounded-full border shadow-sm ${
                  isMe ? 'bg-[#3e2723] text-amber-100 border-black mr-2' : 'bg-white border-stone-200 ml-2'
                }`}>
                   <span className={`text-[10px] font-black uppercase tracking-widest italic ${isMe ? 'text-amber-200' : 'text-[#3e2723]'}`}>
                     {isMe ? 'Anda' : post.authorName}
                   </span>
                   <span className={`text-[9px] font-bold uppercase tracking-wider italic ${isMe ? 'text-amber-100/50' : 'text-stone-300'}`}>
                     • {getRoleLabel(post.authorRole)}
                   </span>
                </div>

                <div className={`
                  relative w-full overflow-hidden p-8 sm:p-10 shadow-2xl border-b-8
                  ${isMe 
                    ? 'bg-white text-[#3e2723] rounded-[3.5rem] rounded-tr-none border-stone-100' 
                    : 'bg-white text-[#3e2723] rounded-[3.5rem] rounded-tl-none border-[#3e2723]'
                  }
                `}>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-6 border-b pb-6 mb-6 border-stone-50">
                       <div className="flex-1">
                        <div className={`text-xl font-black leading-relaxed italic font-display whitespace-pre-wrap ${isMe ? 'text-[#5d4037]' : 'text-[#3e2723]'}`}>
                          "{post.content}"
                        </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-stone-300">
                         {post.createdAt ? format(post.createdAt.toDate(), 'HH:mm • d MMM yyyy', { locale: id }) : '--:--'}
                       </span>
                       
                       {(isMe || isAdminUser) && (
                         <button
                           onClick={() => handleDelete(post.id!)}
                           className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                         >
                           <Trash2 className="w-4 h-4" /> Hapus
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {posts.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-stone-100 mx-4 flex flex-col items-center justify-center">
            <BookOpen className="w-20 h-20 text-stone-100 mx-auto mb-8" />
            <h3 className="text-3xl font-black text-stone-200 uppercase tracking-widest mb-4 italic font-display">Belum Ada Informasi</h3>
            <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.3em] italic max-w-sm leading-relaxed">Papan mading digital masih kosong. Bagikan informasi pertama untuk seluruh civitas.</p>
          </div>
        )}
      </div>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setShowInput(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center sm:hidden z-40 active:scale-90 transition-all border-b-4 border-slate-950"
      >
        <Plus className="w-8 h-8" />
      </motion.button>
    </div>
  );
}
