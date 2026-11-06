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

const COLOR_CLASSES: Record<PlayerColor, string> = {
  RED: 'bg-red-500 hover:bg-red-600 shadow-red-500/50',
  GREEN: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/50',
  YELLOW: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/50',
  BLUE: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/50',
};

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

    // Roll cycle animation: rapid changes for 400ms
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
  const activeColorBtn = COLOR_CLASSES[playerColor] || COLOR_CLASSES.RED;

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-lg select-none">
      {/* 3D Die Container */}
      <div
        onClick={handleRollClick}
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-300 p-2 shadow-2xl transition-all duration-300 transform ${
          canRoll && !disabled
            ? 'cursor-pointer hover:scale-105 ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 animate-pulse-fast'
            : 'opacity-85'
        } ${isRolling ? 'rotate-180 scale-95 transition-transform duration-300' : ''}`}
        style={{
          boxShadow: canRoll
            ? '0 0 25px rgba(251, 191, 36, 0.6), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -3px 6px rgba(0,0,0,0.2)'
            : 'inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -3px 6px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.4)',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {pips.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={10}
              fill="#0f172a"
              style={{
                filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))',
              }}
            />
          ))}
        </svg>
      </div>

      {/* Action Button & Instructions */}
      <div className="flex flex-col items-center gap-1">
        {canRoll ? (
          <button
            onClick={handleRollClick}
            disabled={disabled || isRolling}
            className={`px-5 py-2 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${activeColorBtn}`}
          >
            {isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
        ) : (
          <div className="text-xs sm:text-sm font-medium text-slate-400 text-center min-h-[32px] flex items-center">
            {isMyTurn
              ? 'Select an active token to move'
              : 'Waiting for opponent...'}
          </div>
        )}
      </div>
    </div>
  );
};
