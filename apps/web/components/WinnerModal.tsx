'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { GameState } from '@ludo/shared-types';

interface WinnerModalProps {
  gameState: GameState;
  onPlayAgain: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({ gameState, onPlayAgain }) => {
  const winnerColor = gameState.winner;
  const winnerPlayer = winnerColor ? gameState.players[winnerColor] : null;

  useEffect(() => {
    // Launch celebratory confetti burst
    if (typeof window !== 'undefined') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      const timeout = setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, []);

  if (gameState.status !== 'ENDED' || !winnerColor) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-lg shadow-amber-500/30 animate-bounce">
          🏆
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-widest font-bold text-amber-400">
            Victory! Game Finished
          </span>
          <h2 className="text-3xl font-black text-white">
            {winnerPlayer?.name || `${winnerColor} Player`} Wins!
          </h2>
          <p className="text-sm text-slate-300">
            Successfully moved all 4 tokens to the home destination!
          </p>
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
        >
          Return to Home / New Game
        </button>
      </div>
    </div>
  );
};
