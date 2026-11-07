'use client';

import React, { useState, useEffect } from 'react';
import type { GameMode } from '@ludo/shared-types';

interface HomeViewProps {
  onCreateGame: (mode: GameMode, playerName?: string) => Promise<void>;
  onJoinGame: (sessionId: string, playerName?: string) => Promise<void>;
  onRecoverGame: (sessionId: string, recoveryCode: string, playerName?: string) => Promise<void>;
  initialSessionId?: string;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onCreateGame,
  onJoinGame,
  onRecoverGame,
  initialSessionId = '',
  errorMessage,
  onClearError,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('ludo_player_name');
      if (savedName) setPlayerName(savedName);
    }
  }, []);

  const handleNameChange = (val: string) => {
    setPlayerName(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_player_name', val);
    }
  };

  const handleCreate = async (mode: GameMode) => {
    try {
      setLoading(true);
      if (onClearError) onClearError();
      await onCreateGame(mode, playerName.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.trim()) return;
    try {
      setLoading(true);
      if (onClearError) onClearError();
      await onJoinGame(sessionId.trim().toUpperCase(), playerName.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.trim() || !recoveryCode.trim()) return;
    try {
      setLoading(true);
      if (onClearError) onClearError();
      await onRecoverGame(sessionId.trim().toUpperCase(), recoveryCode.trim(), playerName.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 p-4 sm:p-7 bg-slate-900/90 backdrop-blur-2xl border-2 border-amber-500/30 rounded-3xl shadow-2xl shadow-indigo-950/60 text-slate-100">
      {/* Brand & Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-red-500/30 via-amber-500/30 to-blue-500/30 border border-amber-500/40 shadow-inner">
          <svg width="48" height="48" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="20" fill="#0f172a" stroke="#d97706" strokeWidth="3" />
            <rect x="10" y="10" width="36" height="36" rx="8" fill="#e11d48" />
            <rect x="54" y="10" width="36" height="36" rx="8" fill="#0284c7" />
            <rect x="10" y="54" width="36" height="36" rx="8" fill="#16a34a" />
            <rect x="54" y="54" width="36" height="36" rx="8" fill="#eab308" />
            <circle cx="50" cy="50" r="10" fill="#ffffff" stroke="#fbbf24" strokeWidth="2" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 filter drop-shadow">
          Real-Time Ludo
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
          Play classic multiplayer Ludo globally with live voice chat & reactions. No signup required!
        </p>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <span className="font-medium">{errorMessage}</span>
          {onClearError && (
            <button onClick={onClearError} className="font-bold ml-2 text-rose-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Player Name Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-amber-300/90 block uppercase tracking-wider">
          Your Nickname (Optional)
        </label>
        <div className="relative">
          <input
            type="text"
            value={playerName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. MasterDice, Alex"
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 text-white placeholder-slate-500 text-sm outline-none transition-all shadow-inner"
          />
          <span className="absolute right-3.5 top-3 text-slate-500 text-sm pointer-events-none">
            👤
          </span>
        </div>
      </div>

      {/* Create Game Section */}
      <div className="space-y-3 pt-3 border-t border-slate-800/80">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
          Create New Game
        </span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleCreate('2P')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-red-600/20 via-amber-600/10 to-yellow-600/20 border-2 border-amber-500/50 hover:border-amber-400 hover:bg-amber-500/25 active:scale-95 transition-all text-white group shadow-md"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">👥</span>
            <span className="font-black text-sm">2-Player Game</span>
            <span className="text-[11px] text-amber-200/80">Red vs Yellow</span>
          </button>

          <button
            onClick={() => handleCreate('4P')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 via-emerald-600/10 to-amber-600/20 border-2 border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/25 active:scale-95 transition-all text-white group shadow-md"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">👨‍👩‍👧‍👦</span>
            <span className="font-black text-sm">4-Player Game</span>
            <span className="text-[11px] text-blue-200/80">All 4 Colors</span>
          </button>
        </div>
      </div>

      {/* Join Game Section: Fully responsive on mobile, tablet & desktop */}
      <form onSubmit={handleJoin} className="space-y-3 pt-3 border-t border-slate-800/80">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
          Join with Session ID
        </span>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase().trim())}
            placeholder="e.g. LUDO7A"
            maxLength={8}
            className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 text-white font-mono tracking-widest text-center text-base sm:text-lg font-bold uppercase outline-none transition-all placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !sessionId.trim()}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>🎲</span>
            <span>{loading ? 'Joining...' : 'Join Game'}</span>
          </button>
        </div>
      </form>

      {/* Recovery Code Accordion */}
      <div className="pt-2 border-t border-slate-800/80 text-center">
        <button
          type="button"
          onClick={() => setShowRecovery(!showRecovery)}
          className="text-xs text-slate-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
        >
          <span>{showRecovery ? '▲ Hide Recovery' : '▼ Restore identity using Recovery Code'}</span>
        </button>

        {showRecovery && (
          <form onSubmit={handleRecover} className="mt-3 space-y-2.5 text-left bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
            <span className="text-[11px] text-slate-300 block">
              Enter your Session ID and private Recovery Code to resume your game on this device:
            </span>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase().trim())}
              placeholder="Session ID"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
            />
            <input
              type="text"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.trim())}
              placeholder="Recovery Code (e.g. RC-1234-5678)"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
            />
            <button
              type="submit"
              disabled={loading || !sessionId.trim() || !recoveryCode.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md"
            >
              Restore Player Identity
            </button>
          </form>
        )}
      </div>

      {/* Rules Modal / Collapse */}
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => setShowRules(!showRules)}
          className="text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          {showRules ? 'Hide Classic Ludo Rules' : '📖 How to Play Classic Ludo'}
        </button>

        {showRules && (
          <div className="mt-3 text-left text-xs text-slate-300 bg-slate-950/90 p-4 rounded-2xl border border-amber-500/20 space-y-2 leading-relaxed shadow-lg">
            <h4 className="font-black text-amber-300">Classic Rules Quick Summary:</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              <li>Roll a <strong>6</strong> to bring a token out of your starting yard.</li>
              <li>Tokens advance clockwise around the 52-square track according to your dice roll.</li>
              <li><strong>Safe Squares</strong>: The 4 colored start squares and 4 star squares protect tokens from capture.</li>
              <li><strong>Capturing</strong>: Landing on an opponent&apos;s token on a non-safe square captures it back to their yard and grants you a <strong>bonus roll</strong>!</li>
              <li>Rolling a <strong>6</strong> grants a bonus roll. Rolling three 6s in a row forfeits the turn.</li>
              <li>An <strong>exact roll</strong> is required to reach the final home destination.</li>
              <li>First player to bring all 4 tokens to the home center wins!</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
