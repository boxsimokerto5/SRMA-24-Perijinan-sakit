import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { AppUser, MadingPost } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Send, Plus, X, User, Clock, BookOpen, PenTool, Trash2, Edit2, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc } from 'firebase/firestore';

interface MadingSekolahViewProps {
  user: AppUser;
}

export default function MadingSekolahView({ user }: MadingSekolahViewProps) {
  const [posts, setPosts] = useState<MadingPost[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
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
      if (editingPostId) {
        await updateDoc(doc(db, 'mading', editingPostId), {
          content: content.trim(),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'mading'), {
          content: content.trim(),
          authorName: user.name,
          authorUid: user.uid,
          authorRole: user.role,
          createdAt: serverTimestamp()
        });
      }
      setContent('');
      setShowInput(false);
      setEditingPostId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'mading');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (post: MadingPost) => {
    setContent(post.content);
    setEditingPostId(post.id);
    setShowInput(true);
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
    <div className="w-full h-full space-y-4 animate-in fade-in duration-700 pb-32 min-h-screen bg-[#dcd0c0] selection:bg-[#8b5e3c]/20">
      {/* Vintage Leather-style Header */}
      <div className="w-full">
        <div className="relative bg-[#5d4037] px-6 py-8 shadow-2xl overflow-hidden border-b-4 border-[#3e2723]">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
          
          <div className="relative z-10 flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#fdfcf0] rounded-2xl shadow-lg transform -rotate-3 border border-amber-100/50">
                <BookOpen className="w-6 h-6 text-[#5d4037]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#fdfcf0] font-display tracking-tight leading-tight uppercase">
                  Mading Sekolah
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-0.5 w-8 bg-amber-400/50 rounded-full" />
                  <p className="text-[9px] font-black text-amber-100/50 uppercase tracking-[0.4em]">
                    Buku Diary Digital
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowInput(true)}
              className="p-4 bg-[#fdfcf0] text-[#3e2723] rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2 font-black border-2 border-[#d7ccc8]"
              title="Tulis Catatan"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Diary Entry Input Modal */}
      <AnimatePresence>
        {showInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-xl"
            >
               {/* Binder Rings Decor */}
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-10 h-3 bg-gradient-to-r from-[#8b5e3c] to-[#d7ccc8] rounded-full shadow-xl border border-[#5d4037]/20" />
                ))}
              </div>

              <div className="bg-[#fffdfa] rounded-r-3xl rounded-l-lg shadow-[20px_20px_60px_rgba(0,0,0,0.3)] p-8 sm:p-12 border-l-[50px] border-[#ede8dd] relative overflow-hidden">
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/felt.png")' }} />
                
                <button 
                  onClick={() => {
                    setShowInput(false);
                    setEditingPostId(null);
                    setContent('');
                  }}
                  className="absolute top-6 right-6 p-2 hover:bg-[#ede8dd] rounded-full text-[#8b5e3c] transition-colors z-30"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="relative z-10 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-[#3e2723] font-display italic tracking-tighter">
                      {editingPostId ? 'Mengubah Catatan...' : 'Tinta untuk Hari Ini'}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-black text-[#8b5e3c]/60 uppercase tracking-widest bg-[#fdfcf0] w-fit px-3 py-1 rounded-full border border-[#d7ccc8]/40">
                      <Clock className="w-3 h-3" />
                      {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#d7ccc8]/30" />
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Sayang diary, aku ingin bercerita..."
                        className="w-full min-h-[300px] pl-8 pr-4 py-2 bg-transparent outline-none transition-all font-handwriting text-3xl text-[#2d241e] resize-none leading-relaxed placeholder:text-[#d7ccc8]/30"
                        style={{ 
                          backgroundImage: 'linear-gradient(transparent, transparent 2.45rem, #ede8dd 2.45rem)',
                          backgroundSize: '100% 2.5rem'
                        }}
                        disabled={loading}
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1 flex items-center gap-3 bg-[#fdfcf0]/80 p-4 rounded-2xl border border-[#d7ccc8]/40 w-full shadow-inner">
                        <div className="w-10 h-10 bg-[#5d4037] rounded-xl flex items-center justify-center text-white shadow-lg">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[#3e2723] leading-none">{user.name}</p>
                          <p className="text-[10px] font-bold text-[#8b5e3c]/60 uppercase tracking-widest mt-1">{getRoleLabel(user.role)}</p>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="w-full sm:w-auto px-10 py-5 bg-[#5d4037] text-white font-black rounded-2xl shadow-2xl hover:bg-[#3e2723] hover:translate-y-[-2px] active:translate-y-[1px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-xs"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 rotate-45 text-amber-200" /> Simpan Catatan</>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diary List (Chat Style - Full Width) */}
      <div className="flex flex-col space-y-4 w-full px-2 sm:px-6 py-4 max-w-7xl mx-auto">
        {posts.map((post, idx) => {
          const isMe = post.authorUid === user.uid;
          const isAdminUser = user.role === 'kepala_sekolah'; // Only Kepsek is admin for mading edit/delete of others

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`relative max-w-[92%] sm:max-w-[85%] group ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Author Info Tab */}
                {!isMe && (
                  <div className="flex items-center gap-2 mb-1 ml-4 px-3 py-1 bg-[#8b5e3c]/10 rounded-t-xl border-x border-t border-[#8b5e3c]/20">
                     <span className="text-[10px] font-black text-[#5d4037] uppercase tracking-widest font-display truncate max-w-[120px]">
                       {post.authorName}
                     </span>
                     <span className="text-[8px] font-bold text-[#8b5e3c]/50 uppercase tracking-wider">
                       • {getRoleLabel(post.authorRole)}
                     </span>
                  </div>
                )}
                {isMe && (
                  <div className="flex items-center gap-2 mb-1 mr-4 px-3 py-1 bg-white/20 rounded-t-xl border-x border-t border-white/30">
                     <span className="text-[8px] font-bold text-[#5d4037]/60 uppercase tracking-wider">
                       Anda • {getRoleLabel(post.authorRole)}
                     </span>
                  </div>
                )}

                <div className={`
                  relative w-full overflow-hidden
                  ${isMe 
                    ? 'bg-[#fffef7] text-[#2d241e] rounded-2xl rounded-tr-none shadow-[2px_2px_15px_rgba(0,0,0,0.05)] border-r-4 border-[#8b5e3c]' 
                    : 'bg-[#f8f1e5] text-[#3e2723] rounded-2xl rounded-tl-none shadow-[2px_2px_15px_rgba(0,0,0,0.05)] border-l-4 border-[#5d4037]'
                  }
                  p-5 sm:p-7 border-b-2 border-black/5
                `}>
                  {/* Paper Texture Overlay */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/felt.png")' }} />
                  
                  {/* Handwriting Content */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-4 mb-2">
                       <div className="flex-1">
                        <div className={`font-handwriting ${isMe ? 'text-3xl' : 'text-2xl'} leading-snug whitespace-pre-wrap select-text`}>
                          {post.content}
                        </div>
                       </div>
                       
                       <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                          <span className="text-[9px] font-black text-amber-900/30 uppercase tracking-tighter">
                            {post.createdAt ? format(post.createdAt.toDate(), 'HH:mm • d MMM', { locale: id }) : '--:--'}
                          </span>
                       </div>
                    </div>

                    {/* Actions Panel */}
                    {(isMe || isAdminUser) && (
                      <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#8b5e3c]/5">
                        <div className="flex-1" />
                        <button
                          onClick={() => startEdit(post)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8b5e3c]/5 text-[#8b5e3c] rounded-lg hover:bg-[#8b5e3c] hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                          title="Ubah Catatan"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Date Tag Overlay (Hidden by default, shows on hover or mobile) */}
                  {post.updatedAt && (
                    <div className="absolute bottom-1 left-4">
                       <span className="text-[7px] font-bold text-[#8b5e3c]/40 uppercase tracking-widest italic">
                         Disunting • {format(post.updatedAt.toDate(), 'd MMM HH:mm', { locale: id })}
                       </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {posts.length === 0 && (
          <div className="py-32 text-center bg-white/20 rounded-[3rem] border-4 border-dashed border-[#8b5e3c]/20 mx-4">
            <BookOpen className="w-16 h-16 text-[#8b5e3c]/20 mx-auto mb-4" />
            <h3 className="text-xl font-black text-[#5d4037]/40 font-display uppercase tracking-widest mb-2">Belum Ada Goresan Pena</h3>
            <p className="text-xs font-bold text-[#8b5e3c]/30 uppercase tracking-[0.2em]">Bagikan ceritamu dengan menekan tombol pena di atas.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile Access (Optional since we have header one) */}
      <motion.button
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        onClick={() => setShowInput(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#5d4037] text-white rounded-full shadow-2xl flex items-center justify-center sm:hidden z-40 border-4 border-[#fffef7] active:scale-90 transition-transform"
      >
        <Plus className="w-8 h-8" />
      </motion.button>
    </div>
  );
}
