'use client';

import React, { useState, useEffect } from 'react';
import { useLudoSocket } from '../hooks/useLudoSocket';
import { useSound } from '../hooks/useSound';
import { HomeView } from '../components/HomeView';
import { LobbyView } from '../components/LobbyView';
import { LudoBoard } from '../components/LudoBoard';
import { DiceWidget } from '../components/DiceWidget';
import { PlayerCard } from '../components/PlayerCard';
import { VoiceChatBar } from '../components/VoiceChatBar';
import { EmojiReactions } from '../components/EmojiReactions';
import { ReconnectionBanner } from '../components/ReconnectionBanner';
import { WinnerModal } from '../components/WinnerModal';
import type { TokenId, PlayerColor } from '@ludo/shared-types';

export default function LudoApp() {
  const {
    socket,
    socketStatus,
    gameState,
    currentPlayer,
    credentials,
    latencyMs,
    lastDiceResult,
    errorMessage,
    emojiEvents,
    sendEmoji,
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
      <main className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 bg-radial-gradient">
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
      <main className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 bg-radial-gradient">
        <LobbyView
          gameState={gameState}
          currentPlayer={currentPlayer}
          credentials={credentials}
          onLeave={leaveGame}
        />
      </main>
    );
  }

  // 3. Active / Paused / Ended Game Screen (Fixed 100dvh viewport, 0 scrolling)
  const isMyTurn = currentPlayer?.color === gameState.currentTurnColor;
  const canRoll = isMyTurn && !gameState.diceRolledThisTurn && gameState.status === 'ACTIVE';

  return (
    <main className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between text-slate-100 select-none pb-safe">
      {/* Top Navigation Bar: Single-row, zero horizontal overflow */}
      <header className="w-full h-10 sm:h-12 bg-slate-900/95 backdrop-blur-xl border-b border-amber-500/20 px-2 sm:px-4 py-1 flex items-center justify-between shrink-0 shadow-lg z-40">
        {/* Brand & Session ID */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <span className="font-black text-xs sm:text-sm tracking-tight text-white flex items-center gap-1">
            <span className="text-amber-400">🎲</span> Ludo
          </span>
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-amber-500/30 text-[11px]">
            <span className="text-slate-400 hidden xs:inline">ID:</span>
            <span className="font-mono font-bold text-amber-300 tracking-wider">
              {gameState.sessionId}
            </span>
          </div>
        </div>

        {/* Controls: Sound, Fullscreen, and Prominent Leave Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Latency badge (Desktop only) */}
          <div
            className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800"
            title="Connection Latency"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                latencyMs < 100 ? 'bg-emerald-400' : latencyMs < 250 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <span>{latencyMs}ms</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
            title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {/* Fullscreen Toggle (hidden on mobile) */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:block p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? '↙' : '⛶'}
          </button>

          {/* Prominent Leave Game Button (Always fully visible, shrink-0) */}
          <button
            onClick={leaveGame}
            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-black text-xs border border-rose-400/50 shadow-md shadow-rose-950/50 transition-all active:scale-95 flex items-center gap-1 shrink-0"
            title="Exit and leave this match"
          >
            <span>🚪</span>
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Single-Page Gameplay Layout: Auto-fitted, Zero Scrolling */}
      <div className="flex-1 min-h-0 w-full max-w-md lg:max-w-xl mx-auto px-2 py-1 flex flex-col justify-between items-center overflow-hidden">
        {/* Reconnection Banner (if disconnected) */}
        <ReconnectionBanner socketStatus={socketStatus} gameState={gameState} />

        {/* Top Status Header: Turn Alert & Voice Chat */}
        <div className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-amber-500/20 shadow-md shrink-0 mb-1">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                gameState.currentTurnColor === 'RED'
                  ? 'bg-red-500'
                  : gameState.currentTurnColor === 'BLUE'
                  ? 'bg-blue-500'
                  : gameState.currentTurnColor === 'YELLOW'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              } animate-ping`}
            />
            <span className="text-xs sm:text-sm font-black text-amber-300 tracking-tight truncate">
              {isMyTurn
                ? '⭐ YOUR TURN!'
                : `Turn: ${gameState.players[gameState.currentTurnColor]?.name || gameState.currentTurnColor}`}
            </span>
          </div>

          {/* Voice Chat Component */}
          <VoiceChatBar
            socket={socket}
            sessionId={gameState.sessionId}
            myColor={currentPlayer?.color}
            myName={currentPlayer?.name}
          />
        </div>

        {/* Compact Player Strip: Fits 2 or 4 players cleanly across */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0 mb-1">
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

        {/* Center: Scalable Ludo Board (Constrained dynamically to fit viewport) */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center py-0.5 shrink-0">
          <LudoBoard
            gameState={gameState}
            myColor={currentPlayer?.color}
            onTokenClick={handleTokenSelect}
            disabled={!isMyTurn || !gameState.diceRolledThisTurn || gameState.status !== 'ACTIVE'}
          />
        </div>

        {/* Bottom Controls Dock: Dice Widget & Emoji Reactions Palette */}
        <div className="w-full shrink-0 flex flex-col items-center gap-1 pb-1 mt-0.5">
          <DiceWidget
            currentValue={gameState.currentDiceValue}
            isMyTurn={isMyTurn}
            canRoll={canRoll}
            playerColor={currentPlayer?.color}
            onRoll={handleRollDice}
            disabled={gameState.status !== 'ACTIVE'}
          />

          <EmojiReactions onSendEmoji={sendEmoji} recentEmojis={emojiEvents} />
        </div>
      </div>

      {/* Winner Modal */}
      {gameState.status === 'ENDED' && (
        <WinnerModal gameState={gameState} onPlayAgain={leaveGame} />
      )}
    </main>
  );
}
