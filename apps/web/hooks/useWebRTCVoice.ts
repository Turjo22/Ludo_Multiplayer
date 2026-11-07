'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, PlayerColor } from '@ludo/shared-types';

export interface VoicePeer {
  socketId: string;
  playerId: string;
  color: PlayerColor;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface PeerConnectionData {
  pc: RTCPeerConnection;
  candidateQueue: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
}

// Global STUN & Free Public Open Relay TURN servers (Metered Open Relay project)
// Standard web ports 80 & 443 with UDP and TCP transport to bypass all cellular and symmetric NATs
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTCVoice(
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null,
  sessionId?: string
) {
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicePeers, setVoicePeers] = useState<Map<string, VoicePeer>>(new Map());
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, PeerConnectionData>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  // Initialize or resume AudioContext for volume analysis
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Monitor speaking levels for local and remote streams
  const startAudioMonitoring = useCallback(() => {
    const dataArray = new Uint8Array(64);

    const checkLevels = () => {
      // 1. Local speaking level
      if (localAnalyserRef.current && !isMuted) {
        localAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > 15);
      } else {
        setIsSpeaking(false);
      }

      // 2. Remote peer speaking levels
      remoteAnalysers.current.forEach((analyser, peerSocketId) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const peerSpeaking = avg > 15;

        setVoicePeers((prev) => {
          const peer = prev.get(peerSocketId);
          if (peer && peer.isSpeaking !== peerSpeaking) {
            const next = new Map(prev);
            next.set(peerSocketId, { ...peer, isSpeaking: peerSpeaking });
            return next;
          }
          return prev;
        });
      });

      animFrameRef.current = requestAnimationFrame(checkLevels);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(checkLevels);
  }, [isMuted]);

  // Attach remote audio securely to DOM-rendered audio element with playsinline and fallback analysis
  const attachRemoteAudio = useCallback(
    (targetSocketId: string, stream: MediaStream) => {
      try {
        const audioCtx = getAudioContext();

        // Setup remote speaking level detector
        if (audioCtx) {
          try {
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            remoteAnalysers.current.set(targetSocketId, analyser);
          } catch (ctxErr) {
            console.warn('[WebRTC Voice] Remote analyser connect error:', ctxErr);
          }
        }

        // HTML5 Audio Element attached to DOM for hardware speaker output
        let audioEl = audioElements.current.get(targetSocketId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `webrtc-audio-${targetSocketId}`;
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.setAttribute('webkit-playsinline', 'true');

          // Position off-screen instead of display:none so mobile power managers don't suspend playback
          audioEl.style.position = 'fixed';
          audioEl.style.top = '-9999px';
          audioEl.style.left = '-9999px';
          audioEl.style.width = '1px';
          audioEl.style.height = '1px';
          audioEl.style.opacity = '0.01';
          audioEl.style.pointerEvents = 'none';

          document.body.appendChild(audioEl);
          audioElements.current.set(targetSocketId, audioEl);
        }

        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;

        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[WebRTC Voice] Autoplay caught, retrying on next interaction:', err);
          });
        }
      } catch (err) {
        console.warn('[WebRTC Voice] Failed to attach remote audio:', err);
      }
    },
    [getAudioContext]
  );

  // Create a managed PeerConnection with proper single transceiver & ICE candidate queuing
  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      // Clean up previous connection if exists
      const existing = peerConnections.current.get(targetSocketId);
      if (existing) {
        try {
          existing.pc.close();
        } catch {}
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const peerData: PeerConnectionData = {
        pc,
        candidateQueue: [],
        hasRemoteDescription: false,
      };

      // Add local audio tracks (DO NOT add an extra empty transceiver to prevent dual-line silence bug)
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('voice:signal', {
            targetSocketId,
            signal: { candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate },
          });
        }
      };

      // Handle remote incoming audio track
      pc.ontrack = (event) => {
        const stream =
          (event.streams && event.streams[0]) || new MediaStream([event.track]);
        attachRemoteAudio(targetSocketId, stream);
      };

      // ICE state monitoring and automatic restart on connection failure
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC Voice] ICE Connection failed with peer, restarting ICE...');
          pc.restartIce();
        }
      };

      peerConnections.current.set(targetSocketId, peerData);
      return peerData;
    },
    [socket, attachRemoteAudio]
  );

  // Join Voice Room
  const joinVoice = useCallback(async () => {
    if (!socket) return;
    setVoiceError(null);

    // 1. Unlock browser audio playback within the user tap gesture
    try {
      const dummyAudio = new Audio();
      dummyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      dummyAudio.play().catch(() => {});

      const audioCtx = getAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
    } catch {}

    // 2. Request microphone access with mobile fallback
    try {
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        // Fallback for devices that reject advanced constraint objects
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (!stream) {
        throw new Error('Could not access microphone.');
      }

      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      localStreamRef.current = stream;

      // Set up local speaking analyser
      const audioCtx = getAudioContext();
      if (audioCtx) {
        const localSource = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        localSource.connect(analyser);
        localAnalyserRef.current = analyser;
      }

      startAudioMonitoring();
      setInVoice(true);
      setIsMuted(false);

      socket.emit('voice:join');
    } catch (err: any) {
      console.warn('[WebRTC Voice] Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Mic permission blocked. Tap to grant permission in browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setVoiceError('No microphone detected on your device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setVoiceError('Mic is used by another app. Close background calls & retry.');
      } else {
        setVoiceError('Microphone error: ' + (err.message || 'Access failed'));
      }
    }
  }, [socket, getAudioContext, startAudioMonitoring]);

  // Leave Voice Room
  const leaveVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    peerConnections.current.forEach(({ pc }) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnections.current.clear();

    audioElements.current.forEach((el) => {
      el.srcObject = null;
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    audioElements.current.clear();
    remoteAnalysers.current.clear();

    setVoicePeers(new Map());
    setInVoice(false);
    setIsMuted(false);
    setIsSpeaking(false);
    setVoiceError(null);

    if (socket) {
      socket.emit('voice:leave');
    }
  }, [socket]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    if (socket) {
      socket.emit('voice:mute', { isMuted: nextMuted });
    }
  }, [isMuted, socket]);

  // Socket signaling event listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Initial list of existing peers in voice room
    socket.on('voice:active-users', async ({ users }) => {
      const peerMap = new Map<string, VoicePeer>();

      for (const user of users) {
        peerMap.set(user.socketId, {
          socketId: user.socketId,
          playerId: user.playerId,
          color: user.color,
          isMuted: user.isMuted,
          isSpeaking: false,
        });

        // Offer to existing peer
        const peerData = createPeerConnection(user.socketId);
        try {
          const offer = await peerData.pc.createOffer({
            offerToReceiveAudio: true,
          });
          await peerData.pc.setLocalDescription(offer);
          socket.emit('voice:signal', {
            targetSocketId: user.socketId,
            signal: { sdp: peerData.pc.localDescription },
          });
        } catch (err) {
          console.warn('[WebRTC Voice] Create offer error:', err);
        }
      }

      setVoicePeers(peerMap);
    });

    // 2. Another player joined the voice room
    socket.on('voice:user-joined', (user) => {
      setVoicePeers((prev) => {
        const next = new Map(prev);
        next.set(user.socketId, {
          socketId: user.socketId,
          playerId: user.playerId,
          color: user.color,
          isMuted: user.isMuted,
          isSpeaking: false,
        });
        return next;
      });
    });

    // 3. Player left voice room
    socket.on('voice:user-left', ({ socketId: leftSocketId }) => {
      const peerData = peerConnections.current.get(leftSocketId);
      if (peerData) {
        try {
          peerData.pc.close();
        } catch {}
        peerConnections.current.delete(leftSocketId);
      }

      const el = audioElements.current.get(leftSocketId);
      if (el) {
        el.srcObject = null;
        if (el.parentNode) el.parentNode.removeChild(el);
        audioElements.current.delete(leftSocketId);
      }
      remoteAnalysers.current.delete(leftSocketId);

      setVoicePeers((prev) => {
        const next = new Map(prev);
        next.delete(leftSocketId);
        return next;
      });
    });

    // 4. Player muted/unmuted
    socket.on('voice:user-muted', ({ socketId: mutedSocketId, isMuted: peerMuted }) => {
      setVoicePeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(mutedSocketId);
        if (peer) {
          next.set(mutedSocketId, { ...peer, isMuted: peerMuted });
        }
        return next;
      });
    });

    // 5. WebRTC P2P Signaling with Candidate Queueing
    socket.on('voice:signal', async ({ senderSocketId, signal }) => {
      let peerData = peerConnections.current.get(senderSocketId);
      if (!peerData) {
        peerData = createPeerConnection(senderSocketId);
      }

      const { pc } = peerData;

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          peerData.hasRemoteDescription = true;

          // Drain queued candidates now that remote description is set
          while (peerData.candidateQueue.length > 0) {
            const queuedCand = peerData.candidateQueue.shift();
            if (queuedCand) {
              await pc.addIceCandidate(new RTCIceCandidate(queuedCand)).catch(() => {});
            }
          }

          // If offer, create and return answer
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', {
              targetSocketId: senderSocketId,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          if (!peerData.hasRemoteDescription) {
            peerData.candidateQueue.push(signal.candidate);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[WebRTC Voice] Signal handling error:', err);
      }
    });

    return () => {
      socket.off('voice:active-users');
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
      socket.off('voice:user-muted');
      socket.off('voice:signal');
    };
  }, [socket, createPeerConnection]);

  // Clean up on unmount or session change
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice, sessionId]);

  return {
    inVoice,
    isMuted,
    isSpeaking,
    voicePeers: Array.from(voicePeers.values()),
    voiceError,
    joinVoice,
    leaveVoice,
    toggleMute,
    clearError: () => setVoiceError(null),
  };
}
