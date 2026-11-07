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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:global.stun.twilio.com:3478' },
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  // Initialize or resume AudioContext on user gesture
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
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    const dataArray = new Uint8Array(128);

    const checkLevels = () => {
      // 1. Local speaking check
      if (analyserRef.current && !isMuted) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > 14);
      } else {
        setIsSpeaking(false);
      }

      // 2. Remote peers speaking check
      remoteAnalysers.current.forEach((analyser, peerSocketId) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const peerSpeaking = avg > 14;

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
  }, [getAudioContext, isMuted]);

  // Attach audio playback safely with DOM attachment and Web Audio API routing
  const attachRemoteAudio = useCallback(
    (targetSocketId: string, stream: MediaStream) => {
      try {
        const audioCtx = getAudioContext();

        // 1. Web Audio API routing (guarantees playback across mobile restrictions)
        if (audioCtx) {
          try {
            const source = audioCtx.createMediaStreamSource(stream);

            // Speaking detector for this remote peer
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            remoteAnalysers.current.set(targetSocketId, analyser);

            // Connect to audio hardware destination
            source.connect(audioCtx.destination);
          } catch (ctxErr) {
            console.warn('[WebRTC Voice] AudioContext source connect error:', ctxErr);
          }
        }

        // 2. HTML5 Audio element fallback (attached to DOM with playsinline)
        let audioEl = audioElements.current.get(targetSocketId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `remote-audio-${targetSocketId}`;
          audioEl.style.display = 'none';
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.setAttribute('webkit-playsinline', 'true');
          document.body.appendChild(audioEl);
          audioElements.current.set(targetSocketId, audioEl);
        }

        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().catch((playErr) => {
          console.warn('[WebRTC Voice] Audio element autoplay caught:', playErr);
        });
      } catch (err) {
        console.warn('[WebRTC Voice] Failed to attach remote audio:', err);
      }
    },
    [getAudioContext]
  );

  // Create a managed PeerConnection with ICE candidate queuing
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

      // Add bidirectional audio transceiver
      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      } catch {}

      // Add local audio tracks to peer connection
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

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          // Attempt ICE restart
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

    // Unlock AudioContext on user gesture
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    try {
      let stream: MediaStream | null = null;

      // 1. Attempt constrained audio (clean voice with echo cancellation)
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
        // 2. Mobile fallback without advanced constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (!stream) {
        throw new Error('Could not access microphone.');
      }

      localStreamRef.current = stream;

      // Set up local speaking analyser
      if (audioCtx) {
        const localSource = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        localSource.connect(analyser);
        analyserRef.current = analyser;
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

    // 5. WebRTC P2P Signaling with Candidate Queueing (Solves dropped audio candidates)
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
            // Queue candidate until remote description is set
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
