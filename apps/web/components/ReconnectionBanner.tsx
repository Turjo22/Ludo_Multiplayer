'use client';

import React, { useEffect, useState } from 'react';
import type { GameState } from '@ludo/shared-types';
import type { SocketStatus } from '../hooks/useLudoSocket';

interface ReconnectionBannerProps {
  socketStatus: SocketStatus;
  gameState: GameState | null;
  onManualReconnect?: () => void;
}

export const ReconnectionBanner: React.FC<ReconnectionBannerProps> = ({
  socketStatus,
  gameState,
  onManualReconnect,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState?.disconnectGraceExpiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((gameState.disconnectGraceExpiresAt! - now) / 1000));
      setSecondsRemaining(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [gameState?.disconnectGraceExpiresAt]);

  // Socket offline / reconnecting overlay
  if (socketStatus === 'reconnecting' || socketStatus === 'disconnected') {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-rose-950/95 border-2 border-rose-500/60 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-rose-300 border-t-white rounded-full animate-spin shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-xs sm:text-sm">Connection Interrupted</span>
            <span className="text-[11px] text-rose-200">
              Re-establishing real-time multiplayer connection...
            </span>
          </div>
        </div>
        {onManualReconnect && (
          <button
            onClick={onManualReconnect}
            className="px-3 py-1 bg-white text-rose-950 font-bold text-xs rounded-xl shadow shrink-0 active:scale-95"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Game paused state
  if (gameState?.status === 'PAUSED') {
    const minutes = secondsRemaining !== null ? Math.floor(secondsRemaining / 60) : null;
    const seconds = secondsRemaining !== null ? secondsRemaining % 60 : null;

    return (
      <div className="w-full max-w-2xl mx-auto mb-3 bg-amber-950/90 border-2 border-amber-500/50 text-amber-100 p-3.5 rounded-2xl shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <span className="text-2xl animate-bounce">⏸️</span>
          <div>
            <h4 className="font-bold text-sm text-white">Match Paused</h4>
            <p className="text-xs text-amber-200/90">
              {gameState.pauseReason || 'A player disconnected. Slots are reserved for reconnection.'}
            </p>
          </div>
        </div>

        {secondsRemaining !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-amber-500/30 text-amber-300 font-mono text-xs shrink-0">
            <span>⏳ Expiration:</span>
            <span className="font-bold">
              {minutes}:{seconds! < 10 ? `0${seconds}` : seconds}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
};
