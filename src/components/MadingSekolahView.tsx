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
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  const toggleExpand = (postId: string) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

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
              className="relative w-full max-w-xl text-left"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 relative overflow-hidden border border-stone-100">
                <button 
                  onClick={() => {
                    setShowInput(false);
                    setContent('');
                  }}
                  className="absolute top-6 right-6 p-2 hover:bg-[#fcfaf6] rounded-full text-stone-400 transition-colors z-30"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative z-10 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-[#3e2723] font-display italic tracking-tight uppercase leading-none">
                      Catatan Mading Baru
                    </h3>
                    <div className="flex items-center gap-2 text-[8px] font-black text-[#5d4037] uppercase tracking-widest bg-[#fcfaf6] w-fit px-3 py-1 rounded-lg border border-stone-200 italic mt-2">
                      <Clock className="w-3.5 h-3.5 text-[#3e2723]" />
                      {format(new Date(), 'EEEE, dd MMMM yyyy - HH:mm', { locale: id })}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Ketik informasi yang ingin Anda bagikan kepada civitas..."
                        className="w-full min-h-[220px] bg-[#fcfaf6] rounded-xl p-5 outline-none border border-stone-200 focus:border-[#3e2723] focus:ring-4 focus:ring-[#3e2723]/5 transition-all font-medium text-stone-900 resize-none leading-relaxed placeholder:text-stone-300 text-xs italic"
                        disabled={loading}
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-grow flex items-center gap-3 bg-[#fcfaf6] p-4 rounded-xl border border-stone-100 shadow-inner w-full">
                        <div className="w-9 h-9 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-[#3e2723] leading-none italic">{user.name}</p>
                          <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-1 italic">{getRoleLabel(user.role)}</p>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="w-full sm:w-auto px-8 py-3.5 bg-[#3e2723] text-amber-200 font-black rounded-xl shadow-lg hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 uppercase tracking-widest text-[9px] italic border-b-2 border-stone-850"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 rotate-45" /> BAGIKAN SEKARANG</>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col space-y-4 w-full px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        {posts.map((post, idx) => {
          const isMe = post.authorUid === user.uid;
          const isAdminUser = user.role === 'kepala_sekolah';
          const postDate = post.createdAt?.toDate ? post.createdAt.toDate() : (post.createdAt instanceof Date ? post.createdAt : new Date());

          const isExpanded = expandedPosts[post.id!] || false;
          const shouldTruncate = post.content.length > 200;
          const displayText = shouldTruncate && !isExpanded 
            ? post.content.slice(0, 200) + '...' 
            : post.content;

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`relative w-full max-w-xl bg-white rounded-xl shadow-sm border p-4 sm:p-5 flex flex-col justify-between space-y-3.5 transition-all hover:shadow-md ${
                isMe 
                  ? 'border-[#8d6e63]/60 bg-[#faf6f0] ring-1 ring-[#8d6e63]/10' 
                  : 'border-stone-200 bg-white'
              }`}>
                {/* Header: Author Info & Delete Icon */}
                <div className="flex items-center justify-between gap-4 w-full border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-xs">
                      {post.authorName?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-extrabold text-[#3e2723] text-[11px] leading-tight flex items-center gap-1.5 italic truncate">
                        {post.authorName}
                        {isMe && (
                          <span className="bg-[#3e2723] text-amber-200 text-[6px] px-1 rounded-sm uppercase tracking-widest font-black leading-none py-0.5">ANDA</span>
                        )}
                      </p>
                      <p className="text-[7.5px] font-black text-stone-400 uppercase tracking-widest bg-stone-100 px-1.5 py-0.5 rounded italic mt-0.5 inline-block">
                        {getRoleLabel(post.authorRole)}
                      </p>
                    </div>
                  </div>

                  {(isMe || isAdminUser) && (
                    <button
                      onClick={() => handleDelete(post.id!)}
                      className="p-1 hover:bg-rose-50 text-stone-200 hover:text-rose-500 rounded transition-all"
                      title="Hapus Catatan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Content Section */}
                <div className="text-left font-sans">
                  <p className="text-[#3e2723] text-[11px] md:text-xs font-semibold leading-relaxed italic whitespace-pre-wrap">
                    "{displayText}"
                  </p>
                  {shouldTruncate && (
                    <button
                      onClick={() => toggleExpand(post.id!)}
                      className="text-[#5d4037] hover:text-[#3e2723] font-black text-[8px] uppercase tracking-widest italic mt-2.5 inline-flex items-center gap-1 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded transition-all select-none"
                    >
                      {isExpanded ? 'Tumpangkan (Sembunyikan)' : 'Selengkapnya (Baca Detail)'}
                    </button>
                  )}
                </div>

                {/* Footer: Date & Detailed Time integrated */}
                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-stone-400 tracking-wider pt-2.5 border-t border-stone-100">
                  <Clock className="w-3.5 h-3.5 text-[#3e2723]/60 shrink-0" />
                  <span className="text-left font-medium">
                    {format(postDate, 'EEEE, d MMMM yyyy • HH:mm:ss', { locale: id })} WIB
                  </span>
                </div>

              </div>
            </motion.div>
          );
        })}

        {posts.length === 0 && (
          <div className="py-24 text-center bg-white rounded-2xl border border-dashed border-stone-200 mx-4 flex flex-col items-center justify-center">
            <BookOpen className="w-16 h-16 text-stone-200 mx-auto mb-4" />
            <h3 className="text-xs font-black text-[#5d4037] uppercase tracking-widest mb-2 italic font-display">Belum Ada Informasi</h3>
            <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest italic max-w-sm leading-relaxed">Papan mading digital masih kosong. Bagikan informasi pertama untuk seluruh civitas.</p>
          </div>
        )}
      </div>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setShowInput(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#3e2723] hover:bg-black text-amber-200 rounded-full shadow-2xl flex items-center justify-center sm:hidden z-40 active:scale-90 transition-all border-b-2 border-stone-900"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
