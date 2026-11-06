'use client';

import React from 'react';
import type { PublicPlayer, PlayerColor } from '@ludo/shared-types';

interface PlayerCardProps {
  player: PublicPlayer | null;
  color: PlayerColor;
  isCurrentTurn: boolean;
  isMe: boolean;
}

const COLOR_CONFIG: Record<
  PlayerColor,
  { name: string; bg: string; border: string; badge: string; text: string }
> = {
  RED: {
    name: 'Red',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    badge: 'bg-red-500 text-white',
    text: 'text-red-400',
  },
  GREEN: {
    name: 'Green',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-400',
  },
  YELLOW: {
    name: 'Yellow',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500 text-slate-900',
    text: 'text-amber-400',
  },
  BLUE: {
    name: 'Blue',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500 text-white',
    text: 'text-blue-400',
  },
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  color,
  isCurrentTurn,
  isMe,
}) => {
  const config = COLOR_CONFIG[color];

  if (!player) {
    return (
      <div
        className={`flex items-center gap-2 p-2 sm:p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-slate-500 text-xs sm:text-sm`}
      >
        <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center font-bold text-xs opacity-40">
          ?
        </div>
        <span>Slot Open ({config.name})</span>
      </div>
    );
  }

  const isConnected = player.presence === 'CONNECTED';

  return (
    <div
      className={`relative flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-300 ${
        config.bg
      } ${
        isCurrentTurn
          ? `ring-2 ring-amber-400 ${config.border} shadow-lg shadow-amber-500/10 scale-[1.02]`
          : `${config.border} opacity-90`
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Color Avatar */}
        <div className="relative">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-sm shadow-md ${config.badge}`}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </div>
          {/* Presence Indicator */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Name and labels */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-slate-100 text-xs sm:text-sm truncate">
              {player.name}
            </span>
            {isMe && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                You
              </span>
            )}
            {player.isHost && (
              <span className="text-[10px] text-amber-400" title="Host">
                👑
              </span>
            )}
          </div>
          <span className={`text-[11px] font-medium ${config.text}`}>
            {config.name} Player
          </span>
        </div>
      </div>

      {/* Completed tokens / Home score */}
      <div className="flex flex-col items-end pl-2">
        <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
          <span>🏆</span>
          <span>{player.completedTokensCount}/4</span>
        </div>
        {isCurrentTurn && (
          <span className="text-[10px] font-extrabold text-amber-400 tracking-wider uppercase animate-pulse">
            Turn
          </span>
        )}
      </div>
    </div>
  );
};
