import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Users, 
  PhoneCall, 
  LogOut, 
  Activity, 
  Wifi, 
  Info,
  ChevronDown,
  Volume1,
  Lock,
  Unlock,
  Plus,
  ShieldCheck,
  Key,
  Settings
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  writeBatch,
  query,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { AppUser, UserRole } from '../types';
import { notifyAllRoles } from '../services/fcmService';

interface WalkieTalkieWidgetProps {
  user: AppUser;
}

interface WalkieUser {
  uid: string;
  name: string;
  role: string;
  isSpeaking: boolean;
  joinedAt: number;
}

interface SignalingData {
  offer?: string;
  answer?: string;
  candidates_caller?: any[];
  candidates_receiver?: any[];
}

interface WalkieChannel {
  id: string;
  name: string;
  password?: string;
  createdBy?: string;
  createdByRole?: string;
  createdAt: number;
}

const PRESET_CHANNELS = [
  'KOORDINASI KOORDINATOR',
  'ASRAMA PUTRA UTAMA',
  'ASRAMA PUTRI UTAMA',
  'PIKET HARIAN & SATPAM',
  'SESI DARURAT MEDIS'
];

export default function WalkieTalkieWidget({ user }: WalkieTalkieWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState('');
  const [activeUsers, setActiveUsers] = useState<WalkieUser[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const otherSpeakingUser = activeUsers.find(p => p.uid !== user.uid && p.isSpeaking);
  const isChannelBusy = !!otherSpeakingUser;

  // States for custom channels & password system
  const [customChannels, setCustomChannels] = useState<WalkieChannel[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPassword, setNewChannelPassword] = useState('');
  const [channelPendingPassword, setChannelPendingPassword] = useState<WalkieChannel | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // States for network & TURN server configuration
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [useOpenRelay, setUseOpenRelay] = useState(() => {
    return localStorage.getItem('srma_use_openrelay') !== 'false';
  });
  const [customTurnUrl, setCustomTurnUrl] = useState(() => {
    return localStorage.getItem('srma_custom_turn_url') || '';
  });
  const [customTurnUser, setCustomTurnUser] = useState(() => {
    return localStorage.getItem('srma_custom_turn_user') || '';
  });
  const [customTurnCred, setCustomTurnCred] = useState(() => {
    return localStorage.getItem('srma_custom_turn_cred') || '';
  });

  const saveNetworkSettings = () => {
    localStorage.setItem('srma_use_openrelay', String(useOpenRelay));
    localStorage.setItem('srma_custom_turn_url', customTurnUrl.trim());
    localStorage.setItem('srma_custom_turn_user', customTurnUser.trim());
    localStorage.setItem('srma_custom_turn_cred', customTurnCred.trim());
    setShowNetworkSettings(false);
  };

  // Auto open listener via custom event triggered from layout menus
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-walkie-talkie', handleOpen);
    return () => window.removeEventListener('open-walkie-talkie', handleOpen);
  }, []);
  
  // Real-time audio streams from peers
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, string>>(new Map());

  // Refs for WebRTC resources
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingSubscribes = useRef<Map<string, () => void>>(new Map());
  const isSpeakingRef = useRef(false);
  const lastNotificationTimeRef = useRef<number>(0);

  // Generate a retro audio Roger Beep synthesizer
  const playRogerBeep = (type: 'start' | 'stop') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'start') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.12);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        // Rogers double-beep
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain1.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.08);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.frequency.setValueAtTime(990, audioCtx.currentTime + 0.09);
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.06, audioCtx.currentTime + 0.09);
        gain2.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(audioCtx.currentTime + 0.09);
        osc2.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn('Audio Rogers synth not ready:', e);
    }
  };

  // 1. Initialize Microphone Access
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      // Keep track enabled initially so WebRTC SDP negotiation registers an active media track
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      setPermissionGranted(true);
      setErrorMsg(null);
      return stream;
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setPermissionGranted(false);
      setErrorMsg(`Akses Mikrofon ditolak (${err.name || 'Error'}). Radio butuh izin mic untuk memancarkan suara.`);
      return null;
    }
  };

  const forceRequestMic = async () => {
    setErrorMsg(null);
    try {
      // Resume or trigger Audio Context for WebRTC and Synthesizer
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const tempCtx = new AudioContextClass();
        if (tempCtx.state === 'suspended') {
          await tempCtx.resume();
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      // Keep track enabled initially so WebRTC SDP negotiation registers an active media track
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      setPermissionGranted(true);
      setErrorMsg(null);
      alert("✅ Berhasil! Izin mikrofon diizinkan browser. Silakan hubungkan saluran radio.");
    } catch (err: any) {
      console.error(err);
      setPermissionGranted(false);
      const friendlyDetails = `${err.name || 'Error'}: ${err.message || ''}`;
      setErrorMsg(`🚨 Gagal mengaktifkan mikrofon: ${friendlyDetails}. \n\nTIPS PEMECAHAN MASALAH:\n1. Klik tombol "IZINKAN/ALLOW" pada jendela popup browser Anda.\n2. Di sebelah kiri alamat web (URL) browser Anda, klik tombol gembok (🔒) lalu aktifkan izin Mikrofon menjadi "SELALU IZINKAN/ALWAYS ALLOW".\n3. Jika menggunakan HP: masuk ke setelan privasi HP Anda dan pastikan browser Anda (Chrome/Safari) memiliki izin untuk mengakses mikrofon.`);
    }
  };

  // 2. Clean up connections
  const leaveChannel = async () => {
    if (!currentChannel) return;

    // Remove user doc from presence
    try {
      await deleteDoc(doc(db, `walkie_presence/${currentChannel}/users`, user.uid));
    } catch (e) {
      console.warn('Error clearing presence on leave:', e);
    }

    // Stop and clear signaling listeners
    signalingSubscribes.current.forEach(unsubscribe => unsubscribe());
    signalingSubscribes.current.clear();

    // Close Peer Connections
    peerConnections.current.forEach(pc => {
      pc.close();
    });
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());
    setPeerStates(new Map());

    // Turn off mic track captures
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setCurrentChannel(null);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setPermissionGranted(null);
  };

  // Automatically clean up on component unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, [currentChannel]);

  // Live subscription to custom channels
  useEffect(() => {
    const channelsCollection = collection(db, 'walkie_channels');
    const q = query(channelsCollection, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: WalkieChannel[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as WalkieChannel);
      });
      setCustomChannels(list);
    }, (error) => {
      console.warn("Failed fetching walkie channels:", error);
    });
    return () => unsubscribe();
  }, []);

  // 3. Main signaling engine & Real-time peers coordinate
  useEffect(() => {
    if (!currentChannel) return;

    const presenceCollection = collection(db, `walkie_presence/${currentChannel}/users`);
    
    // Subscribe to presence list
    const unsubscribePresence = onSnapshot(presenceCollection, async (snapshot) => {
      const usersList: WalkieUser[] = [];
      snapshot.forEach(doc => {
        usersList.push({ uid: doc.id, ...doc.data() } as WalkieUser);
      });
      
      setActiveUsers(usersList);

      // Setup WebRTC connections for any peer
      if (!localStreamRef.current && permissionGranted === null) {
        const stream = await requestMicPermission();
        if (!stream) return;
      }

      const stream = localStreamRef.current;
      if (!stream) return;

      // Load network settings from localStorage
      const localUseOpenRelay = localStorage.getItem('srma_use_openrelay') !== 'false'; // Defaults to true
      const localCustomTurnUrl = localStorage.getItem('srma_custom_turn_url') || '';
      const localCustomTurnUser = localStorage.getItem('srma_custom_turn_user') || '';
      const localCustomTurnCred = localStorage.getItem('srma_custom_turn_cred') || '';

      const iceServersList: any[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ];

      if (localUseOpenRelay) {
        iceServersList.push({
          urls: [
            'stun:openrelay.metered.ca:80',
            'stun:openrelay.metered.ca:443'
          ] as any
        });
        iceServersList.push({
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443',
            'turns:openrelay.metered.ca:443?transport=tcp'
          ] as any,
          username: 'openrelayproject',
          credential: 'openrelayproject'
        });
      }

      if (localCustomTurnUrl.trim()) {
        const customUrls = localCustomTurnUrl.split(',').map(item => item.trim());
        if (localCustomTurnUser.trim() && localCustomTurnCred.trim()) {
          iceServersList.push({
            urls: customUrls as any,
            username: localCustomTurnUser.trim(),
            credential: localCustomTurnCred.trim()
          });
        } else {
          iceServersList.push({
            urls: customUrls as any
          });
        }
      }

      const rtcConfig = {
        iceServers: iceServersList,
        iceTransportPolicy: 'all' as RTCIceTransportPolicy
      };

      usersList.forEach(peer => {
        if (peer.uid === user.uid) return; // Skip self

        // If we don't have a peer connection yet, establish it
        if (!peerConnections.current.has(peer.uid)) {
          const pc = new RTCPeerConnection(rtcConfig);
          peerConnections.current.set(peer.uid, pc);

          // Add our audio tracks
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });

          // Set initial connection state to connecting/connecting
          setPeerStates(prev => {
            const next = new Map(prev);
            next.set(peer.uid, 'connecting');
            return next;
          });

          // Track connection state changes in real time
          pc.onconnectionstatechange = () => {
            console.log(`WebRTC Connection State with ${peer.name}: ${pc.connectionState}`);
            setPeerStates(prev => {
              const next = new Map(prev);
              next.set(peer.uid, pc.connectionState);
              return next;
            });
          };

          // Handle incoming track mapping
          pc.ontrack = (event) => {
            console.log(`Received remote audio stream from peer: ${peer.name}`);
            const incomingStream = event.streams[0] || new MediaStream([event.track]);
            setRemoteStreams(prev => {
              const next = new Map(prev);
              next.set(peer.uid, incomingStream);
              return next;
            });
          };

          const signalDocId = user.uid < peer.uid 
            ? `${currentChannel}_${user.uid}_${peer.uid}`
            : `${currentChannel}_${peer.uid}_${user.uid}`;
          const signalDocRef = doc(db, 'walkie_signaling', signalDocId);

          // Priority rule: the peer with lexicographically smaller UID initiates the offer (Caller)
          if (user.uid < peer.uid) {
            // CALLER logic
            // Reset signaling doc to clear any leftover data from a previous session
            setDoc(signalDocRef, {
              callerName: user.name,
              callerRole: user.role,
              timestamp: Date.now()
            }).then(() => {
              let callerCandBuffer: any[] = [];
              let callerBufferTimeout: any = null;

              const flushCallerCandidates = () => {
                if (callerCandBuffer.length === 0) return;
                const batch = [...callerCandBuffer];
                callerCandBuffer = [];
                updateDoc(signalDocRef, {
                  candidates_caller: arrayUnion(...batch)
                }).catch(() => {
                  setDoc(signalDocRef, {
                    candidates_caller: batch
                  }, { merge: true });
                });
              };

              pc.onicecandidate = (event) => {
                const cand = event.candidate;
                if (cand) {
                  callerCandBuffer.push(cand.toJSON());
                  if (callerBufferTimeout) clearTimeout(callerBufferTimeout);
                  callerBufferTimeout = setTimeout(flushCallerCandidates, 200);
                }
              };

              pc.onicegatheringstatechange = () => {
                if (pc.iceGatheringState === 'complete') {
                  flushCallerCandidates();
                }
              };

              // Temporarily enable track for active SDP generation
              stream.getAudioTracks().forEach(t => { t.enabled = true; });

              // Create and send SDP Offer
              pc.createOffer().then(offer => {
                return pc.setLocalDescription(offer);
              }).then(() => {
                // Restore state based on actual speaking state
                stream.getAudioTracks().forEach(t => { t.enabled = isSpeakingRef.current; });
                return setDoc(signalDocRef, {
                  offer: pc.localDescription?.sdp
                }, { merge: true });
              });
            });

            // Listen for Answer
            const addedCandidates = new Set<string>();
            const bufferedCandidates: any[] = [];

            const unsubSignaling = onSnapshot(signalDocRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as SignalingData;
                if (data.answer && !pc.remoteDescription) {
                  pc.setRemoteDescription(new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.answer
                  })).then(() => {
                    // Feed buffered candidates once remoteDescription is set
                    while (bufferedCandidates.length > 0) {
                      const cand = bufferedCandidates.shift();
                      pc.addIceCandidate(new RTCIceCandidate(cand))
                        .catch(e => console.warn("Error adding buffered receiver candidate:", e));
                    }
                  }).catch(err => console.warn("Failed to set remote answer:", err));
                }
                if (data.candidates_receiver) {
                  data.candidates_receiver.forEach(cand => {
                    const candStr = JSON.stringify(cand);
                    if (!addedCandidates.has(candStr)) {
                      addedCandidates.add(candStr);
                      if (pc.remoteDescription) {
                        pc.addIceCandidate(new RTCIceCandidate(cand))
                          .catch(e => console.warn("Error adding incoming receiver candidate:", e));
                      } else {
                        bufferedCandidates.push(cand);
                      }
                    }
                  });
                }
              }
            }, (error) => {
              console.warn("Signaling caller answer error:", error);
            });
            signalingSubscribes.current.set(peer.uid, unsubSignaling);

          } else {
            // RECEIVER logic
            let rcverCandBuffer: any[] = [];
            let rcverBufferTimeout: any = null;

            const flushReceiverCandidates = () => {
              if (rcverCandBuffer.length === 0) return;
              const batch = [...rcverCandBuffer];
              rcverCandBuffer = [];
              updateDoc(signalDocRef, {
                candidates_receiver: arrayUnion(...batch)
              }).catch(() => {
                setDoc(signalDocRef, {
                  candidates_receiver: batch
                }, { merge: true });
              });
            };

            pc.onicecandidate = (event) => {
              const cand = event.candidate;
              if (cand) {
                rcverCandBuffer.push(cand.toJSON());
                if (rcverBufferTimeout) clearTimeout(rcverBufferTimeout);
                rcverBufferTimeout = setTimeout(flushReceiverCandidates, 200);
              }
            };

            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === 'complete') {
                flushReceiverCandidates();
              }
            };

            // Listen for Offer
            const addedCandidates = new Set<string>();
            const bufferedCandidates: any[] = [];

            const unsubSignaling = onSnapshot(signalDocRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as SignalingData;
                if (data.offer && !pc.remoteDescription) {
                  // Temporarily enable track for active SDP generation
                  stream.getAudioTracks().forEach(t => { t.enabled = true; });

                  pc.setRemoteDescription(new RTCSessionDescription({
                    type: 'offer',
                    sdp: data.offer
                  })).then(() => {
                    return pc.createAnswer();
                  }).then(answer => {
                    return pc.setLocalDescription(answer);
                  }).then(() => {
                    // Restore state based on actual speaking state
                    stream.getAudioTracks().forEach(t => { t.enabled = isSpeakingRef.current; });
                    setDoc(signalDocRef, {
                      answer: pc.localDescription?.sdp,
                      receiverName: user.name,
                      receiverRole: user.role
                    }, { merge: true });

                    // Feed buffered candidates once remoteDescription is set and local answer is established
                    while (bufferedCandidates.length > 0) {
                      const cand = bufferedCandidates.shift();
                      pc.addIceCandidate(new RTCIceCandidate(cand))
                        .catch(e => console.warn("Error adding buffered caller candidate:", e));
                    }
                  }).catch(err => {
                    // Restore state based on actual speaking state
                    stream.getAudioTracks().forEach(t => { t.enabled = isSpeakingRef.current; });
                    console.warn("Failed setting remote offer or creating answer:", err);
                  });
                }
                if (data.candidates_caller) {
                  data.candidates_caller.forEach(cand => {
                    const candStr = JSON.stringify(cand);
                    if (!addedCandidates.has(candStr)) {
                      addedCandidates.add(candStr);
                      if (pc.remoteDescription) {
                        pc.addIceCandidate(new RTCIceCandidate(cand))
                          .catch(e => console.warn("Error adding incoming caller candidate:", e));
                      } else {
                        bufferedCandidates.push(cand);
                      }
                    }
                  });
                }
              }
            }, (error) => {
              console.warn("Signaling receiver offer error:", error);
            });
            signalingSubscribes.current.set(peer.uid, unsubSignaling);
          }
        }
      });

      // Handle removed peers from list
      peerConnections.current.forEach((pc, peerUid) => {
        const isStillHere = usersList.some(pu => pu.uid === peerUid);
        if (!isStillHere) {
          pc.close();
          peerConnections.current.delete(peerUid);
          const unsub = signalingSubscribes.current.get(peerUid);
          if (unsub) {
            unsub();
            signalingSubscribes.current.delete(peerUid);
          }
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(peerUid);
            return next;
          });
          setPeerStates(prev => {
            const next = new Map(prev);
            next.delete(peerUid);
            return next;
          });
        }
      });

    }, (error) => {
      console.warn("Presence onSnapshot error:", error);
    });

    return () => {
      unsubscribePresence();
    };
  }, [currentChannel, permissionGranted]);

  // 4. Handle Joining Room Action
  const handleJoinChannel = async (channelName: string) => {
    if (!channelName.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    // Ask permission for microphone first
    const stream = await requestMicPermission();
    if (!stream) {
      setLoading(false);
      return;
    }

    const cleanChannelName = channelName.toUpperCase().trim();
    setCurrentChannel(cleanChannelName);

    // Set self active presence in doc
    try {
      await setDoc(doc(db, `walkie_presence/${cleanChannelName}/users`, user.uid), {
        uid: user.uid,
        name: user.name || 'Staff',
        role: user.role || 'Staff',
        isSpeaking: false,
        joinedAt: Date.now()
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal menyambung ke jaringan radio: ' + err.message);
    }
    setLoading(false);
  };

  // 4.5. Handle Custom Channel Creation
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    const cleanName = newChannelName.toUpperCase().trim();

    // Check duplicate of preset channels
    if (PRESET_CHANNELS.includes(cleanName)) {
      setErrorMsg('Nama saluran ini adalah nama saluran bawaan default!');
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, 'walkie_channels', cleanName);
      await setDoc(docRef, {
        id: cleanName,
        name: cleanName,
        password: newChannelPassword.trim(),
        createdBy: user.name || 'Staff',
        createdByRole: user.role || 'Staff',
        createdAt: Date.now()
      });

      setNewChannelName('');
      setNewChannelPassword('');
      setShowCreateForm(false);
      
      // Auto-join the created channel
      await handleJoinChannel(cleanName);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membuat saluran kustom: ' + err.message);
    }
    setLoading(false);
  };

  // 4.6. Check if Custom Channel matches password constraints
  const initiateJoinChannel = (ch: WalkieChannel) => {
    if (ch.password && ch.password.trim() !== '') {
      setChannelPendingPassword(ch);
      setPasswordInput('');
      setPasswordError(null);
    } else {
      handleJoinChannel(ch.name);
    }
  };

  // 5. Trigger Push-to-Talk (Mic Activation)
  const startSpeaking = async () => {
    if (!currentChannel || isSpeakingRef.current) return;
    
    // Check if channel is busy
    const busyUser = activeUsers.find(p => p.uid !== user.uid && p.isSpeaking);
    if (busyUser) {
      setErrorMsg(`Saluran sedang sibuk. ${busyUser.name} sedang memancarkan.`);
      return;
    }
    
    // Play Vintage Radio Crackle Beep
    playRogerBeep('start');
    
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setErrorMsg(null);

    // Enable Microphone Track
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }

    // Set speaking active state in Firestore Presence
    await updateDoc(doc(db, `walkie_presence/${currentChannel}/users`, user.uid), {
      isSpeaking: true
    }).catch(err => {
      console.warn("Failed updating broadcast presence:", err);
    });

    // Notify other staff roles who are offline or not in the app
    const now = Date.now();
    if (now - lastNotificationTimeRef.current > 45000) { // Cooldown of 45 seconds to avoid spamming
      lastNotificationTimeRef.current = now;
      try {
        const staffRolesToNotify: UserRole[] = ['dokter', 'wali_asuh', 'wali_kelas', 'kepala_sekolah', 'guru_mapel', 'wali_asrama'];
        const roleLabel = user.role === 'dokter' ? 'Klinik' : user.role === 'wali_asuh' ? 'Wali Asuh' : user.role === 'wali_asrama' ? 'Wali Asrama' : user.role === 'kepala_sekolah' ? 'Kepala Sekolah' : user.role === 'guru_mapel' ? 'Guru Mapel' : 'Staff';
        
        await notifyAllRoles(
          staffRolesToNotify,
          `🎙️ Panggilan HT: CH ${currentChannel}`,
          `${user.name} (${roleLabel}) sedang berbicara di saluran kustom "${currentChannel}". Klik untuk mendengarkan/menjawab.`,
          `walkie_talkie`
        );
      } catch (notifErr) {
        console.warn("Soft warning failed sending walkie push notification:", notifErr);
      }
    }
  };

  // 6. Release Push-to-Talk (Mic Mute)
  const stopSpeaking = async () => {
    if (!currentChannel || !isSpeakingRef.current) return;

    // Play trailing Roger Beep
    playRogerBeep('stop');

    isSpeakingRef.current = false;
    setIsSpeaking(false);

    // Disable microphone track
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }

    // Clear speaking state in presence
    await updateDoc(doc(db, `walkie_presence/${currentChannel}/users`, user.uid), {
      isSpeaking: false
    }).catch(err => {
      console.warn("Failed clearing speaking state:", err);
    });
  };

  const [loadingJoin, setLoading] = useState(false);

  return (
    <>
      {/* Floating Radar Launcher Icon Bubble */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9985] bg-[#3e2723] hover:bg-[#5d4037] text-white p-4 rounded-full shadow-[0_15px_30px_rgba(62,39,35,0.45)] border-2 border-[#ebdccb]/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 duration-150 cursor-pointer relative group"
        title="Walkie-Talkie Radio Koordinasi"
      >
        <Radio className="w-6 h-6 text-amber-200" />
        {currentChannel && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[8px] text-white font-sans font-black items-center justify-center leading-none">
              {activeUsers.length}
            </span>
          </span>
        )}
        
        {/* Hover Label tag */}
        <span className="absolute right-16 bg-stone-900 text-[#ebdccb] text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-[#ebdccb]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden md:block whitespace-nowrap">
          📡 RADIO DISPATCH WALKIE-TALKIE
        </span>
      </button>

      {/* Hidden sound feeds playing WebRTC incoming audio */}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <AudioPlayer key={peerId} stream={stream} muted={isSpeaking} />
      ))}

      {/* Walkie-Talkie Panel Sheet overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-[#3e2723]/30 backdrop-blur-xs z-[9986]"
            />

            {/* Slide-out Device Chassis */}
            <motion.div
              initial={{ x: '100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#1a0f0d] border-l border-[#ebdccb]/15 shadow-3xl z-[9987] flex flex-col p-6 font-sans text-stone-100"
            >
              {/* Retro Antenna overlay on device top */}
              <div className="absolute top-0 left-10 w-4 h-12 bg-[#2d1b18] -mt-12 rounded-t border-t border-x border-[#ebdccb]/10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#ebdccb]/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#ebdccb]/10 rounded-xl relative">
                    <Radio className="w-5 h-5 text-amber-300" />
                    {currentChannel && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-200">SRMA Dispatch Radio</h3>
                    <p className="text-[8.5px] font-bold text-stone-400 uppercase tracking-widest italic mt-0.5">Walkie-Talkie Sistem Gratis</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowNetworkSettings(!showNetworkSettings)}
                    title="Setelan Sinyal & Jaringan (TURN)"
                    className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${showNetworkSettings ? 'text-amber-400' : 'text-stone-400 hover:text-white'}`}
                  >
                    <Settings className="w-4 h-4 animate-pulse" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Display Screen */}
              <div className="my-5 p-4 rounded-2xl bg-black border border-stone-850 font-mono shadow-inner relative overflow-hidden flex flex-col justify-between min-h-[95px]">
                {/* Vintage filter overlay */}
                <div className="absolute inset-0 bg-radial-gradient from-transparent to-black pointer-events-none opacity-40" />

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${currentChannel ? 'bg-emerald-500 animate-pulse' : 'bg-stone-600'}`} />
                    <span className="text-[8px] font-bold tracking-wider text-stone-400 uppercase">
                      {currentChannel ? 'RADIO ONLINE' : 'OFFLINE CH'}
                    </span>
                  </div>
                  <span className="text-[8px] text-amber-300/80 font-bold tracking-widest">
                    STUN: FREE REGION
                  </span>
                </div>

                {currentChannel ? (
                  <div>
                    <p className="text-[8px] text-emerald-400/60 uppercase tracking-wider">SALURAN AKTIF</p>
                    <p className="text-sm font-black text-emerald-300 leading-tight tracking-wider truncate uppercase">
                      📻 CH: {currentChannel}
                    </p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-emerald-950/40 text-[9px] text-[#ebdccb]/70 font-semibold">
                      <span>👥 {activeUsers.length} ANGGOTA</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" /> 
                        P2P TERHUBUNG
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 flex flex-col items-center">
                    <Wifi className="w-5 h-5 text-stone-600 mb-1" />
                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                      Saluran Belum Terhubung
                    </p>
                    <p className="text-[8px] text-stone-500 italic mt-0.5">
                      Pilih atau ketik nama grup asrama Anda dibawah
                    </p>
                  </div>
                )}
              </div>

              {/* Compact mic authorization helper ONLY if not granted */}
              {permissionGranted !== true && (
                <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-[10px]">
                  <div className="flex items-center gap-2 text-amber-200">
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="font-bold tracking-tight">Izin Mikrofon diperlukan untuk bicara</span>
                  </div>
                  <button
                    onClick={forceRequestMic}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-[#3e2723] rounded-lg font-black text-[9px] uppercase tracking-wider shrink-0 cursor-pointer active:scale-95 transition-all"
                  >
                    Aktifkan Mic
                  </button>
                </div>
              )}

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-900/30 text-red-300 text-[10px] whitespace-pre-line leading-relaxed italic">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Main functional workspace */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
                {showNetworkSettings ? (
                  <div className="space-y-4 pt-1 bg-[#231412]/50 p-4 rounded-2xl border border-[#ebdccb]/10 text-xs text-stone-200">
                    <div className="flex items-center justify-between border-b border-[#ebdccb]/10 pb-2">
                      <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                        ⚙️ SETELAN RADIO & TURN
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowNetworkSettings(false)} 
                        className="text-stone-400 hover:text-white text-[8.5px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        TUTUP
                      </button>
                    </div>

                    {/* Integrated Microphone Settings & Diagnostic Screen */}
                    <div className="p-3.5 rounded-xl bg-[#1a0f0d] border border-stone-850 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                        <span className="text-[#ebdccb]/85">Status Mikrofon HP/PC</span>
                        {permissionGranted === true ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> AKTIF / HI-FI
                          </span>
                        ) : permissionGranted === false ? (
                          <span className="text-red-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /> DIBLOKIR / ERROR
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> SIAP DIAKTIFKAN
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={forceRequestMic}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                            permissionGranted === true
                              ? 'bg-emerald-550/15 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-555/35'
                              : 'bg-amber-400 hover:bg-amber-300 text-[#3e2723]'
                          }`}
                        >
                          <Mic className="w-3 h-3" />
                          {permissionGranted === true ? 'TES ULANG MIC' : '🔑 AKTIFKAN MIC'}
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                              if (AudioContextClass) {
                                const testCtx = new AudioContextClass();
                                await testCtx.resume();
                                const osc = testCtx.createOscillator();
                                const gain = testCtx.createGain();
                                osc.frequency.setValueAtTime(600, testCtx.currentTime);
                                gain.gain.setValueAtTime(0.05, testCtx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.001, testCtx.currentTime + 0.3);
                                osc.connect(gain);
                                gain.connect(testCtx.destination);
                                osc.start();
                                osc.stop(testCtx.currentTime + 0.3);
                                alert("🔊 Suara Beep pengujian berhasil diputar!");
                              } else {
                                alert("Browser Anda tidak mendukung Web Audio API.");
                              }
                            } catch (e: any) {
                              alert("⚠️ Gagal memutar suara: " + e.message);
                            }
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          TES BEEP
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-[10px] leading-relaxed text-stone-300">
                        Sistem radio menggunakan koneksi langsung browser-ke-browser (<strong>WebRTC P2P</strong>).
                      </p>
                      <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-[9px] text-amber-200 leading-relaxed font-semibold">
                        <p className="font-bold mb-1">📶 JALUR ANTAR JARINGAN BERBEDA:</p>
                        Jika Anda menggunakan HP di luar jangkauan Wi-Fi asrama (misal: pakai jaringan data seluler Telkomsel/XL/Indosat), operator seluler memiliki pengaman ketat (<strong>Symmetric NAT / CGNAT</strong>) yang memblokir suara langsung. Solusinya, silakan aktifkan <strong>TURN Relay Server</strong> di bawah sebagai jembatan transmisi audio Anda.
                      </div>
                    </div>

                    {/* OpenRelay Toggle */}
                    <div className="py-2.5 px-3 bg-[#1a0f0d] rounded-xl border border-stone-850 flex items-center justify-between">
                      <div className="pr-2 min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-wider block text-stone-200">
                          Bawaan Otomatis (Open Relay)
                        </span>
                        <span className="text-[8px] text-stone-500 font-bold block mt-0.5 leading-normal uppercase">
                          Menggunakan rute cadangan gratis global (Metered.ca). AKTIFKAN AGAR LANGSUNG JALAN DI DATA HP!
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={useOpenRelay}
                        onChange={(e) => setUseOpenRelay(e.target.checked)}
                        className="w-4 h-4 rounded border-stone-800 bg-[#281715] text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer shrink-0"
                      />
                    </div>

                    {/* Custom TURN setup */}
                    <div className="space-y-3 pt-2 border-t border-stone-850">
                      <span className="text-[8.5px] font-black text-amber-200 uppercase tracking-widest block">KUSTOM PREMIUM TURN (OPSIONAL)</span>
                      
                      <div>
                        <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">TURN SERVER URIs (Pisahkan Koma)</label>
                        <input
                          type="text"
                          value={customTurnUrl}
                          onChange={(e) => setCustomTurnUrl(e.target.value)}
                          placeholder="turn:global.metered.ca:443"
                          className="w-full bg-[#281715] text-[#ebdccb] border border-[#ebdccb]/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-amber-400 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">USERNAME</label>
                          <input
                            type="text"
                            value={customTurnUser}
                            onChange={(e) => setCustomTurnUser(e.target.value)}
                            placeholder="username"
                            className="w-full bg-[#281715] text-[#ebdccb] border border-[#ebdccb]/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-amber-400 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">PASSWORD / SECRET</label>
                          <input
                            type="password"
                            value={customTurnCred}
                            onChange={(e) => setCustomTurnCred(e.target.value)}
                            placeholder="sandi"
                            className="w-full bg-[#281715] text-[#ebdccb] border border-[#ebdccb]/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-amber-400 font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUseOpenRelay(true);
                          setCustomTurnUrl('');
                          setCustomTurnUser('');
                          setCustomTurnCred('');
                        }}
                        className="flex-1 py-2 bg-stone-900 border border-stone-800 hover:bg-stone-850 text-stone-400 hover:text-stone-200 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      >
                        RESET NILAI
                      </button>
                      <button
                        type="button"
                        onClick={saveNetworkSettings}
                        className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#3e2723] font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        SIMPAN SETELAN
                      </button>
                    </div>

                    <div className="text-[8px] text-stone-500 uppercase font-black text-center pt-2 border-t border-stone-850 leading-normal">
                      ℹ️ Silakan masuk kembali ke saluran setelah menyimpan untuk menerapkan jalur koneksi yang baru.
                    </div>
                  </div>
                ) : !currentChannel ? (
                  // Step 1: Channel Entry Selection
                  <div className="space-y-4 pt-1">
                    <h5 className="text-[9px] font-black uppercase text-amber-300/70 tracking-widest">
                      🔊 PILIHAN SALURAN DISPATCH PRESET
                    </h5>
                    <div className="grid gap-2">
                      {PRESET_CHANNELS.map((ch, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleJoinChannel(ch)}
                          disabled={loadingJoin}
                          className="w-full text-left p-3.5 rounded-xl bg-[#281715] hover:bg-[#341e1b] border border-[#ebdccb]/5 hover:border-amber-500/20 text-[#ebdccb] hover:text-amber-200 text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-between group disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="w-5 h-5 bg-amber-500/10 rounded-lg flex items-center justify-center text-[10px] font-black text-amber-300 group-hover:bg-amber-400 group-hover:text-amber-950 transition-colors">
                              {idx + 1}
                            </span>
                            {ch}
                          </span>
                          <span className="text-[8.5px] font-black text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">MASUK &raquo;</span>
                        </button>
                      ))}
                    </div>

                    {/* Live Custom Channels List */}
                    {customChannels.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-[#ebdccb]/10">
                        <h5 className="text-[9px] font-black uppercase text-amber-300/70 tracking-widest flex items-center gap-1.5 pt-2">
                          📡 SALURAN KUSTOM AKTIF ({customChannels.length})
                        </h5>
                        <div className="grid gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {customChannels.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => initiateJoinChannel(ch)}
                              disabled={loadingJoin}
                              className="w-full text-left p-3 rounded-xl bg-[#201110] hover:bg-[#2b1715] border border-[#ebdccb]/5 hover:border-amber-400/30 text-[#ebdccb] hover:text-amber-200 text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-between group disabled:opacity-50 cursor-pointer"
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="flex items-center gap-1.5 font-black truncate text-stone-200 group-hover:text-amber-200">
                                  📻 {ch.name}
                                  {ch.password && ch.password.trim() !== '' && (
                                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                  )}
                                </span>
                                <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider mt-0.5">
                                  Dibuat oleh: {ch.createdBy} ({ch.createdByRole?.replace('_', ' ') || 'Staff'})
                                </span>
                              </div>
                              <span className="text-[8px] font-black text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">HUBUNGKAN &raquo;</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative py-2 flex items-center justify-center">
                      <div className="absolute inset-x-0 h-px bg-[#ebdccb]/10" />
                      <span className="relative z-10 px-3 bg-[#1a0f0d] text-[8.5px] font-black text-stone-500 uppercase tracking-widest">Sandi Kustom</span>
                    </div>

                    {/* Create Custom Channel Interface */}
                    {!showCreateForm ? (
                      <button
                        onClick={() => {
                          setNewChannelName('');
                          setNewChannelPassword('');
                          setShowCreateForm(true);
                        }}
                        className="w-full py-3.5 border border-dashed border-[#ebdccb]/20 hover:border-amber-400/50 rounded-xl flex items-center justify-center gap-2 text-stone-300 hover:text-amber-200 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-amber-300" />
                        BUAT SALURAN KUSTOM BARU
                      </button>
                    ) : (
                      <form onSubmit={handleCreateChannel} className="bg-[#211311] border border-[#ebdccb]/10 p-4 rounded-xl space-y-3.5">
                        <div className="flex items-center justify-between border-b border-[#ebdccb]/10 pb-2">
                          <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest">BUAT FREKUENSI KUSTOM</span>
                          <button 
                            type="button" 
                            onClick={() => setShowCreateForm(false)} 
                            className="text-stone-400 hover:text-white text-[9px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            BATAL
                          </button>
                        </div>
                        
                        <div>
                          <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">NAMA JALUR CHANNEL (HURUF BESAR)</label>
                          <input
                            type="text"
                            required
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                            placeholder="Contoh: ASRAMA KEDIRI 1..."
                            className="w-full bg-[#281715] text-[#ebdccb] border border-[#ebdccb]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-amber-400 uppercase font-black"
                          />
                        </div>

                        <div>
                          <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">PASSWORD PENGAMAN (KOSONGKAN JIKA BEBAS)</label>
                          <input
                            type="password"
                            value={newChannelPassword}
                            onChange={(e) => setNewChannelPassword(e.target.value)}
                            placeholder="Sandi Rahasia..."
                            className="w-full bg-[#281715] text-[#ebdccb] border border-[#ebdccb]/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-amber-400 font-bold"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loadingJoin || !newChannelName.trim()}
                          className="w-full py-3 bg-[#ebdccb] hover:bg-stone-100 disabled:opacity-55 text-[#3e2723] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 duration-100 cursor-pointer"
                        >
                          {loadingJoin ? 'PROSES PENYIMPANAN...' : 'SIMPAN & AKTIFKAN SALURAN'}
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  // Step 2: Active Radio Communication Room
                  <div className="space-y-4 pt-1 flex flex-col h-full justify-between">
                    {/* Active dispatch members listing */}
                    <div className="bg-[#211311] rounded-2xl border border-[#ebdccb]/5 p-4 flex-1 overflow-y-auto max-h-[220px]">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#ebdccb]/5">
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">👥 ANGGOTA AKTIF DI UDARA</span>
                        <span className="text-[8px] bg-amber-500/15 text-amber-300 font-black px-2 py-0.5 rounded-md uppercase">FREKUENSI TERHUBUNG</span>
                      </div>
                      
                      {activeUsers.length === 0 ? (
                        <p className="text-stone-500 text-[10px] italic py-4 text-center">Menghubungkan sinyal...</p>
                      ) : (
                        <div className="space-y-2">
                          {activeUsers.map((p) => (
                            <div 
                              key={p.uid} 
                              className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                                p.isSpeaking 
                                  ? 'bg-[#1b2b1b] border border-emerald-500/30' 
                                  : 'bg-[#2a1a18]/60 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#3e2723] border border-[#ebdccb]/10 flex items-center justify-center font-bold text-xs shrink-0 text-amber-200 select-none">
                                  {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-stone-200 truncate uppercase tracking-tight flex items-center gap-1.5">
                                    {p.name}
                                    {p.uid === user.uid && <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">SAYA</span>}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[8.5px] text-stone-400 font-bold uppercase tracking-widest leading-none">
                                      {p.role.replace('_', ' ')}
                                    </span>
                                    {p.uid !== user.uid && (
                                      (() => {
                                        const state = peerStates.get(p.uid);
                                        if (state === 'connected') {
                                          return <span className="text-[7px] font-black text-emerald-400 bg-emerald-950/45 px-1 py-0.5 rounded tracking-wide border border-emerald-500/15 select-none leading-none">🟢 TERSAMBUNG</span>;
                                        } else if (state === 'connecting') {
                                          return <span className="text-[7px] font-black text-amber-300 bg-amber-950/45 px-1 py-0.5 rounded tracking-wide border border-amber-500/15 animate-pulse select-none leading-none">🟡 NYAMBUNG</span>;
                                        } else if (state === 'failed' || state === 'disconnected') {
                                          return <span className="text-[7px] font-black text-red-400 bg-red-950/45 px-1 py-0.5 rounded tracking-wide border border-red-500/15 select-none leading-none">🔴 TERPUTUS</span>;
                                        } else {
                                          return <span className="text-[7px] font-black text-stone-400 bg-stone-900/65 px-1 py-0.5 rounded tracking-wide border border-stone-800 select-none leading-none">⚪ SIAGA</span>;
                                        }
                                      })()
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                {p.isSpeaking ? (
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[9px] uppercase tracking-wider animate-pulse">
                                    <span className="flex space-x-0.5">
                                      <span className="h-2 w-0.5 bg-emerald-400 animate-bounce duration-150" />
                                      <span className="h-3.5 w-0.5 bg-emerald-400 animate-bounce duration-300" />
                                      <span className="h-2.5 w-0.5 bg-emerald-400 animate-bounce duration-450" />
                                    </span>
                                    MEMANCARKAN
                                  </div>
                                ) : (
                                  <span className="text-[8.5px] text-stone-500 font-black tracking-widest uppercase">STANDBY</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Huge Retro PTT Broadcast Button Section */}
                    <div className="flex flex-col items-center justify-center py-3">
                      <p className={`text-[8.5px] font-black tracking-widest uppercase mb-4 italic text-center px-4 ${isChannelBusy ? 'text-red-400 animate-pulse' : 'text-[#ebdccb]/40'}`}>
                        {isSpeaking 
                          ? '📢 MICROPHONE AKTIF (LEPAS UNTUK SELESAI)' 
                          : isChannelBusy
                            ? `⚠️ SIBUK: [${otherSpeakingUser.name}] SEDANG TRANSMISI`
                            : '🔵 SENTUH DAN TAHAN TOMBOL UNTUK TRANSMISI SUARA'
                        }
                      </p>

                      {/* Giant circular radio button */}
                      <div className="relative">
                        {/* Outer pulsing transmitter lights */}
                        {isSpeaking && (
                          <span className="absolute inset-0 bg-emerald-500/20 rounded-full scale-150 animate-ping duration-[1000ms]" />
                        )}

                        <button
                          onMouseDown={!isChannelBusy ? startSpeaking : undefined}
                          onMouseUp={stopSpeaking}
                          onMouseLeave={stopSpeaking}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            if (!isChannelBusy) startSpeaking();
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            stopSpeaking();
                          }}
                          onTouchCancel={(e) => {
                            e.preventDefault();
                            stopSpeaking();
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                          }}
                          disabled={isChannelBusy}
                          className={`w-32 h-32 rounded-full border-4 shadow-2xl flex flex-col items-center justify-center transition-all select-none duration-150 outline-none ${
                            isSpeaking 
                              ? 'bg-[#1b3e1b] border-emerald-400 text-[#ebdccb] hover:bg-[#204a20]' 
                              : isChannelBusy
                                ? 'bg-[#2b1614] border-red-500/40 text-red-400 cursor-not-allowed'
                                : 'bg-[#3e2723] border-[#ebdccb]/20 text-stone-100 hover:bg-[#52332e] cursor-pointer'
                          }`}
                        >
                          {isSpeaking ? (
                            <Mic className="w-12 h-12 text-emerald-300 animate-pulse" />
                          ) : isChannelBusy ? (
                            <Lock className="w-12 h-12 text-red-400 animate-bounce" />
                          ) : (
                            <MicOff className="w-12 h-12 text-amber-200" />
                          )}
                          <span className="text-[9px] font-black tracking-widest uppercase mt-2.5 px-2 text-center leading-tight">
                            {isSpeaking ? 'PTT AKTIF' : isChannelBusy ? 'SALURAN SIBUK' : 'PUSH TO TALK'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Troubleshooting Mobile Phone Audio Box */}
                    <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[9px] leading-relaxed text-[#ebdccb]/90 space-y-1.5 font-sans">
                      <div className="flex items-center gap-1.5 text-amber-300 font-black uppercase tracking-wider text-[8.5px]">
                        <Volume2 className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                        <span>⚠️ SUARA BELUM TERDENGAR DI LAWAN BICARA?</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-stone-300">
                        <li>
                          <strong>Faktor Speaker HP:</strong> Di sebagian HP (iPhone/Android), karena mikrofon sedang aktif, browser secara otomatis mengalihkan keluaran suara ke <strong>speaker atas/telinga (Earpiece)</strong> seperti saat menelepon biasa, bukan speaker multimedia utama.
                        </li>
                        <li>
                          <strong>Solusi Utama:</strong> Tempelkan HP ke telinga Anda untuk mendengarkan, atau sambungkan <strong>Headset/Earphone</strong> agar suara terdengar kencang dan jelas!
                        </li>
                        <li>
                          <strong>Solusi Volume:</strong> Pastikan Anda dan teman Anda menaikkan volume media/pesan suara di HP hingga maksimal saat berbicara.
                        </li>
                        <li>
                          <strong>Cek Status Koneksi:</strong> Pastikan status di bawah nama teman Anda berubah menjadi <span className="text-emerald-400 font-bold">"🟢 TERSAMBUNG"</span> di daftar Anggota di atas. Jika gagal tersambung, coba keluar saluran lalu masuk kembali!
                        </li>
                      </ul>
                    </div>

                    {/* Exit frequency network action button */}
                    <button
                      onClick={leaveChannel}
                      className="w-full mt-4 py-3 bg-[#a13d2d]/10 hover:bg-[#a13d2d]/25 border border-[#a13d2d]/30 text-[#f5c6c1] text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4 text-[#e57373]" />
                      KELUAR JALUR RADIO (LEAVE CH)
                    </button>
                  </div>
                )}
              </div>

              {/* Radio dispatcher footer details and custom designer credit */}
              <div className="mt-6 pt-4 border-t border-[#ebdccb]/10 bg-black/35 -mx-6 -mb-6 px-6 py-4 flex flex-col gap-3">
                <div className="flex items-start gap-2 text-stone-500">
                  <Info className="w-4 h-4 text-amber-200 shrink-0 mt-0.5" />
                  <p className="text-[8px] leading-relaxed font-semibold">
                    Teknologi WebRTC melakukan transmisi audio di enkripsi secara langsung dari browser-ke-browser (P2P), yang membuatnya **100% GRATIS** tanpa memakan kuota simpanan database kuota Firestore Anda melainkan hanya pertukaran sandi signaling di awal.
                  </p>
                </div>
                <div className="text-center pt-2 border-t border-stone-900/45">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-200/30 italic block">
                    Didesain oleh pak eko
                  </span>
                </div>
              </div>

              {/* Password overlay */}
              {channelPendingPassword && (
                <div className="absolute inset-0 bg-[#160a09]/98 z-[9990] flex flex-col justify-center p-6 text-stone-100 rounded-l-3xl">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-500/25">
                      <Lock className="w-6 h-6 text-amber-300 animate-pulse" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-amber-200">SALURAN TERKUNCI</h4>
                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                      Saluran {channelPendingPassword.name} diproteksi kunci sandi
                    </p>
                  </div>

                  <div className="space-y-4 max-w-xs mx-auto w-full">
                    <div>
                      <label className="text-[8px] font-black text-stone-400 tracking-wider uppercase block mb-1">MASUKKAN SANDI AKSES</label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Ketik password saluran..."
                        className="w-full bg-[#201110] text-[#ebdccb] border border-[#ebdccb]/15 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200/25 font-bold text-center uppercase tracking-widest"
                      />
                      {passwordError && (
                        <p className="text-red-400 text-[9px] font-black uppercase tracking-tight mt-2 text-center animate-shake">
                          ⚠️ {passwordError}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChannelPendingPassword(null);
                          setPasswordInput('');
                          setPasswordError(null);
                        }}
                        className="flex-1 py-3 bg-stone-900 border border-stone-800 hover:bg-stone-850 text-stone-400 hover:text-stone-200 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      >
                        BATAL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (passwordInput.trim() === channelPendingPassword.password?.trim()) {
                            handleJoinChannel(channelPendingPassword.name);
                            setChannelPendingPassword(null);
                          } else {
                            setPasswordError('Sandi salah! Silakan coba lagi.');
                          }
                        }}
                        className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-[#3e2723] font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      >
                        HUBUNGKAN
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Sub-component to bind WebRTC remote audio stream dynamically
const AudioPlayer: React.FC<{ stream: MediaStream; muted?: boolean }> = ({ stream, muted = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      if (!muted) {
        audioRef.current.play().catch(e => {
          console.warn("Play on unmute failed: ", e);
        });
      }
    }
  }, [muted]);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = 1.0;
      audioRef.current.muted = muted;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Audio autoplay was restricted by browser. Waiting for interaction or retrying...", error);
          // Retry on subsequent interaction just in case
          const retryPlay = () => {
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.log("Retry play failed:", e));
            }
            window.removeEventListener('click', retryPlay);
          };
          window.addEventListener('click', retryPlay);
        });
      }
    }
  }, [stream]);

  return (
    <audio 
      ref={audioRef} 
      playsInline
      autoPlay
      muted={muted}
      className="opacity-0 pointer-events-none absolute w-[1px] h-[1px]" 
      controls={false}
    />
  );
};
