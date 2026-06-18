import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  Radio, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Send, 
  Heart, 
  Music, 
  RadioTower, 
  Plus, 
  Trash2, 
  Sliders, 
  Clock, 
  Info, 
  Sparkles,
  ExternalLink,
  MessageSquare,
  Volume1,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser } from '../types';

// Structured Interface for Indonesian Public Station Presets
interface RadioStationPreset {
  id: string;
  name: string;
  frequency: string;
  genre: string;
  location: string;
  streamUrl: string;
  description: string;
  webUrl?: string;
}

// Structured Interface for Firestore Shared Shoutbox / Request list
interface RadioRequest {
  id: string;
  senderName: string;
  trackTitle: string;
  greetingsFor: string;
  createdAt: any;
}

// Helper function to check if a URL is likely a webpage rather than a direct raw audio stream
const checkIsWebpageUrl = (url: string): boolean => {
  if (!url) return false;
  const l = url.toLowerCase().trim();
  // If it is just a top-level domain or contains standard webpage indicators, it's not a direct stream
  if (l.includes('/streaming') || l.includes('/stream-page') || l.includes('.html') || l.includes('.php') || l.includes('.asp')) {
    return true;
  }
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Explicit exclusions for common stream hosting endpoints
    if (l.includes('zeno.fm') || l.includes('stream') || l.includes('icecast') || l.includes('shoutcast') || l.includes('cast')) {
      return false;
    }
    
    // Simple Webpage extensions or index / streaming paths
    if (path === '/' || path === '' || path === '/index' || path === '/streaming/') {
      return true;
    }
  } catch {
    // If it is not a valid URL structure but ends with typical webpage domains (e.g., .com, .net)
    if (l.endsWith('.com') || l.endsWith('.com/') || l.endsWith('.net') || l.endsWith('.id') || l.endsWith('.co.id')) {
      return true;
    }
  }
  return false;
};

// Curated 100% stable, offline-capable local lofi synthesizer
const LOCAL_LOFI_STATION: RadioStationPreset = {
  id: 'rhapsody_lofi',
  name: 'Lofi Lokal (Sintetis Failsafe)',
  frequency: '91.8 FM',
  genre: 'Instrumen Relaksasi (Sintetis)',
  location: 'Generator Audio Browser',
  streamUrl: 'procedural_lofi_synthesizer',
  description: 'Musik lofi penyejuk hati yang disintesis secara real-time langsung oleh browser Anda menggunakan Web Audio API. 100% stabil, offline, bebas lag, tanpa internet!',
  webUrl: 'https://ai.studio/build'
};

const DEFAULT_PRESETS: RadioStationPreset[] = [LOCAL_LOFI_STATION];

// Radio Browser API mirror servers for DNS rotation & redundancy
const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
];

// Helper to convert Radio Browser API response to our unified preset schema
const mapApiStationToPreset = (item: any): RadioStationPreset => {
  return {
    id: `api_${item.stationuuid}`,
    name: item.name || 'Radio Online Terop',
    frequency: item.codec ? `${item.codec.toUpperCase()} ${item.bitrate ? item.bitrate + 'kbps' : ''}` : '99.9 FM',
    genre: item.tags ? item.tags.split(',').slice(0, 3).join(', ') : 'Musik / Umum',
    location: item.state ? `${item.state}, ${item.country}` : item.country || 'Global',
    streamUrl: item.url_resolved || item.url,
    description: `Disiarkan oleh Radio Browser API. Aliran: ${item.codec || 'MP3'} ${item.bitrate ? '@ ' + item.bitrate + ' kbps' : ''}. Suka stasiun ini? Simpan sebagai Stasiun Kustom Anda agar tersimpan permanen!`,
    webUrl: item.homepage || undefined
  };
};

export default function RadioSiaranView({ user }: { user: AppUser }) {
  // Navigation & Control States
  const [selectedStation, setSelectedStation] = useState<RadioStationPreset>(DEFAULT_PRESETS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [signalStrength, setSignalStrength] = useState<number>(95);
  const [customStreams, setCustomStreams] = useState<RadioStationPreset[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [useBackupStream, setUseBackupStream] = useState<boolean>(false);
  const [isProceduralMode, setIsProceduralMode] = useState<boolean>(false);
  
  // Custom streamer adding modal/inputs
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamFreq, setNewStreamFreq] = useState('98.5 FM');
  const [newStreamUrl, setNewStreamUrl] = useState('');
  const [newStreamGenre, setNewStreamGenre] = useState('Musik Pop / Campuran');
  const [newStreamWebUrl, setNewStreamWebUrl] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Radio Browser API specific states
  const [searchCategory, setSearchCategory] = useState<'preset' | 'custom' | 'browser'>('browser');
  const [radioBrowserQuery, setRadioBrowserQuery] = useState('');
  const [radioBrowserResults, setRadioBrowserResults] = useState<RadioStationPreset[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  // Live Firebase Shared Request / greetings
  const [liveRequests, setLiveRequests] = useState<RadioRequest[]>([]);
  const [reqSenderName, setReqSenderName] = useState(user.name);
  const [reqTrackTitle, setReqTrackTitle] = useState('');
  const [reqGreetingsFor, setReqGreetingsFor] = useState('Semua Wali Asuh & Kepala Sekolah');

  // Audio References
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioNodeRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Local Synthesis References (Failsafe local lofi)
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const synthIntervalRef = useRef<any>(null);
  const activeSynthNodes = useRef<AudioNode[]>([]);
  
  // Mutable ref callback to resolve stale state (such as isPlaying) inside listeners
  const loadErrorCallbackRef = useRef<((e: Event) => void) | null>(null);
  
  // Visualizer Animation State
  const [visualDataArray, setVisualDataArray] = useState<number[]>(new Array(16).fill(10));
  const animationFrameRef = useRef<number | null>(null);

  // Sync custom streams from localStorage on init
  useEffect(() => {
    const saved = localStorage.getItem('srma24_custom_radio_streams');
    if (saved) {
      try {
        setCustomStreams(JSON.parse(saved));
      } catch (e) {
        console.warn("Gagal memuat stasiun kustom", e);
      }
    }
  }, []);

  // Sync real-time Shared Radio Requests/Greetings from Firestore
  useEffect(() => {
    const qReq = query(collection(db, 'radio_public_requests'), orderBy('createdAt', 'desc'), limit(15));
    const unsub = onSnapshot(qReq, (snap) => {
      const list: RadioRequest[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RadioRequest);
      });
      setLiveRequests(list);
    }, (error) => {
      console.warn("Firebase query error (mungkin rules belum dideploy):", error);
    });

    return () => unsub();
  }, []);

  // Periodic signal strength simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setSignalStrength(prev => {
        const diff = Math.floor(Math.random() * 7) - 3; // fluctuate slightly
        const target = prev + diff;
        return Math.max(78, Math.min(100, target));
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Fetch helper from Radio Browser mirrors
  const fetchFromRadioBrowser = async (params: string) => {
    for (const mirror of RADIO_BROWSER_MIRRORS) {
      try {
        const response = await fetch(`${mirror}/json/stations/search?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn(`Gagal memuat dari mirror ${mirror}:`, err);
      }
    }
    throw new Error('Semua mirror Radio Browser API tidak merespons.');
  };

  const handleLoadPopularIndonesian = async () => {
    setIsSearchingApi(true);
    setAudioError(null);
    try {
      const data = await fetchFromRadioBrowser('countrycode=ID&limit=40&order=clickcount&reverse=true');
      if (Array.isArray(data)) {
        const mapped = data.map(mapApiStationToPreset);
        setRadioBrowserResults(mapped);
      }
    } catch (err: any) {
      console.error(err);
      setAudioError("Gagal menghubungi server Radio Browser API. Silakan coba lagi beberapa saat.");
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handleSearchApi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!radioBrowserQuery.trim()) {
      handleLoadPopularIndonesian();
      return;
    }

    setIsSearchingApi(true);
    setAudioError(null);
    try {
      const queryParam = `name=${encodeURIComponent(radioBrowserQuery.trim())}&limit=40&order=clickcount&reverse=true`;
      const data = await fetchFromRadioBrowser(queryParam);
      if (Array.isArray(data)) {
        const mapped = data.map(mapApiStationToPreset);
        setRadioBrowserResults(mapped);
      }
    } catch (err: any) {
      console.error(err);
      setAudioError("Pencarian stasiun gagal dilakukan. Silakan periksa koneksi internet Anda.");
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handleSaveApiStation = (station: RadioStationPreset, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Check if already in custom
    const isAlreadySaved = customStreams.some(s => s.id === station.id || s.streamUrl === station.streamUrl || s.id === `api_${station.id.replace('api_','')}`);
    if (isAlreadySaved) return;

    // Create a new customized preset from this
    const newPreset: RadioStationPreset = {
      ...station,
      id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000), // make it custom ID
      name: `📻 ${station.name}`
    };

    const updated = [...customStreams, newPreset];
    setCustomStreams(updated);
    localStorage.setItem('srma24_custom_radio_streams', JSON.stringify(updated));
    setSearchCategory('custom'); // transition to show it's saved
  };

  // Automatic popular stations fetch when switching tab
  useEffect(() => {
    if (searchCategory === 'browser' && radioBrowserResults.length === 0 && !isSearchingApi) {
      handleLoadPopularIndonesian();
    }
  }, [searchCategory]);

  // Effect to handle actual Radio Audio creation and binding
  useEffect(() => {
    // Instantiate actual native audio tag
    const audio = new Audio();
    audio.preload = 'none';
    audioNodeRef.current = audio;

    // Handle safety stop for background noise on components destruction
    return () => {
      audio.pause();
      audio.src = '';
      
      // Clear procedural lofi on destruction
      if (synthIntervalRef.current) {
        clearInterval(synthIntervalRef.current);
      }
      activeSynthNodes.current.forEach(node => {
        try { node.disconnect(); } catch(e){}
      });

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Central Audio Synchronization Effect: triggered whenever play state or station selection shifts
  useEffect(() => {
    if (!audioNodeRef.current) return;
    const audio = audioNodeRef.current;

    // A helper to shut down all audio channels cleanly
    const stopPlayback = () => {
      audio.pause();
      audio.src = '';
      stopProceduralLofi();
      setIsLoading(false);
      setVisualDataArray(new Array(16).fill(10));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    if (!isPlaying) {
      stopPlayback();
      return;
    }

    // Clear previous errors as we start a fresh tuning action
    setAudioError(null);

    // Bind reactive events
    audio.onplaying = () => {
      setIsLoading(false);
      setAudioError(null);
      startVisualizerEngine();
    };

    audio.onerror = (e) => {
      console.warn("Audio element load error:", e);
      setIsLoading(false);

      const mediaError = audio.error;
      let errorDescription = "Koneksi stasiun radio terputus atau tautan tidak didukung browser (Mixed Content / HTTP).";
      if (mediaError) {
        switch (mediaError.code) {
          case mediaError.MEDIA_ERR_ABORTED:
            errorDescription = "Proses pemutaran dibatalkan.";
            break;
          case mediaError.MEDIA_ERR_NETWORK:
            errorDescription = "Gangguan Jaringan: Gagal menghubungi server stasiun penyiaran.";
            break;
          case mediaError.MEDIA_ERR_DECODE:
            errorDescription = "Kesalahan Dekoder: Format siaran rusak atau tidak didukung.";
            break;
          case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorDescription = "Protokol tidak aman (HTTP pada konteks HTTPS secure) atau stasiun sedang luring.";
            break;
        }
      }

      setAudioError(`${errorDescription} Memainkan musik "Lofi Lokal (Sintetis Failsafe)" sementara sebagai latar belakang...`);

      // Fallback to local synthesizer but DO NOT change selectedStation so they can easily retry or open WEB player!
      startProceduralLofi();
    };

    const isWebpage = checkIsWebpageUrl(selectedStation.streamUrl);

    // Routing: decide between local synthesizer, webpage link warning, or online stream
    if (selectedStation.id === 'rhapsody_lofi') {
      audio.pause();
      audio.src = '';
      startProceduralLofi();
    } else if (isWebpage) {
      audio.pause();
      audio.src = '';
      setIsLoading(false);
      setAudioError(`Tautan saluran ini (${selectedStation.streamUrl}) berupa halaman web utama stasiun, bukan stream audio langsung (.mp3/.aac/m3u8). Browser tidak bisa memutarnya di dalam player. Silakan gunakan tombol "Buka Web Player Resmi" atau eksternal link di bawah.`);
      startProceduralLofi(); // Play soothing background music
    } else {
      stopProceduralLofi();
      setIsLoading(true);

      // STABILIZE PROTOCOLS: Convert http stream URLs to https silently to satisfy modern browser HTTPS security parameters
      let targetStreamUrl = selectedStation.streamUrl;
      if (targetStreamUrl.startsWith('http://') && !targetStreamUrl.includes('localhost') && !targetStreamUrl.includes('127.0.0.1')) {
        targetStreamUrl = targetStreamUrl.replace('http://', 'https://');
      }

      audio.src = targetStreamUrl;
      audio.volume = isMuted ? 0 : volume;

      audio.play()
        .then(() => {
          setIsLoading(false);
          startVisualizerEngine();
        })
        .catch(err => {
          console.warn("Gagal memutar stasiun streams:", err);
          setAudioError("Kesalahan koneksi radio luring atau diblokir browser (Mixed Content SSL). Mengaktifkan lofi sintetis lokal...");
          startProceduralLofi(); // Play local lofi as soothing filler
        });
    }

    return () => {
      // Do not clean on every single minor render, but cleanup when dependencies shift
    };
  }, [isPlaying, selectedStation]);

  // Stop procedural logic
  const stopProceduralLofi = () => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    activeSynthNodes.current.forEach(node => {
      try {
        if ('stop' in node) {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    activeSynthNodes.current = [];
    setIsProceduralMode(false);
  };

  // Start procedural local synthesizer
  const startProceduralLofi = () => {
    // Stop raw streamer node first
    if (audioNodeRef.current) {
      audioNodeRef.current.pause();
      audioNodeRef.current.src = '';
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Stop previous instance
      stopProceduralLofi();

      // Create main nodes
      const masterGain = ctx.createGain();
      // Keep it calm and soothing
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume * 0.35, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(450, ctx.currentTime);
      lowpass.Q.setValueAtTime(1, ctx.currentTime);
      lowpass.connect(masterGain);
      lowpassRef.current = lowpass;

      // Chord frequencies in Eb Major (very soft/warm/relaxing)
      const progressingChords = [
        [155.56, 196.00, 233.08, 293.66], // Ebmaj7 (Eb3, G3, Bb3, D4)
        [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
        [174.61, 220.00, 261.63, 311.13], // Fm7 (F3, A3, C4, Eb4)
        [146.83, 174.61, 220.00, 261.63]  // Dm7 (D3, F3, A3, C4)
      ];

      let chordIdx = 0;

      const playChord = () => {
        const chord = progressingChords[chordIdx % progressingChords.length];
        chordIdx++;

        const now = ctx.currentTime;
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          
          // Slight warm cassette pitch detuning wobble
          const detuneAmount = (Math.random() - 0.5) * 12;
          osc.detune.setValueAtTime(detuneAmount, now);
          osc.frequency.setValueAtTime(freq, now);

          const noteGain = ctx.createGain();
          noteGain.gain.setValueAtTime(0, now);
          // random soft fade-in time
          const fadeIn = 0.8 + Math.random() * 0.4;
          noteGain.gain.linearRampToValueAtTime(0.04 + (Math.random() * 0.02), now + fadeIn);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

          osc.connect(noteGain);
          noteGain.connect(lowpass);

          osc.start(now);
          osc.stop(now + 4.0);

          activeSynthNodes.current.push(osc);
        });

        // Soft random chime pluck accents in Eb pentatonic
        if (Math.random() > 0.35) {
          const pentatonic = [311.13, 349.23, 392.00, 466.16, 523.25]; // Eb4, F4, G4, Bb4, C5
          const noteStr = pentatonic[Math.floor(Math.random() * pentatonic.length)];
          const accentTime = ctx.currentTime + 0.5 + (Math.random() * 0.8);

          const chimeOsc = ctx.createOscillator();
          chimeOsc.type = 'sine';
          chimeOsc.frequency.setValueAtTime(noteStr, accentTime);

          const chimeGain = ctx.createGain();
          chimeGain.gain.setValueAtTime(0, accentTime);
          chimeGain.gain.linearRampToValueAtTime(0.015, accentTime + 0.05);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, accentTime + 1.2);

          chimeOsc.connect(chimeGain);
          chimeGain.connect(lowpass);

          chimeOsc.start(accentTime);
          chimeOsc.stop(accentTime + 1.4);

          activeSynthNodes.current.push(chimeOsc);
        }
      };

      // Play initially
      playChord();

      // Loop
      synthIntervalRef.current = setInterval(playChord, 4000);
      setIsProceduralMode(true);
      setIsLoading(false);
      setAudioError(null);
      startVisualizerEngine();

    } catch (err) {
      console.warn("Gagal meluncurkan lofi sintesis lokal:", err);
      setIsProceduralMode(false);
      setAudioError("Kesalahan pemutar Web Audio API pada browser.");
    }
  };

  // Handle Play/Pause
  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  // Switch to safe secure backup stream channel
  const handlePlayFallback = () => {
    setAudioError(null);
    const fallbackStation = DEFAULT_PRESETS.find(p => p.id === 'rhapsody_lofi') || DEFAULT_PRESETS[0];
    setSelectedStation(fallbackStation);
    setIsPlaying(true);
  };

  // Safe visualizer engine that works for any stream configuration
  const startVisualizerEngine = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    runSimulationVisualizer();
  };

  const runSimulationVisualizer = () => {
    let lastTime = 0;
    const loop = (timestamp: number) => {
      if (!audioNodeRef.current) return;

      if (timestamp - lastTime > 85) {
        lastTime = timestamp;
        setVisualDataArray(prev =>
          prev.map(() => 15 + Math.floor(Math.random() * 80))
        );
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // Adjust volume
  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (audioNodeRef.current) {
      audioNodeRef.current.volume = isMuted ? 0 : v;
    }
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : v * 0.35, audioContextRef.current.currentTime);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioNodeRef.current) {
      audioNodeRef.current.volume = nextMute ? 0 : volume;
    }
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(nextMute ? 0 : volume * 0.35, audioContextRef.current.currentTime);
    }
  };

  // Select Preset station
  const handleSelectStation = (station: RadioStationPreset) => {
    setSelectedStation(station);
  };

  // Add Custom Radio Stream Local
  const handleAddCustomStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreamName.trim() || !newStreamUrl.trim()) return;

    let correctedUrl = newStreamUrl.trim();
    // Add protocol safeguard
    if (!correctedUrl.startsWith('http://') && !correctedUrl.startsWith('https://')) {
      correctedUrl = 'https://' + correctedUrl;
    }

    let correctedWebUrl = newStreamWebUrl.trim();
    if (correctedWebUrl && !correctedWebUrl.startsWith('http://') && !correctedWebUrl.startsWith('https://')) {
      correctedWebUrl = 'https://' + correctedWebUrl;
    }

    // Intelligent webpage safeguard: if the stream URL doesn't look like a raw stream or points to a known webpage portal
    const isLikelyWebPage = correctedUrl.includes('/streaming') || correctedUrl.includes('.html') || correctedUrl.includes('/live-') || correctedUrl.includes('jak101fm.com') || correctedUrl.includes('website') || correctedUrl.includes('radioonline');
    if (isLikelyWebPage && !correctedWebUrl) {
      // Set the webUrl automatically so they can at least open it in a new tab!
      correctedWebUrl = correctedUrl;
    }

    const newPreset: RadioStationPreset = {
      id: 'custom_' + Date.now(),
      name: `📻 ${newStreamName}`,
      frequency: newStreamFreq,
      genre: newStreamGenre,
      location: 'Custom Stream',
      streamUrl: correctedUrl,
      description: isLikelyWebPage 
        ? 'Dideteksi sebagai alamat web streaming. Silakan klik tombol "Buka Web Player" untuk memainkannya di tab baru web resminya.' 
        : 'Stasiun penyiaran kustom yang ditambahkan secara mandiri.',
      webUrl: correctedWebUrl || undefined
    };

    const updated = [...customStreams, newPreset];
    setCustomStreams(updated);
    localStorage.setItem('srma24_custom_radio_streams', JSON.stringify(updated));

    // Clear inputs
    setNewStreamName('');
    setNewStreamUrl('');
    setNewStreamWebUrl('');
    setShowCustomModal(false);
    setShowCustomModal(false);
    
    // Auto tune to it!
    setSelectedStation(newPreset);
  };

  // Delete Custom Stream
  const handleDeleteCustomStream = (stId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const updated = customStreams.filter(s => s.id !== stId);
    setCustomStreams(updated);
    localStorage.setItem('srma24_custom_radio_streams', JSON.stringify(updated));
    
    if (selectedStation.id === stId) {
      setSelectedStation(DEFAULT_PRESETS[0]);
    }
  };

  // Submit Request/Greeting to Firebase Shared Shoutbox
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTrackTitle.trim()) return;

    try {
      await addDoc(collection(db, 'radio_public_requests'), {
        senderName: reqSenderName.trim() || 'Wali Asuh Misterius',
        trackTitle: reqTrackTitle.trim(),
        greetingsFor: reqGreetingsFor.trim() || 'Semua Rekan Asuh',
        createdAt: serverTimestamp()
      });

      setReqTrackTitle('');
    } catch (err) {
      // Offline fallback: simulate request in state
      const simulatedReq: RadioRequest = {
        id: 'sim_' + Date.now(),
        senderName: reqSenderName,
        trackTitle: reqTrackTitle,
        greetingsFor: reqGreetingsFor,
        createdAt: new Date()
      };
      setLiveRequests(prev => [simulatedReq, ...prev].slice(0, 15));
      setReqTrackTitle('');
    }
  };

  // Clear a message from Firestore (Moderator capability for admins/Wali Asuh)
  const handleDeleteRequest = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'radio_public_requests', docId));
    } catch (e) {
      setLiveRequests(prev => prev.filter(r => r.id !== docId));
    }
  };

  const allStations = [...DEFAULT_PRESETS, ...customStreams];

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
      
      {/* Sleek Analog Dashboard Banner */}
      <div className="relative bg-gradient-to-br from-[#121824] via-[#1a2d42] to-[#121824] rounded-3xl p-6 md:p-8 text-white overflow-hidden shadow-2xl border border-slate-700/30">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        
        {/* Glow Light */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative">
              <Radio className={`w-8 h-8 text-slate-900 ${isPlaying ? 'animate-bounce' : ''}`} />
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-none uppercase text-slate-100">
                  Receiver Radio Streaming
                </h1>
                <span className="text-[8px] font-black tracking-widest bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 px-1.5 py-0.5 rounded uppercase">
                  LIVE INTERNET
                </span>
              </div>
              <p className="text-slate-350 text-[10px] md:text-xs font-bold mt-2 uppercase tracking-widest font-mono">
                {isPlaying 
                  ? `📻 Memutar: ${selectedStation.name} (${selectedStation.frequency}) • Audio Lancar` 
                  : '⚫ Radio Siaga • Silakan pilih stasiun radio di bawah'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2.5 shrink-0">
            <div className="text-right">
              <span className="text-[8px] block font-black text-slate-400 uppercase tracking-widest">SIGNAL RATIO</span>
              <span className="text-xs font-black font-mono text-emerald-400">{signalStrength}% STRONG</span>
            </div>
            <div className="flex gap-0.5 items-end h-5 w-8">
              {[20, 40, 60, 80, 100].map((level, idx) => (
                <div 
                  key={idx} 
                  style={{ height: `${(idx + 1) * 20}%` }}
                  className={`w-1 rounded-sm transition-all duration-300 ${
                    signalStrength >= level ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Vinyl deck / Vintage tuner screen */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-slate-900/90 rounded-[2rem] p-6 border border-slate-800 text-stone-100 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-sky-400 to-teal-400 opacity-60" />

            {/* Vintage CRT Dial Screen display */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 relative">
              <div className="flex justify-between items-center text-slate-500 font-mono text-[8px] tracking-widest">
                <span>TUNING FREQUENCY LOCK</span>
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> AUTO SYNC STEREO
                </span>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-2">
                <div className="text-left space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-mono">SELECTION TARGET</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                      {selectedStation.name}
                    </h3>
                    {selectedStation.webUrl && (
                      <a
                        href={selectedStation.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1 px-2.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/35 text-indigo-300 hover:text-white border border-indigo-500/30 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Buka Player Resmi di Tab Baru"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Web Player
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-sky-400 font-bold uppercase tracking-wider">
                    {selectedStation.genre} • {selectedStation.location}
                  </p>
                </div>

                <div className="text-center md:text-right font-mono bg-slate-900 px-5 py-3 rounded-xl border border-slate-800 min-w-[140px]">
                  <p className="text-[8px] text-slate-400 font-bold uppercase">DIAL FREQ</p>
                  <p className="text-3xl font-black text-indigo-400 tracking-tighter mt-1">{selectedStation.frequency}</p>
                </div>
              </div>

              {/* Gorgeous Interactive Simulated Audio Equalizer / Visualizer */}
              <div className="h-16 w-full bg-slate-900/40 rounded-xl flex items-end justify-between p-3 overflow-hidden gap-1 hover:brightness-110 transition-all border border-slate-900">
                {visualDataArray.map((height, i) => (
                  <div 
                    key={i} 
                    style={{ height: `${height}%` }}
                    className="w-[5.5%] bg-gradient-to-t from-indigo-600 via-sky-400 to-teal-300 rounded-t shrink-0 transition-all duration-100 origin-bottom"
                  />
                ))}
              </div>

              {audioError ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="space-y-1 text-left flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5 leading-none">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      Gangguan Sinyal / Protokol Siaran
                    </p>
                    <p className="text-[11px] leading-relaxed font-medium">
                      {audioError}
                    </p>
                    {checkIsWebpageUrl(selectedStation.streamUrl) && (
                      <p className="text-[10px] text-amber-300 font-bold mt-1">
                        Tips: Saluran ini menggunakan pranala halaman web player resmi, bukan direct raw stream (.mp3/.aac/m3u8). Sehingga browser tidak dapat memutarnya di latar belakang. Silakan klik tombol &quot;Web Player Resmi&quot; di samping untuk mendengar langsung secara lancar!
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {selectedStation.webUrl && (
                      <a
                        href={selectedStation.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase shadow-lg select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Web Player Resmi
                      </a>
                    )}
                    <button
                      onClick={handlePlayFallback}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-900 text-[10px] font-black uppercase shadow-lg select-none transition-all active:scale-95 cursor-pointer text-center"
                    >
                      Jalur Cadangan (Lofi Aman)
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic leading-relaxed font-semibold bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  {`“ ${selectedStation.description} ”`}
                </p>
              )}
            </div>

            {/* Radio Hardware Controls (Analog layout) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Play / pause button and status */}
              <div className="md:col-span-5 flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  disabled={isLoading}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 cursor-pointer ${
                    isPlaying 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-955' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white animate-pulse'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-1" />
                  )}
                </button>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-200 leading-none">
                    {isLoading ? 'MENGHUBUNGKAN...' : isPlaying ? 'ON AIR' : 'RADIO MATI'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-none">
                    {isLoading ? 'Menunggu respons streaming' : isPlaying ? 'Streaming lancar' : 'Tekan play untuk mendengar'}
                  </p>
                </div>
              </div>

              {/* Volume Slider Section */}
              <div className="md:col-span-7 flex items-center gap-3 bg-slate-950 px-4 py-3 rounded-2xl border border-slate-850">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : volume < 0.4 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <span>VOLUME OUTPUT</span>
                    <span className="font-mono text-indigo-400">{isMuted ? 'MUTED' : Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Catalog of Stations (Presets & Custom & Radio Browser API Search) */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RadioTower className="w-5 h-5 text-indigo-400 font-bold" />
                <h4 className="font-black text-base text-white uppercase tracking-tight font-display">
                  Daftar Saluran Radio Tersedia
                </h4>
              </div>
              <button
                onClick={() => setShowCustomModal(true)}
                className="py-1.5 px-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Saluran
              </button>
            </div>

            {/* Custom Tab Switcher */}
            <div className="grid grid-cols-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-850 gap-1.5 select-none">
              <button
                onClick={() => setSearchCategory('browser')}
                className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 leading-none ${
                  searchCategory === 'browser'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                Cari Online (API)
              </button>
              <button
                onClick={() => setSearchCategory('custom')}
                className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 leading-none ${
                  searchCategory === 'custom'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                Koleksi Kustom / Failsafe ({customStreams.length + 1})
              </button>
            </div>

            {/* Content of selected Tab Category */}
            {searchCategory === 'browser' && (
              <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-850 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">
                  <Sparkles className="w-3.5 h-3.5 text-amber-350" />
                  Radio-Browser.info Community API
                </div>
                
                {/* Search Bar */}
                <form onSubmit={handleSearchApi} className="flex gap-2">
                  <input
                    type="text"
                    value={radioBrowserQuery}
                    onChange={(e) => setRadioBrowserQuery(e.target.value)}
                    placeholder="Masukkan nama stasiun... (cth: Prambors, Gen FM, Elshinta)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-650 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingApi}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all active:scale-95"
                  >
                    {isSearchingApi ? 'Mencari...' : 'CARI'}
                  </button>
                </form>

                {/* Quick Filters */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleLoadPopularIndonesian}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    Popular Indonesia 🇮🇩
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        const tagSearch = (tag: string) => {
                          setRadioBrowserQuery('');
                          setIsSearchingApi(true);
                          fetchFromRadioBrowser(`tag=${tag}&countrycode=ID&limit=45&order=clickcount&reverse=true`)
                            .then(data => {
                              if (Array.isArray(data)) {
                                setRadioBrowserResults(data.map(mapApiStationToPreset));
                              }
                            })
                            .catch(() => setAudioError("Gagal mencari."))
                            .finally(() => setIsSearchingApi(false));
                        };
                        tagSearch('lofi');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    🎵 Lofi Relax
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        const tagSearch = (tag: string) => {
                          setRadioBrowserQuery('');
                          setIsSearchingApi(true);
                          fetchFromRadioBrowser(`tag=${tag}&countrycode=ID&limit=45&order=clickcount&reverse=true`)
                            .then(data => {
                              if (Array.isArray(data)) {
                                setRadioBrowserResults(data.map(mapApiStationToPreset));
                              }
                            })
                            .catch(() => setAudioError("Gagal mencari."))
                            .finally(() => setIsSearchingApi(false));
                        };
                        tagSearch('islamic');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    🕋 Kajian Islam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        const tagSearch = (tag: string) => {
                          setRadioBrowserQuery('');
                          setIsSearchingApi(true);
                          fetchFromRadioBrowser(`tag=${tag}&countrycode=ID&limit=45&order=clickcount&reverse=true`)
                            .then(data => {
                              if (Array.isArray(data)) {
                                setRadioBrowserResults(data.map(mapApiStationToPreset));
                              }
                            })
                            .catch(() => setAudioError("Gagal mencari."))
                            .finally(() => setIsSearchingApi(false));
                        };
                        tagSearch('news');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    📰 Berita
                  </button>
                </div>
              </div>
            )}

            {/* Stasiun List Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {isSearchingApi ? (
                <div className="col-span-full py-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>SINKRONISASI STASIUN AKTIF DARI SEBELAH...</span>
                </div>
              ) : searchCategory === 'browser' ? (
                radioBrowserResults.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-slate-500 text-xs italic font-semibold border border-dashed border-slate-800 rounded-2xl animate-pulse">
                    Stasiun tidak ditemukan. Silakan ketik nama stasiun penyiaran, genre, atau klik Indonesia Populer di atas!
                  </div>
                ) : (
                  radioBrowserResults.map((station) => {
                    const isActive = selectedStation.id === station.id || selectedStation.streamUrl === station.streamUrl;
                    const isAlreadySaved = customStreams.some(s => s.streamUrl === station.streamUrl);
                    return (
                      <div
                        key={station.id}
                        onClick={() => handleSelectStation(station)}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all relative flex flex-col justify-between h-24 ${
                          isActive 
                            ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md' 
                            : 'bg-slate-950/70 border-slate-850 hover:border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-black text-xs uppercase leading-tight truncate max-w-[70%]">
                              {station.name}
                            </span>
                            <span className="font-mono text-[9px] font-black text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                              {station.frequency}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate font-semibold uppercase mt-1">
                            {station.genre}
                          </p>
                        </div>

                        <div className="flex justify-between items-center text-[8.5px] border-t border-slate-850 pt-2 font-black uppercase text-slate-500 text-left">
                          <span className="truncate max-w-[50%]">{station.location}</span>
                          
                          <div className="flex items-center gap-1.5">
                            {!isAlreadySaved ? (
                              <button
                                onClick={(e) => handleSaveApiStation(station, e)}
                                className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:bg-emerald-600 hover:text-slate-950 transition-all font-black text-[8px] cursor-pointer"
                                title="Simpan ke Daftar Saluran Saya"
                              >
                                + SIMPAN
                              </button>
                            ) : (
                              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 rounded text-[7.5px]">TERSAVED</span>
                            )}

                            {isActive && isPlaying ? (
                              <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> TUNED IN
                              </span>
                            ) : (
                              <span className="text-slate-500 shrink-0">TUNING</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                // Render the built-in Failsafe Local lofi and any custom-added stations together
                [LOCAL_LOFI_STATION, ...customStreams].map((station) => {
                  const isActive = selectedStation.id === station.id;
                  const isBuiltIn = station.id === 'rhapsody_lofi';
                  return (
                    <div
                      key={station.id}
                      onClick={() => handleSelectStation(station)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all relative flex flex-col justify-between h-24 ${
                        isActive 
                          ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md' 
                          : 'bg-slate-950/70 border-slate-850 hover:border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-black text-xs uppercase leading-tight truncate max-w-[70%]">
                            {station.name}
                          </span>
                          <span className="font-mono text-[9px] font-black text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded leading-none shrink-0 font-bold">
                            {station.frequency}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate font-semibold uppercase mt-1">
                          {station.genre}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-[8.5px] border-t border-slate-850 pt-2 font-black uppercase text-slate-500">
                        <span className="truncate max-w-[50%]">{station.location}</span>
                        
                        <div className="flex items-center gap-1.5">
                          {!isBuiltIn ? (
                            <button
                              onClick={(e) => handleDeleteCustomStream(station.id, e)}
                              className="p-1 text-red-400 hover:text-red-300 transition-all cursor-pointer rounded bg-red-950/20 border border-red-900/30"
                              title="Hapus saluran kustom"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[7.5px] font-extrabold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">FAILSAFE</span>
                          )}
                          {station.webUrl && (
                            <a
                              href={station.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-1.5 py-0.5 rounded bg-[#1e1b4b] border border-indigo-900 text-indigo-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[8px] font-black shrink-0"
                              title="Buka Player Resmi di Tab Baru"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> WEB
                            </a>
                          )}
                          {isActive && isPlaying ? (
                            <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> TUNED IN
                            </span>
                          ) : (
                            <span className="text-slate-500 shrink-0">TUNING</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tips Banner */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 flex items-start gap-3 text-[10px] font-semibold text-slate-400">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p>
                <strong>Catatan CORS:</strong> Sebagian stasiun radio menggunakan port streaming khusus. Jika suara tidak keluar, gunakan &ldquo;Tambah Saluran&rdquo; untuk memasukkan link streaming radio publik alternatif Anda sendiri (Icecast, Shoutcast, atau mp3 stream berkepala https).
              </p>
            </div>

          </div>

        </div>

        {/* Right column: Shared public request / Greetings board */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Request / Shoutbox Card */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h4 className="font-black text-base text-white uppercase tracking-tight font-display">
                Catatan Rekuest Lagu / Atensi
              </h4>
            </div>

            {/* Input Form for request */}
            <form onSubmit={handleSubmitRequest} className="space-y-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-850">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">NAMA PENYALUR ATENSI</label>
                <input
                  type="text"
                  value={reqSenderName}
                  onChange={(e) => setReqSenderName(e.target.value)}
                  maxLength={24}
                  placeholder="Ganti nama jika perlu..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-semibold text-xs text-white focus:outline-none focus:border-indigo-500 uppercase tracking-wide"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">REKUEST LAGU / PESAN SIARAN</label>
                <input
                  type="text"
                  required
                  value={reqTrackTitle}
                  onChange={(e) => setReqTrackTitle(e.target.value)}
                  maxLength={55}
                  placeholder="Ketikan judul lagu, pesan, atau pantun..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-semibold text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">KIRIM ATENSI UNTUK SIAPA?</label>
                <input
                  type="text"
                  value={reqGreetingsFor}
                  onChange={(e) => setReqGreetingsFor(e.target.value)}
                  maxLength={35}
                  placeholder="Semua Wali Asuh..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-semibold text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer mt-1"
              >
                <Send className="w-3.5 h-3.5" />
                KIRIM ATENSI LIVE
              </button>
            </form>

            {/* List of active requests from Wali asuh */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic select-none">
                ATENSI TERKIRIM REALTIME ({liveRequests.length})
              </p>
              
              <AnimatePresence initial={false}>
                {liveRequests.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs italic font-semibold border border-dashed border-slate-800 rounded-2xl">
                    Belum ada rekuest terkirim hari ini. Yuk kirim lagu motivasi pertama Anda!
                  </div>
                ) : (
                  liveRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 bg-slate-950 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all text-xs text-left text-slate-300 relative group"
                    >
                      <div className="flex justify-between items-start gap-1 pr-6">
                        <span className="font-black text-indigo-300 uppercase block tracking-tight text-[10px]">
                          {req.senderName}
                        </span>
                        
                        {/* Allowed delete capability for anyone to keep board clean */}
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          className="absolute right-2 top-2 p-1 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 rounded hover:bg-red-950/20 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="font-bold text-white text-[11px] mt-1 pr-5 leading-normal">
                        🎧 &ldquo;{req.trackTitle}&rdquo;
                      </p>

                      <div className="mt-2 pt-1 border-t border-slate-900 flex justify-between items-center text-[9px] font-semibold text-slate-400 uppercase">
                        <span className="truncate max-w-[80%] inline-block font-sans lowercase">
                          untuk: <strong className="text-slate-300 uppercase">{req.greetingsFor}</strong>
                        </span>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          <span>LIVE</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* Embedded New Custom Stream Streamer Pop up modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4">
            <h3 className="font-black font-display text-lg uppercase tracking-tight text-white flex items-center gap-2">
              <RadioTower className="w-5 h-5 text-indigo-400" />
              KONFIGURASI TRANSMISI KUSTOM
            </h3>
            
            <p className="text-[11px] text-slate-405 italic leading-relaxed">
              Silakan masukkan link URL file audio streaming (*.mp3, *.aac, *.pls atau stream langsung Icecast) untuk didengarkan bersama di browser HP atau PC Anda.
            </p>

            <form onSubmit={handleAddCustomStream} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Nama Saluran Radio</label>
                <input
                  type="text"
                  required
                  value={newStreamName}
                  onChange={(e) => setNewStreamName(e.target.value)}
                  placeholder="Contoh: RRI Pro 2 Malang"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Gelombang Dial (Teks Biasa)</label>
                  <input
                    type="text"
                    value={newStreamFreq}
                    onChange={(e) => setNewStreamFreq(e.target.value)}
                    placeholder="Contoh: 102.9 FM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Kategori / Aliran</label>
                  <input
                    type="text"
                    value={newStreamGenre}
                    onChange={(e) => setNewStreamGenre(e.target.value)}
                    placeholder="Musik Pop / Lagu Religi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-sans">URL Live Stream Audio</label>
                <input
                  type="text"
                  required
                  value={newStreamUrl}
                  onChange={(e) => setNewStreamUrl(e.target.value)}
                  placeholder="https://example.com/streaming/ atau url direct stream"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                {newStreamUrl && checkIsWebpageUrl(newStreamUrl) && (
                  <p className="text-[10px] text-amber-400 font-bold bg-amber-400/5 border border-amber-400/10 p-2.5 rounded-xl mt-1.5 leading-normal">
                    ⚠️ <strong>Dideteksi Halaman Web:</strong> Tautan ini tampaknya mengarah ke situs web resmi radio, bukan direct server stream (.mp3/.aac). Kami otomatis akan mengaktifkan mode <strong>Pintasan Web Player Resmi</strong> untuk stasiun ini agar Anda bisa membukanya dengan tombol sekali-klik!
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-sans">URL Web Player Resmi (Opsional Fallback)</label>
                <input
                  type="text"
                  value={newStreamWebUrl}
                  onChange={(e) => setNewStreamWebUrl(e.target.value)}
                  placeholder="https://jak101fm.com/streaming/"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all"
                >
                  BATALKAN
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all active:scale-95"
                >
                  SIMPAN STASIUN 
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
