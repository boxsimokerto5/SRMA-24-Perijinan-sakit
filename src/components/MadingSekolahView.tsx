import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { AppUser, MadingPost } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Send, Plus, Clock, BookOpen, Trash2, Loader2, Search, History } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan mading ini?')) return;
    
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

  const filteredPosts = posts.filter(post => {
    const term = searchQuery.toLowerCase();
    return (
      post.content.toLowerCase().includes(term) ||
      post.authorName.toLowerCase().includes(term) ||
      getRoleLabel(post.authorRole).toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full mix-blend-normal space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* Dynamic Header Block (Compact, aligned with Memorandum style) */}
      <div className="bg-[#3e2723] rounded-2xl p-4 md:p-5 text-white relative overflow-hidden shadow-md border border-[#5d4037]/60">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 text-left">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#d7ccc8] rounded-xl flex items-center justify-center shadow-md shadow-black/20 shrink-0">
              <BookOpen className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-display tracking-tight leading-none italic uppercase">Mading Sekolah</h1>
                <span className="bg-[#d7ccc8]/20 text-amber-200 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-white/10">
                  OFFICIAL
                </span>
              </div>
              <p className="text-stone-300 text-[8px] font-bold mt-1 uppercase tracking-[0.15em] italic opacity-80 leading-snug">
                Papan Informasi Digital Terpadu Peserta Didik & Staf
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowInput(!showInput)}
            className={`group px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm italic border-b-2 shrink-0 ${
              showInput 
              ? 'bg-[#5d4037] text-stone-300 border-[#2d1e1a] hover:bg-[#2d1e1a]' 
              : 'bg-[#fcfaf6] text-[#3e2723] border-[#d7ccc8] hover:bg-white'
            }`}
          >
            {showInput ? 'Batal' : (
              <>
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                Terbitkan Informasi
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inline sliding post write form (Compact, aligned with Memorandum formulation) */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="bg-[#fcfaf6] rounded-2xl p-5 shadow-lg border border-[#d7ccc8]/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] ml-0.5 italic">
                    Konten Informasi Mading
                  </label>
                  <textarea
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tuliskan detail catatan, pengumuman, atau artikel informasi mading di sini..."
                    className="w-full bg-white border border-stone-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#3e2723] transition-all font-medium text-stone-700 min-h-[140px] text-xs italic shadow-inner placeholder:text-stone-300"
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
                  <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-xl border border-stone-100 shadow-sm w-full sm:w-auto">
                    <div className="w-7 h-7 rounded-md bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-[11px]">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-[#3e2723] leading-none italic">{user.name}</p>
                      <p className="text-[7px] font-bold text-stone-400 uppercase tracking-widest mt-0.5 italic">{getRoleLabel(user.role)}</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !content.trim()}
                    className="w-full sm:w-auto bg-[#3e2723] text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-[0.2em] shadow-md hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-[9px] italic border-b-2 border-stone-950 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-amber-200 rotate-45" />
                        Sahkan & Bagikan Sekarang
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archives and Listing (Compact, aligned with Arsip Memorandum) */}
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-100 shadow-sm shrink-0">
              <History className="w-5 h-5 text-[#3e2723]" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#3e2723] tracking-tight uppercase italic leading-none font-display">Koleksi Informasi</h3>
              <p className="text-[8px] font-black text-stone-300 uppercase tracking-[0.15em] italic mt-1 leading-none">
                Papan Berita Digital Terkini
              </p>
            </div>
          </div>
          
          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 group-focus-within:text-[#3e2723] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter mading..."
              className="w-full bg-white border border-stone-100 rounded-xl pl-9 pr-3 py-2 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-[#3e2723] transition-all italic text-[#3e2723] shadow-inner placeholder:text-stone-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPosts.map((post, idx) => {
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
                layout
                key={post.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden text-left flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-1.5 h-full bg-[#3e2723] opacity-0 group-hover:opacity-100 transition-all duration-500" />
                
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 md:gap-3">
                       <div className="w-8 h-8 rounded-lg bg-[#d7ccc8] flex items-center justify-center text-[#3e2723] font-black italic shadow-inner shrink-0 text-xs">
                         {post.authorName?.charAt(0).toUpperCase() || 'M'}
                       </div>
                       <div className="text-left">
                         <p className="font-extrabold text-[#3e2723] text-[10px] leading-none flex items-center gap-1.5 italic">
                           {post.authorName}
                           {isMe && (
                             <span className="bg-[#3e2723] text-amber-200 text-[5px] px-1 rounded-sm uppercase tracking-widest font-black leading-none py-0.5">ANDA</span>
                           )}
                         </p>
                         <p className="text-[6px] font-black text-stone-400 uppercase tracking-[0.1em] bg-stone-50 px-1 py-0.5 rounded italic mt-1 inline-block leading-none">
                           {getRoleLabel(post.authorRole)}
                         </p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-[#ea580c] uppercase tracking-widest italic bg-orange-50 px-2 py-0.5 rounded">
                        {format(postDate, 'dd MMM yyyy')}
                      </span>
                      {(isMe || isAdminUser) && (
                        <button
                          onClick={() => handleDelete(post.id!)}
                          className="w-7 h-7 bg-stone-50 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all flex items-center justify-center border border-transparent hover:border-rose-100 shrink-0"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative pl-3 border-l-2 border-[#3e2723]/10">
                    <p className="text-[#3e2723] text-[11px] italic leading-relaxed whitespace-pre-wrap">
                      "{displayText}"
                    </p>
                    {shouldTruncate && (
                      <button
                        onClick={() => toggleExpand(post.id!)}
                        className="text-[#5d4037] hover:text-[#3e2723] font-black text-[7px] uppercase tracking-widest italic mt-2 inline-flex items-center gap-1 bg-stone-50 hover:bg-stone-100 px-2 py-1 rounded transition-all select-none"
                      >
                        {isExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}
                      </button>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[7px] font-black uppercase text-stone-400 tracking-wider">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#3e2723]/40 shrink-0" />
                      <span>{format(postDate, 'EEEE, d MMMM yyyy • HH:mm', { locale: id })} WIB</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredPosts.length === 0 && (
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-stone-50 relative overflow-hidden">
              <BookOpen className="w-12 h-12 text-stone-100 mb-3 opacity-50" />
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] italic">Catatan mading tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
