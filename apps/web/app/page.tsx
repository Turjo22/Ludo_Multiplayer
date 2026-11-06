'use client';

import React, { useState, useEffect } from 'react';
import { useLudoSocket } from '../hooks/useLudoSocket';
import { useSound } from '../hooks/useSound';
import { HomeView } from '../components/HomeView';
import { LobbyView } from '../components/LobbyView';
import { LudoBoard } from '../components/LudoBoard';
import { DiceWidget } from '../components/DiceWidget';
import { PlayerCard } from '../components/PlayerCard';
import { ActivityLog } from '../components/ActivityLog';
import { ReconnectionBanner } from '../components/ReconnectionBanner';
import { WinnerModal } from '../components/WinnerModal';
import type { TokenId, PlayerColor } from '@ludo/shared-types';

export default function LudoApp() {
  const {
    socketStatus,
    gameState,
    currentPlayer,
    credentials,
    latencyMs,
    lastDiceResult,
    errorMessage,
    createGame,
    joinGame,
    reconnectGame,
    recoverGame,
    rollDice,
    moveToken,
    leaveGame,
    getSavedCredentials,
    setErrorMessage,
  } = useLudoSocket();

  const {
    soundEnabled,
    setSoundEnabled,
    playDiceRoll,
    playTokenMove,
    playCapture,
    playVictory,
  } = useSound();

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Play sound effects when game events update
  useEffect(() => {
    if (!gameState) return;

    const latestLog = gameState.activityLog[gameState.activityLog.length - 1];
    if (latestLog) {
      if (latestLog.type === 'ROLL') {
        playDiceRoll();
      } else if (latestLog.type === 'CAPTURE') {
        playCapture();
      } else if (latestLog.type === 'MOVE') {
        playTokenMove();
      } else if (latestLog.type === 'WIN') {
        playVictory();
      }
    }
  }, [gameState?.sequenceNumber, playDiceRoll, playCapture, playTokenMove, playVictory]);

  // Attempt auto-reconnect on mount if previous session credentials exist in storage
  useEffect(() => {
    if (socketStatus === 'connected' && !gameState) {
      const saved = getSavedCredentials();
      if (saved) {
        reconnectGame(saved.sessionId, saved.playerId, saved.reconnectToken).catch(() => {
          // If expired or session deleted, silence error and stay on HomeView
        });
      }
    }
  }, [socketStatus, gameState, getSavedCredentials, reconnectGame]);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTokenSelect = async (tokenId: TokenId) => {
    try {
      await moveToken(tokenId);
    } catch {}
  };

  const handleRollDice = async () => {
    try {
      await rollDice();
    } catch {}
  };

  // 1. Home Screen (Not in a game session)
  if (!gameState) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 bg-slate-950">
        <HomeView
          onCreateGame={createGame}
          onJoinGame={joinGame}
          onRecoverGame={recoverGame}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      </main>
    );
  }

  // 2. Waiting Lobby Screen
  if (gameState.status === 'WAITING') {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 bg-slate-950">
        <LobbyView
          gameState={gameState}
          currentPlayer={currentPlayer}
          credentials={credentials}
          onLeave={leaveGame}
        />
      </main>
    );
  }

  // 3. Active / Paused / Ended Game Screen
  const isMyTurn = currentPlayer?.color === gameState.currentTurnColor;
  const canRoll = isMyTurn && !gameState.diceRolledThisTurn && gameState.status === 'ACTIVE';

  return (
    <main className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 select-none pb-safe">
      {/* Top Navigation Bar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40">
        {/* Brand & Session ID */}
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
            <span className="text-amber-400">🎲</span> Ludo
          </span>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400 font-medium">Session:</span>
            <span className="font-mono font-bold text-amber-300 tracking-wider">
              {gameState.sessionId}
            </span>
          </div>
        </div>

        {/* Status, Sound, Fullscreen & Controls */}
        <div className="flex items-center gap-2">
          {/* Latency badge */}
          <div
            className="hidden xs:flex items-center gap-1 text-[11px] text-slate-400 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800"
            title="Connection Latency"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                latencyMs < 100 ? 'bg-emerald-400' : latencyMs < 250 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <span>{latencyMs}ms</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
            title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:block p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? '↙' : '⛶'}
          </button>

          {/* Leave Button */}
          <button
            onClick={leaveGame}
            className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Content Area: Responsive Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6 flex flex-col justify-center">
        {/* Reconnection and Match Paused Banner */}
        <ReconnectionBanner socketStatus={socketStatus} gameState={gameState} />

        {/* Turn Status Alert */}
        <div className="w-full max-w-2xl mx-auto mb-2.5 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                gameState.currentTurnColor === 'RED'
                  ? 'bg-red-500'
                  : gameState.currentTurnColor === 'GREEN'
                  ? 'bg-emerald-500'
                  : gameState.currentTurnColor === 'YELLOW'
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              } animate-ping`}
            />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              {isMyTurn
                ? '⭐ YOUR TURN!'
                : `Turn: ${gameState.players[gameState.currentTurnColor]?.name || gameState.currentTurnColor}`}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            {gameState.diceRolledThisTurn ? 'Token Selection' : 'Awaiting Roll'}
          </span>
        </div>

        {/* Responsive Grid: Desktop 3-column / Tablet 2-column / Mobile 1-column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-center justify-center">
          {/* Left Column (Desktop) or Top Section (Mobile): Player Cards */}
          <div className="lg:col-span-3 order-1 grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5">
            {gameState.colorOrder.map((color) => (
              <PlayerCard
                key={color}
                player={gameState.players[color]}
                color={color}
                isCurrentTurn={gameState.currentTurnColor === color}
                isMe={currentPlayer?.color === color}
              />
            ))}
          </div>

          {/* Center Column: The Scalable Ludo Board */}
          <div className="lg:col-span-6 order-2 flex justify-center items-center py-1 sm:py-2">
            <LudoBoard
              gameState={gameState}
              myColor={currentPlayer?.color}
              onTokenClick={handleTokenSelect}
              disabled={!isMyTurn || !gameState.diceRolledThisTurn || gameState.status !== 'ACTIVE'}
            />
          </div>

          {/* Right Column (Desktop) or Bottom Controls (Mobile): Dice Widget & Activity */}
          <div className="lg:col-span-3 order-3 flex flex-col gap-3">
            <DiceWidget
              currentValue={gameState.currentDiceValue}
              isMyTurn={isMyTurn}
              canRoll={canRoll}
              playerColor={currentPlayer?.color}
              onRoll={handleRollDice}
              disabled={gameState.status !== 'ACTIVE'}
            />

            <ActivityLog entries={gameState.activityLog} />
          </div>
        </div>
      </div>

      {/* Winner Modal */}
      {gameState.status === 'ENDED' && (
        <WinnerModal gameState={gameState} onPlayAgain={leaveGame} />
      )}
    </main>
  );
}
