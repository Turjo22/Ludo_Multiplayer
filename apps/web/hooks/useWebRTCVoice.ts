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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Monitor speaking levels for local user
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkSpeaking = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > 18);
        animFrameRef.current = requestAnimationFrame(checkSpeaking);
      };

      checkSpeaking();
    } catch {}
  }, []);

  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('voice:signal', {
            targetSocketId,
            signal: { candidate: event.candidate },
          });
        }
      };

      // Handle remote incoming audio stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        let audioEl = audioElements.current.get(targetSocketId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioElements.current.set(targetSocketId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {});
      };

      peerConnections.current.set(targetSocketId, pc);
      return pc;
    },
    [socket]
  );

  // Join Voice
  const joinVoice = useCallback(async () => {
    if (!socket || inVoice) return;
    setVoiceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setupAudioAnalyser(stream);
      setInVoice(true);
      setIsMuted(false);

      socket.emit('voice:join');
    } catch (err: any) {
      console.warn('[WebRTC Voice] Microphone access error:', err);
      setVoiceError('Microphone access denied. Please allow microphone permissions.');
    }
  }, [socket, inVoice, setupAudioAnalyser]);

  // Leave Voice
  const leaveVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    audioElements.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElements.current.clear();

    setVoicePeers(new Map());
    setInVoice(false);
    setIsMuted(false);
    setIsSpeaking(false);

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

  // Socket event listeners for WebRTC signaling
  useEffect(() => {
    if (!socket) return;

    // Active users in room when joining
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

        // Initiate connection to existing peer
        const pc = createPeerConnection(user.socketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice:signal', {
            targetSocketId: user.socketId,
            signal: { sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[WebRTC Voice] Create offer error:', err);
        }
      }

      setVoicePeers(peerMap);
    });

    // New user joined voice
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

    // User left voice
    socket.on('voice:user-left', ({ socketId: leftSocketId }) => {
      const pc = peerConnections.current.get(leftSocketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(leftSocketId);
      }
      const el = audioElements.current.get(leftSocketId);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElements.current.delete(leftSocketId);
      }

      setVoicePeers((prev) => {
        const next = new Map(prev);
        next.delete(leftSocketId);
        return next;
      });
    });

    // User muted/unmuted
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

    // WebRTC Signaling Relay
    socket.on('voice:signal', async ({ senderSocketId, signal }) => {
      let pc = peerConnections.current.get(senderSocketId);
      if (!pc) {
        pc = createPeerConnection(senderSocketId);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', {
              targetSocketId: senderSocketId,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
  };
}
