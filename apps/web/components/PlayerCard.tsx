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
        className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-500 text-[11px]"
      >
        <div className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center font-bold text-[10px] opacity-40">
          ?
        </div>
        <span className="truncate">Open ({config.name})</span>
      </div>
    );
  }

  const isConnected = player.presence === 'CONNECTED';

  return (
    <div
      className={`relative flex items-center justify-between p-1.5 sm:p-2.5 rounded-xl border transition-all duration-200 ${
        config.bg
      } ${
        isCurrentTurn
          ? `ring-2 ring-amber-400 ${config.border} shadow-md shadow-amber-500/20 bg-slate-900/80`
          : `${config.border} opacity-90`
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Color Avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-extrabold text-[11px] sm:text-xs shadow-md ${config.badge}`}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </div>
          {/* Presence Indicator */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-slate-950 ${
              isConnected ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Name and labels */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 truncate leading-tight">
            <span className="font-bold text-slate-100 text-[11px] sm:text-xs truncate max-w-[65px] sm:max-w-[90px]">
              {player.name}
            </span>
            {isMe && (
              <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-amber-300">
                You
              </span>
            )}
            {player.isHost && (
              <span className="text-[10px] text-amber-400" title="Host">
                👑
              </span>
            )}
          </div>
          <span className={`text-[10px] font-medium ${config.text} leading-none`}>
            {config.name}
          </span>
        </div>
      </div>

      {/* Completed tokens / Home score */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        <span className="text-xs">🏆</span>
        <span className="text-[11px] font-black text-amber-300">
          {player.completedTokensCount}/4
        </span>
      </div>
    </div>
  );
};
