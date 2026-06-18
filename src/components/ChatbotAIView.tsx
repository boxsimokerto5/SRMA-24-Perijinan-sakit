import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Trash2, Sparkles, MessageSquare, AlertCircle, RefreshCw, Loader2, ArrowLeft, ClipboardList, PenTool, Lightbulb, HeartHandshake } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotAIViewProps {
  user: any;
  isDarkMode: boolean;
}

// Custom simple High-Fidelity Markdown Renderer
function MarkdownRenderer({ content, isAi }: { content: string; isAi: boolean }) {
  if (!content) return null;

  const parseInlineStyles = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      if (text.startsWith('**', i)) {
        const nextIdx = text.indexOf('**', i + 2);
        if (nextIdx !== -1) {
          parts.push(
            <strong key={`bold-${i}`} className={`font-black tracking-tight ${isAi ? 'text-slate-950 dark:text-white' : 'text-white'}`}>
              {text.slice(i + 2, nextIdx)}
            </strong>
          );
          i = nextIdx + 2;
          continue;
        }
      }
      if (text.startsWith('*', i) && !text.startsWith('* ', i)) {
        const nextIdx = text.indexOf('*', i + 1);
        if (nextIdx !== -1) {
          parts.push(
            <strong key={`italic-bold-${i}`} className={`font-black tracking-tight ${isAi ? 'text-slate-950 dark:text-white' : 'text-white'}`}>
              {text.slice(i + 1, nextIdx)}
            </strong>
          );
          i = nextIdx + 1;
          continue;
        }
      }
      if (text.startsWith('`', i)) {
        const nextIdx = text.indexOf('`', i + 1);
        if (nextIdx !== -1) {
          parts.push(
            <code key={`code-${i}`} className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold ${isAi ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-700 text-white'}`}>
              {text.slice(i + 1, nextIdx)}
            </code>
          );
          i = nextIdx + 1;
          continue;
        }
      }
      parts.push(text[i]);
      i++;
    }
    return parts;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let listCounter = 0;

  const flushList = () => {
    if (currentList.length > 0 && currentListType) {
      const type = currentListType;
      const keyStr = `list-${elements.length}-${listCounter++}`;
      if (type === 'ul') {
        elements.push(
          <ul key={keyStr} className="list-disc pl-5 mb-2.5 space-y-1 font-medium text-xs">
            {currentList}
          </ul>
        );
      } else {
        elements.push(
          <ol key={keyStr} className="list-decimal pl-5 mb-2.5 space-y-1 font-medium text-xs">
            {currentList}
          </ol>
        );
      }
      currentList = [];
      currentListType = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${lineIdx}`} className={`text-[11px] font-black mb-1 mt-2 tracking-tight uppercase ${isAi ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
          {parseInlineStyles(trimmed.slice(4))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${lineIdx}`} className={`text-xs font-black mb-1 mt-2 tracking-tight uppercase ${isAi ? 'text-slate-850 dark:text-white' : 'text-white'}`}>
          {parseInlineStyles(trimmed.slice(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${lineIdx}`} className={`text-sm font-black mb-1 mt-2 tracking-tight uppercase ${isAi ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
          {parseInlineStyles(trimmed.slice(2))}
        </h1>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      currentList.push(
        <li key={`li-${lineIdx}`} className="mb-0.5">
          {parseInlineStyles(trimmed.slice(2))}
        </li>
      );
      return;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (orderedMatch) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      currentList.push(
        <li key={`li-${lineIdx}`} className="mb-0.5">
          {parseInlineStyles(orderedMatch[2])}
        </li>
      );
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    flushList();
    elements.push(
      <p key={`p-${lineIdx}`} className="mb-1.5 last:mb-0 leading-relaxed font-semibold text-xs">
        {parseInlineStyles(line)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
}

const PRESET_PROMPTS = [
  {
    title: 'Adab & Akhlak Anak Asuh',
    icon: Lightbulb,
    description: 'Draf tausiyah adab asrama SA 24.',
    prompt: 'Tolong buatkan draf teks tausiyah/kultum singkat yang menyentuh hati khusus untuk anak asuh Sekolah Rakyat (SA) 24 Kediri bertema "Menjaga Keharmonisan, Adab Berbicara, dan Saling Menyayangi Sesama Saudara di Kamar Asrama". Cantumkan hadits atau ayat Al-Qur\'an penunjang yang relevan.'
  },
  {
    title: 'Konseling & Pendampingan',
    icon: HeartHandshake,
    description: 'Metode persuasif hadapi anak asuh malas.',
    prompt: 'Bagaimana pendekatan counseling terbaik bagi anak asuh di asrama SA 24 KEDIRI yang menunjukkan tanda-tanda homesick, bermalas-malasan mengikuti kegiatan ibadah subuh berjamaah, atau sulit diatur?'
  },
  {
    title: 'Rekomendasi Tausiyah Subuh',
    icon: Sparkles,
    description: 'Topik kultum harian pengasuhan.',
    prompt: 'Berikan 5 ide topik kultum subuh dan materi kepengasuhan yang interaktif dan menarik bagi anak asuh Sekolah Rakyat SA 24 KEDIRI untuk melatih kemandirian, kedisiplinan, dan tanggung jawab sosial.'
  },
  {
    title: 'Panduan Disiplin Positif',
    icon: PenTool,
    description: 'Draf bimbingan penyelesaian masalah.',
    prompt: 'Tolong buatkan draf panduan pembinaan persuasif sekaligus tegas bagi Wali Asuh di asrama SA 24 KEDIRI untuk mendisiplinkan anak asuh yang ketahuan tidak melaksanakan piket kebersihan kamar, dengan tetap berorientasi pada kasih sayang dan edukasi akhlak.'
  }
];

export default function ChatbotAIView({ user, isDarkMode }: ChatbotAIViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`srma24_chat_history_${user?.uid || 'default'}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(hydrated);
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    } else {
      // Set initial greeting
      const greetName = user?.displayName || user?.email?.split('@')[0] || 'Wali Asuh';
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `*Assalamualaikum Warahmatullahi Wabarakatuh, ${greetName}!* \n\nSaya adalah **Eccko Assistant**, asisten cerdas asrama Anda yang didukung oleh AI. Saya siap mendampingi, memberikan solusi praktis, dan menyajikan konten kepengasuhan dalam membina anak-anak asuh kita di **Sekolah Rakyat (SA) 24 KEDIRI**.\n\nBeberapa bantuan yang siap saya berikan:\n- **Draf Tausiyah / Kultum Subuh** yang inspiratif dan berakar pada nilai-nilai akhlak mulia.\n- **Metode Konseling & Pendampingan Anak Asuh** dengan asas disiplin positif dan empati.\n- **Resolusi Konflik & Manajemen Asrama** (penanganan pelanggaran tata tertib, piket, dan kesehatan mental).\n- **Peningkatan Kapasitas Wali Asuh** dalam membangun kepemimpinan anak asuh yang jujur, mandiri, dan bertanggung jawab.\n\nSilakan klik salah satu kartu rekomendasi bantuan di bawah atau ketikkan langsung kesulitan, kendala, atau topik yang ingin Anda konsultasikan!`,
          timestamp: new Date()
        }
      ]);
    }
  }, [user]);

  // Save changes to history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`srma24_chat_history_${user?.uid || 'default'}`, JSON.stringify(messages));
    }
  }, [messages, user]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Call dogrouter.ai proxy API
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const payloadMessages = [
        {
          role: "system",
          content: `Anda adalah Eccko Assistant, Asisten Kecerdasan Buatan khusus untuk pengasuhan asrama di Sekolah Rakyat (SA) 24 Kediri. Tugas utama Anda adalah mendukung dan memandu Wali Asuh (steward/warden) dalam melaksanakan tugas harian kepengasuhan anak asuh. 
          
          Catatan Penting Istilah & Lingkungan:
          - Sekolah Rakyat (SA) 24 KEDIRI adalah sekolah umum berasas kekeluargaan, bukan Pondok Pesantren.
          - Gunakan istilah "anak asuh" (bukan "santri" atau "murid").
          - Gunakan istilah "wali asuh" (bukan "ustadz", "ustadzah", "guru pamong", dll).
          
          Fokus utama bidang Anda meliputi:
          1. Pengembangan Karakter & Akhlak Mulia: Menyusun ide, draf, teks tausiyah, kultum, atau materi kajian subuh yang menginspirasi anak asuh dengan landasan nilai-nilai universal/Islami yang santun, menyentuh, dan relevan dengan kehidupan remaja di asrama.
          2. Konseling Berbasis Empati & Disiplin Positif: Memberikan panduan cara berbicara, mendekati, dan membimbing anak asuh yang mengalami homesick, demotivasi, melanggar ketertiban, terlambat berkegiatan, atau mengalami konflik antarkamar dengan pendekatan kasih sayang yang mendidik.
          3. Pengelolaan Kamar & Rutinitas Asrama: Memberikan solusi praktis terkait pembagian piket, kerukunan antar anak asuh, serta tips memotivasi kemandirian anak asuh dalam merawat lingkungan asrama.
          4. Draf Administrasi Kepengasuhan: Membantu mempermudah pembuatan draf pengumuman asrama, draf motivasi, draf panduan pembinaan, atau memorandum pengasuhan lisan/tertulis yang santun, profesional, penuh hikmah, dan edukatif.

          Tanggapilah selalu dalam Bahasa Indonesia yang sopan, solutif, inspiratif, penuh berkah, ramah, dan bernuansa teduh.`
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: textToSend }
      ];

      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: payloadMessages,
          model: "gemini-3.5-flash"
        })
      });

      if (!response.ok) {
        let errDesc = `Status ${response.status} (${response.statusText})`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errDesc = errData.error;
          }
        } catch (_) {}
        throw new Error(`Gagal menghubungi server AI: ${errDesc}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || "";
      if (!assistantContent) {
        throw new Error("Chatbot tidak mengembalikan konten balasan yang valid.");
      }

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chatbot inference error:', error);
      setErrorMsg(error.message || 'Terjadi kesalahan koneksi ke server AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat obrolan ini?')) {
      localStorage.removeItem(`srma24_chat_history_${user?.uid || 'default'}`);
      const greetName = user?.displayName || user?.email?.split('@')[0] || 'Wali Asuh';
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `*Assalamualaikum Warahmatullahi Wabarakatuh, ${greetName}!* \n\nRiwayat obrolan telah dibersihkan. Apa yang bisa saya bantu sekarang dalam agenda asrama Anda hari ini?`,
          timestamp: new Date()
        }
      ]);
    }
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-140px)] min-h-[500px] rounded-3xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-150 bg-white'} overflow-hidden shadow-xl`}>
      {/* Header Panel */}
      <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
            <Bot className="w-5 h-5 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-black text-sm tracking-tight text-slate-800 dark:text-slate-100 uppercase">Eccko Assistant</h2>
              <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-extrabold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-widest">ONLINE</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Asisten Cerdas Kepengasuhan & Tausiyah Asrama</p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 active:scale-95"
            title="Hapus Obrolan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar bg-slate-50/10 dark:bg-slate-950/5">
        {messages.map((msg) => {
          const isAi = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-[85%] ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${
                isAi 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-slate-800 dark:border-slate-700 dark:text-emerald-400' 
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-400'
              }`}>
                {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="flex flex-col space-y-1">
                <span className={`text-[9px] font-black tracking-wider uppercase text-slate-400 ${!isAi && 'text-right'}`}>
                  {isAi ? 'Eccko Assistant' : 'Anda'}
                </span>
                
                <div className={`px-4 py-3 rounded-2xl flex flex-col gap-1 text-xs leading-relaxed border ${
                  isAi 
                    ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850 text-slate-800 dark:text-slate-100 shadow-sm rounded-tl-none' 
                    : 'bg-[#10b981] border-emerald-600 text-white rounded-tr-none'
                }`}>
                  <div className={`markdown-body ${isAi ? 'text-slate-800 dark:text-slate-200' : 'text-white'}`}>
                    <MarkdownRenderer content={msg.content} isAi={isAi} />
                  </div>
                  
                  <span className={`text-[8px] text-slate-400 font-bold self-end mt-1 ${!isAi && 'text-white/80'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex items-start gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center animate-spin">
              <Loader2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-[9px] font-black tracking-wider uppercase text-slate-400">Eccko Assistant sedang berpikir...</span>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 px-4 py-3.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-400 max-w-[85%] mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1 text-[11px] font-medium leading-tight">
              {errorMsg}
            </div>
            <button
              onClick={() => {
                const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                if (lastUserMsg) {
                  handleSendMessage(lastUserMsg.content);
                } else {
                  setErrorMsg(null);
                }
              }}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded-lg transition-all"
              title="Coba Lagi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && !isGenerating && (
        <div className="px-4 py-3">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Rekomendasi Bantuan AI:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {PRESET_PROMPTS.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className={`text-left p-3 rounded-2xl border ${isDarkMode ? 'border-slate-800 hover:border-emerald-500 hover:bg-slate-900/40 bg-slate-900/10' : 'border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/20 bg-white'} transition-all duration-300 active:scale-[0.98] flex items-start gap-2.5 group`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} group-hover:scale-105 transition-transform`}>
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{item.title}</div>
                    <div className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Message Area */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white/70 backdrop-blur-sm'}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tanyakan tausiyah, konseling anak asuh, cara disiplin..."
            className={`flex-1 px-4 py-3 rounded-2xl text-xs font-medium border focus:outline-none focus:ring-1 transition-all ${
              isDarkMode 
                ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-emerald-500 focus:ring-emerald-500' 
                : 'bg-slate-50 border-slate-150 text-slate-850 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500'
            }`}
            disabled={isGenerating}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isGenerating}
            className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-all duration-200 disabled:opacity-40 shadow-md shadow-emerald-500/10"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        <p className="text-[9px] text-slate-400 font-bold mt-2 text-center">
          Eccko Assistant ditenagai oleh Gemini API. Selalu periksa draf penting sebelum digunakan.
        </p>
      </div>
    </div>
  );
}
