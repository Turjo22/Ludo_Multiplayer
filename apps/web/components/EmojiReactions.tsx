'use client';

import React, { useState, useEffect } from 'react';
import type { PlayerColor } from '@ludo/shared-types';
import type { EmojiEvent } from '../hooks/useLudoSocket';

interface EmojiReactionsProps {
  onSendEmoji: (emoji: string) => void;
  recentEmojis: EmojiEvent[];
}

interface FloatingEmojiItem extends EmojiEvent {
  floatingId: string;
  randomOffset: number;
}

const EMOJI_PALETTE = ['😂', '🔥', '😎', '😭', '😡', '🎲', '👏', '🏆', '🥳', '🤯'];

const COLOR_TEXT: Record<string, string> = {
  RED: 'text-red-400 border-red-500/40 bg-red-950/80',
  BLUE: 'text-blue-400 border-blue-500/40 bg-blue-950/80',
  YELLOW: 'text-amber-400 border-amber-500/40 bg-amber-950/80',
  GREEN: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/80',
};

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  onSendEmoji,
  recentEmojis,
}) => {
  const [activeBubbles, setActiveBubbles] = useState<FloatingEmojiItem[]>([]);
  const [lastHandledId, setLastHandledId] = useState<string>('');

  // Spawn new floating bubbles whenever recentEmojis updates
  useEffect(() => {
    if (!recentEmojis || recentEmojis.length === 0) return;
    const latest = recentEmojis[recentEmojis.length - 1];
    if (!latest || latest.id === lastHandledId) return;

    setLastHandledId(latest.id);

    const newItem: FloatingEmojiItem = {
      ...latest,
      floatingId: `${latest.id}-${Math.random().toString(36).slice(2, 6)}`,
      randomOffset: (Math.random() - 0.5) * 60, // random slight horizontal drift
    };

    setActiveBubbles((prev) => [...prev.slice(-8), newItem]);

    // Auto-remove after 2.8 seconds
    const timer = setTimeout(() => {
      setActiveBubbles((prev) => prev.filter((b) => b.floatingId !== newItem.floatingId));
    }, 2800);

    return () => clearTimeout(timer);
  }, [recentEmojis, lastHandledId]);

  return (
    <>
      {/* Floating Animated Emojis Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {activeBubbles.map((item) => {
          const colorClass = COLOR_TEXT[item.color] || COLOR_TEXT.RED;
          return (
            <div
              key={item.floatingId}
              className="absolute flex flex-col items-center animate-emoji-float pointer-events-none"
              style={{
                left: `calc(50% + ${item.randomOffset}px)`,
                bottom: '25%',
              }}
            >
              <div
                className={`px-3 py-1.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-1.5 ${colorClass}`}
              >
                <span className="text-3xl filter drop-shadow-md">{item.emoji}</span>
                <span className="text-xs font-bold tracking-tight">{item.playerName}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Emoji Selection Bar */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-xl overflow-x-auto">
        <span className="text-xs font-bold text-slate-400 hidden sm:inline-block mr-1">
          React:
        </span>
        {EMOJI_PALETTE.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendEmoji(emoji)}
            className="p-1.5 sm:p-2 text-xl sm:text-2xl rounded-xl hover:bg-slate-800 active:scale-125 hover:scale-110 transition-all select-none focus:outline-none"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
