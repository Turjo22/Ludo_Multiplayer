'use client';

import React, { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, PlayerColor } from '@ludo/shared-types';
import { useWebRTCVoice } from '../hooks/useWebRTCVoice';

interface VoiceChatBarProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  sessionId?: string;
  myColor?: PlayerColor;
  myName?: string;
}

const PEER_COLORS: Record<PlayerColor, { bg: string; text: string; border: string }> = {
  RED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/60' },
  BLUE: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/60' },
  YELLOW: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/60' },
  GREEN: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/60' },
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
    clearError,
  } = useWebRTCVoice(socket, sessionId);

  const [showErrorModal, setShowErrorModal] = useState(false);

  // If user is not yet connected to voice
  if (!inVoice) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={joinVoice}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
          title="Join live voice chat"
        >
          <span className="text-xs">🎙️</span>
          <span>Voice</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {voiceError && (
          <>
            <button
              onClick={() => setShowErrorModal(true)}
              className="text-[10px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-600/50 font-bold animate-pulse hover:bg-amber-900"
              title="Click for mic help"
            >
              ⚠️ Mic Help
            </button>

            {/* Mic Permission Guidance Modal */}
            {showErrorModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-text">
                <div className="w-full max-w-xs bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 shadow-2xl space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                      <span>🎙️</span>
                      <span>Microphone Access</span>
                    </span>
                    <button
                      onClick={() => setShowErrorModal(false)}
                      className="text-slate-400 hover:text-white font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {voiceError}
                  </p>

                  <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <p className="font-semibold text-slate-200">How to allow in mobile browser:</p>
                    <ol className="list-decimal pl-3.5 space-y-0.5">
                      <li>Tap the <strong>lock 🔒 or tune icon</strong> in the address bar.</li>
                      <li>Tap <strong>Permissions → Microphone → Allow</strong>.</li>
                      <li>Reload the page and tap <strong>Voice</strong>.</li>
                    </ol>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowErrorModal(false);
                        clearError();
                        joinVoice();
                      }}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-md"
                    >
                      Retry Microphone
                    </button>
                    <button
                      onClick={() => setShowErrorModal(false)}
                      className="px-3 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Active in Voice room
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/90 border border-emerald-500/40 shadow-md shrink-0">
      {/* Live Badge */}
      <div className="flex items-center gap-1 text-emerald-400 font-black text-[10px] shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>Live ({voicePeers.length + 1})</span>
      </div>

      {/* Local User Mic Toggle */}
      <button
        onClick={toggleMute}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${
          isMuted
            ? 'bg-rose-950/90 text-rose-300 border border-rose-600/60'
            : isSpeaking
            ? 'bg-emerald-900 text-white border-2 border-emerald-400 shadow-md shadow-emerald-500/40 scale-105'
            : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
        }`}
        title={isMuted ? 'Microphone Muted - Tap to Unmute' : 'Microphone Active - Tap to Mute'}
      >
        <span>{isMuted ? '🔇' : isSpeaking ? '🔊' : '🎙️'}</span>
        <span>{isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Mic'}</span>
      </button>

      {/* Remote Peers Speaking Badges */}
      {voicePeers.map((peer) => {
        const styles = PEER_COLORS[peer.color] || PEER_COLORS.RED;
        return (
          <div
            key={peer.socketId}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-bold transition-all ${
              styles.bg
            } ${styles.border} ${styles.text} ${
              peer.isSpeaking ? 'ring-2 ring-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : ''
            }`}
            title={`${peer.color} player ${peer.isMuted ? '(Muted)' : peer.isSpeaking ? '(Speaking)' : ''}`}
          >
            <span>{peer.isMuted ? '🔇' : peer.isSpeaking ? '🔊' : '🎙️'}</span>
            <span className="capitalize">{peer.color.slice(0, 1)}</span>
          </div>
        );
      })}

      {/* Exit Voice */}
      <button
        onClick={leaveVoice}
        className="text-[10px] text-slate-400 hover:text-rose-400 font-bold px-1 transition-colors"
        title="Exit voice chat"
      >
        ✕
      </button>
    </div>
  );
};
