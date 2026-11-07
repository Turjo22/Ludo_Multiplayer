'use client';

import React, { useState, useEffect } from 'react';
import type { PlayerColor } from '@ludo/shared-types';

interface DiceWidgetProps {
  currentValue: number | null;
  isMyTurn: boolean;
  canRoll: boolean;
  playerColor?: PlayerColor;
  onRoll: () => void;
  disabled?: boolean;
}

// SVG Pip Coordinates for 1..6 on a 100x100 square
const PIP_CONFIGS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

export const DiceWidget: React.FC<DiceWidgetProps> = ({
  currentValue,
  isMyTurn,
  canRoll,
  playerColor = 'RED',
  onRoll,
  disabled = false,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number>(currentValue || 6);

  useEffect(() => {
    if (currentValue !== null) {
      setDisplayValue(currentValue);
    }
  }, [currentValue]);

  const handleRollClick = () => {
    if (!canRoll || disabled || isRolling) return;

    setIsRolling(true);

    const interval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      setIsRolling(false);
      onRoll();
    }, 450);
  };

  const pips = PIP_CONFIGS[displayValue] || PIP_CONFIGS[6];

  return (
    <div className="w-full max-w-sm mx-auto flex items-center justify-between gap-3 px-3 py-1.5 sm:py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-xl select-none">
      {/* 3D Interactive Die */}
      <div
        onClick={handleRollClick}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-white via-slate-100 to-slate-200 p-1.5 shadow-xl transition-all duration-300 shrink-0 ${
          canRoll && !disabled
            ? 'cursor-pointer hover:scale-105 ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 animate-pulse'
            : 'opacity-90'
        } ${isRolling ? 'rotate-180 scale-95 transition-transform duration-300' : ''}`}
        style={{
          boxShadow: canRoll
            ? '0 0 20px rgba(251, 191, 36, 0.7), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.2)'
            : 'inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.4)',
        }}
        title={canRoll ? 'Tap to roll dice' : `Last roll: ${displayValue}`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {pips.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={11}
              fill="#0f172a"
              style={{
                filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.6))',
              }}
            />
          ))}
        </svg>
      </div>

      {/* Action / Turn Status Prompt */}
      <div className="flex-1 flex justify-end">
        {canRoll ? (
          <button
            onClick={handleRollClick}
            disabled={disabled || isRolling}
            className="px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🎲</span>
            <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
          </button>
        ) : (
          <div className="text-right">
            <span className="text-xs font-bold text-amber-300 block">
              {isMyTurn ? '👉 Tap glowing token' : '⏳ Opponent Turn'}
            </span>
            <span className="text-[10px] text-slate-400">
              {isMyTurn ? 'Advance your piece' : 'Waiting for roll...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
