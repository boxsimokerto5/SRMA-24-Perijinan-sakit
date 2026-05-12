import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, limit, deleteDoc, doc } from 'firebase/firestore';
import { WallMessage, AppUser } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, User, Clock, Trash2, Shield } from 'lucide-react';

interface WallViewProps {
  user: AppUser;
  wallType: 'asrama' | 'asuh' | 'kelas';
  title: string;
}

export default function WallView({ user, wallType, title }: WallViewProps) {
  const [messages, setMessages] = useState<WallMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'wall_messages'),
      where('wall_type', '==', wallType),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WallMessage));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wall_messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [wallType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content) return;

    setIsSubmitting(true);
    const path = 'wall_messages';
    try {
      await addDoc(collection(db, path), {
        content: content,
        author_name: user.name || user.email,
        author_uid: user.uid,
        author_role: user.role,
        wall_type: wallType,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    const path = `wall_messages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'wall_messages', messageId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sleek Compact Header */}
      <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-lg overflow-hidden border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black font-display tracking-tight leading-none">{title}</h1>
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">
                Resmi
              </span>
            </div>
            <p className="text-slate-400 text-[10px] font-semibold mt-1 uppercase tracking-widest">
              {wallType === 'kelas' ? 'Koordinasi Guru & Wali Kelas' : 'Informasi Tim Internal'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Area - Integrated & Sleek */}
      <div className="bg-white rounded-3xl p-4 shadow-md border border-slate-100 mx-auto max-w-4xl w-full sticky top-4 z-30 transition-shadow hover:shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Bagikan koordinasi atau informasi..."
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || isSubmitting}
            className="bg-indigo-600 text-white px-5 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[9px]"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      </div>

      {/* Messages Feed - Flowing downwards */}
      <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-30">
            <MessageSquare className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada pesan</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {messages.map((msg) => {
              const isMe = msg.author_uid === user.uid;
              const date = msg.createdAt?.toDate();
              const canDelete = isMe || user.role === 'kepala_sekolah';
              const isDeleting = deletingId === msg.id;
              
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`w-full max-w-[95%] md:max-w-[85%]`}>
                    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Compact Avatar */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-transform shadow-sm ${
                        isMe ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-slate-200'
                      }`}>
                        {msg.author_name.charAt(0)}
                      </div>

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                        {/* Meta */}
                        <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider truncate max-w-[120px]">
                            {msg.author_name}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                            {msg.author_role.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {/* Message Bubble */}
                        <div className={`p-4 lg:p-5 rounded-2xl shadow-sm relative group overflow-hidden ${
                          isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                          <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          
                          <div className={`mt-3 flex items-center justify-between gap-4 ${
                            isMe ? 'text-indigo-200/60' : 'text-slate-400'
                          }`}>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight">
                              <Clock className="w-2.5 h-2.5" />
                              {date ? format(date, 'HH:mm • dd MMM', { locale: id }) : '...'}
                            </div>

                            {canDelete && (
                              <div className="flex items-center gap-2">
                                {isDeleting ? (
                                  <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                                    <button
                                      onClick={() => msg.id && handleDelete(msg.id)}
                                      className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100"
                                    >
                                      HAPUS?
                                    </button>
                                    <button 
                                      onClick={() => setDeletingId(null)}
                                      className="text-[9px] font-black text-slate-400 hover:text-slate-600"
                                    >
                                      BATAL
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeletingId(msg.id || null)}
                                    className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                      isMe 
                                      ? 'hover:bg-white/10 text-white/40 hover:text-white' 
                                      : 'hover:bg-red-50 text-slate-300 hover:text-red-500'
                                    }`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
