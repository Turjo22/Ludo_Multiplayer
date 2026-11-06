'use client';

import React, { useState } from 'react';
import type { GameState, PublicPlayer, PrivatePlayerCredentials } from '@ludo/shared-types';

interface LobbyViewProps {
  gameState: GameState;
  currentPlayer: PublicPlayer | null;
  credentials: PrivatePlayerCredentials | null;
  onLeave: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  gameState,
  currentPlayer,
  credentials,
  onLeave,
}) => {
  const [copiedSession, setCopiedSession] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  const handleCopySession = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(gameState.sessionId);
      setCopiedSession(true);
      setTimeout(() => setCopiedSession(false), 2000);
    }
  };

  const handleCopyRecovery = () => {
    if (typeof navigator !== 'undefined' && credentials?.recoveryCode) {
      navigator.clipboard.writeText(credentials.recoveryCode);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
    }
  };

  const requiredCount = gameState.mode === '2P' ? 2 : 4;
  const joinedPlayers = gameState.colorOrder
    .map((c) => gameState.players[c])
    .filter(Boolean) as PublicPlayer[];

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-6 p-4 sm:p-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
      {/* Lobby Header */}
      <div className="text-center space-y-1">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {gameState.mode} Game Lobby
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Waiting for Players
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Share the unique Session ID below with your friends to start playing.
        </p>
      </div>

      {/* Prominent Session ID Card */}
      <div className="w-full bg-slate-950/80 border-2 border-amber-500/40 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-lg shadow-amber-500/5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Game Session ID
        </span>
        <div className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-widest select-all">
          {gameState.sessionId}
        </div>
        <button
          onClick={handleCopySession}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all active:scale-95 shadow-md shadow-amber-500/20"
        >
          {copiedSession ? (
            <>
              <span>✓</span>
              <span>Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy Session ID</span>
            </>
          )}
        </button>
      </div>

      {/* Player Slots */}
      <div className="w-full space-y-2.5">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-400 px-1">
          <span>
            Players Joined ({joinedPlayers.length}/{requiredCount})
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Lobby Live
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gameState.colorOrder.map((color, index) => {
            const player = gameState.players[color];
            const isMe = player?.id === currentPlayer?.id;

            return (
              <div
                key={color}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  player
                    ? 'bg-slate-800/80 border-slate-700 shadow-sm'
                    : 'bg-slate-950/40 border-dashed border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                      player
                        ? color === 'RED'
                          ? 'bg-red-500 text-white'
                          : color === 'GREEN'
                          ? 'bg-emerald-500 text-white'
                          : color === 'YELLOW'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-blue-500 text-white'
                        : 'border border-slate-700 text-slate-600'
                    }`}
                  >
                    {player ? player.name[0]?.toUpperCase() : index + 1}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200 text-sm">
                        {player ? player.name : `Waiting for player...`}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-700 rounded text-slate-300 font-semibold">
                          You
                        </span>
                      )}
                      {player?.isHost && (
                        <span className="text-xs" title="Session Host">
                          👑
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{color} Team</span>
                  </div>
                </div>

                {player ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Ready
                  </span>
                ) : (
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin mr-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Private Recovery Code Panel */}
      {credentials && (
        <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>🔐</span>
              <span>Your Private Recovery Code</span>
            </span>
            <button
              onClick={handleCopyRecovery}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              {copiedRecovery ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <div className="font-mono text-sm text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 select-all flex items-center justify-between">
            <span>{credentials.recoveryCode}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Keep this code private. If your browser closes or device switches, enter this code to restore your player identity.
          </p>
        </div>
      )}

      {/* Cancel / Leave Button */}
      <button
        onClick={onLeave}
        className="text-xs text-slate-400 hover:text-rose-400 transition-colors py-1"
      >
        Leave Lobby
      </button>
    </div>
  );
};
