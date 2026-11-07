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
      <div className="flex items-center">
        <button
          onClick={joinVoice}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all active:scale-95 shrink-0"
          title="Join live audio voice chat"
        >
          <span className="text-xs">🎙️</span>
          <span>Voice</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {voiceError && (
          <span className="ml-1 text-[10px] text-rose-400 truncate max-w-[80px]" title={voiceError}>
            ⚠️ Error
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-xs shrink-0">
      {/* Live Badge */}
      <div className="flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>Live ({voicePeers.length + 1})</span>
      </div>

      {/* Mic Mute Toggle */}
      <button
        onClick={toggleMute}
        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
          isMuted
            ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
            : isSpeaking
            ? 'bg-emerald-900 text-white border border-emerald-400 animate-pulse'
            : 'bg-slate-800 text-slate-200'
        }`}
        title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
      >
        {isMuted ? '🔇 Muted' : isSpeaking ? '🔊 Speaking' : '🎙️ Mic On'}
      </button>

      {/* Leave Voice */}
      <button
        onClick={leaveVoice}
        className="text-[10px] text-slate-400 hover:text-rose-400 font-bold px-1"
        title="Leave voice chat"
      >
        ✕
      </button>
    </div>
  );
};
