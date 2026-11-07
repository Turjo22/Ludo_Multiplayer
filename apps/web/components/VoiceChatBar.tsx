'use client';

import React from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, PlayerColor } from '@ludo/shared-types';
import { useWebRTCVoice } from '../hooks/useWebRTCVoice';

interface VoiceChatBarProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  sessionId?: string;
  myColor?: PlayerColor;
  myName?: string;
}

const COLOR_BADGES: Record<PlayerColor, { bg: string; border: string; text: string }> = {
  RED: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
  BLUE: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  YELLOW: { bg: 'bg-amber-500/20', border: 'border-amber-400', text: 'text-amber-400' },
  GREEN: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
};

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({
  socket,
  sessionId,
  myColor = 'RED',
  myName = 'You',
}) => {
  const {
    inVoice,
    isMuted,
    isSpeaking,
    voicePeers,
    voiceError,
    joinVoice,
    leaveVoice,
    toggleMute,
  } = useWebRTCVoice(socket, sessionId);

  if (!inVoice) {
    return (
      <div className="flex flex-col items-center">
        <button
          onClick={joinVoice}
          className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/50 hover:to-teal-600/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
          title="Join live peer-to-peer audio voice chat with other players"
        >
          <span className="text-base group-hover:scale-110 transition-transform">🎙️</span>
          <span>Join Voice Chat</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {voiceError && (
          <p className="mt-1 text-[11px] text-rose-400 font-medium">
            ⚠️ {voiceError}
          </p>
        )}
      </div>
    );
  }

  const myStyles = COLOR_BADGES[myColor];

  return (
    <div className="w-full max-w-xl mx-auto flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-xl">
      {/* Left: Live indicator + user mic toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Voice Live ({voicePeers.length + 1})</span>
        </div>

        {/* Local user speaking & mute toggle */}
        <button
          onClick={toggleMute}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
            isMuted
              ? 'bg-rose-950/70 border border-rose-600/50 text-rose-300 hover:bg-rose-900/60'
              : isSpeaking
              ? 'bg-emerald-900/80 border-2 border-emerald-400 text-white shadow-lg shadow-emerald-500/40 scale-105'
              : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200'
          }`}
          title={isMuted ? 'Click to unmute microphone' : 'Click to mute microphone'}
        >
          <span>{isMuted ? '🔇' : '🎙️'}</span>
          <span>{isMuted ? 'Muted' : isSpeaking ? 'Speaking...' : 'Mic On'}</span>
        </button>
      </div>

      {/* Middle: Connected Voice Peers */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        {/* Self avatar badge */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${myStyles.bg} ${myStyles.border} ${myStyles.text}`}
          title={`${myName} (You)`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span className="max-w-[60px] truncate font-bold">You</span>
        </div>

        {voicePeers.map((peer) => {
          const peerStyles = COLOR_BADGES[peer.color] || COLOR_BADGES.RED;
          return (
            <div
              key={peer.socketId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all ${peerStyles.bg} ${peerStyles.border} ${peerStyles.text} ${
                peer.isSpeaking ? 'ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30 scale-105' : ''
              }`}
              title={`${peer.color} player ${peer.isMuted ? '(Muted)' : ''}`}
            >
              <span>{peer.isMuted ? '🔇' : peer.isSpeaking ? '🔊' : '🎙️'}</span>
              <span className="capitalize text-[10px]">{peer.color.toLowerCase()}</span>
            </div>
          );
        })}
      </div>

      {/* Right: Leave Voice Button */}
      <button
        onClick={leaveVoice}
        className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 hover:border-rose-800 transition-colors text-xs font-semibold"
        title="Leave voice chat"
      >
        ✕ Leave
      </button>
    </div>
  );
};
