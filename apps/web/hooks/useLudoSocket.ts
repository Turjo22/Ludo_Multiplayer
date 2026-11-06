'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  PublicPlayer,
  PrivatePlayerCredentials,
  GameMode,
  TokenId,
  DiceRollResult,
} from '@ludo/shared-types';

export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export function useLudoSocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PublicPlayer | null>(null);
  const [credentials, setCredentials] = useState<PrivatePlayerCredentials | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [lastDiceResult, setLastDiceResult] = useState<DiceRollResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getSavedCredentials = useCallback((): {
    sessionId: string;
    playerId: string;
    reconnectToken: string;
    recoveryCode: string;
  } | null => {
    if (typeof window === 'undefined') return null;
    const sessionId = localStorage.getItem('ludo_session_id');
    const playerId = localStorage.getItem('ludo_player_id');
    const reconnectToken = localStorage.getItem('ludo_reconnect_token');
    const recoveryCode = localStorage.getItem('ludo_recovery_code');
    if (sessionId && playerId && reconnectToken) {
      return { sessionId, playerId, reconnectToken, recoveryCode: recoveryCode || '' };
    }
    return null;
  }, []);

  const saveCredentials = useCallback(
    (sessionId: string, creds: PrivatePlayerCredentials) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('ludo_session_id', sessionId);
      localStorage.setItem('ludo_player_id', creds.playerId);
      localStorage.setItem('ludo_reconnect_token', creds.reconnectToken);
      localStorage.setItem('ludo_recovery_code', creds.recoveryCode);
    },
    []
  );

  const clearSavedCredentials = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('ludo_session_id');
    localStorage.removeItem('ludo_player_id');
    localStorage.removeItem('ludo_reconnect_token');
    localStorage.removeItem('ludo_recovery_code');
  }, []);

  useEffect(() => {
    const serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : 'http://localhost:4000');

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setErrorMessage(null);

      // Measure initial latency
      const start = Date.now();
      socket.emit('ping:heartbeat', { clientTime: start }, (res) => {
        setLatencyMs(Math.max(1, Date.now() - res.clientTime));
      });
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setStatus('reconnecting');
    });

    // Periodic heartbeat to track round-trip latency
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping:heartbeat', { clientTime: start }, (res) => {
          setLatencyMs(Math.max(1, Date.now() - res.clientTime));
        });
      }
    }, 15000);

    // Socket server event listeners
    socket.on('session:state', (state) => {
      setGameState(state);
      // Keep currentPlayer synced
      setCurrentPlayer((prev) => {
        if (!prev) return prev;
        const updated = state.players[prev.color];
        return updated || prev;
      });
    });

    socket.on('dice:result', (result) => {
      setLastDiceResult(result);
    });

    socket.on('error:notification', (err) => {
      setErrorMessage(err.message);
    });

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, []);

  const createGame = useCallback(
    async (mode: GameMode, playerName?: string) => {
      const socket = socketRef.current;
      if (!socket) throw new Error('Socket not connected');

      setErrorMessage(null);
      return new Promise<void>((resolve, reject) => {
        socket.emit('session:create', { mode, playerName }, (response) => {
          if (response.success) {
            setGameState(response.data.gameState);
            setCurrentPlayer(response.data.player);
            setCredentials(response.data.credentials);
            saveCredentials(response.data.sessionId, response.data.credentials);
            resolve();
          } else {
            setErrorMessage(response.error.message);
            reject(new Error(response.error.message));
          }
        });
      });
    },
    [saveCredentials]
  );

  const joinGame = useCallback(
    async (sessionId: string, playerName?: string) => {
      const socket = socketRef.current;
      if (!socket) throw new Error('Socket not connected');

      setErrorMessage(null);
      return new Promise<void>((resolve, reject) => {
        socket.emit(
          'session:join',
          { sessionId: sessionId.trim().toUpperCase(), playerName },
          (response) => {
            if (response.success) {
              setGameState(response.data.gameState);
              setCurrentPlayer(response.data.player);
              setCredentials(response.data.credentials);
              saveCredentials(response.data.sessionId, response.data.credentials);
              resolve();
            } else {
              setErrorMessage(response.error.message);
              reject(new Error(response.error.message));
            }
          }
        );
      });
    },
    [saveCredentials]
  );

  const reconnectGame = useCallback(
    async (sessionId: string, playerId: string, reconnectToken: string) => {
      const socket = socketRef.current;
      if (!socket) throw new Error('Socket not connected');

      setErrorMessage(null);
      return new Promise<void>((resolve, reject) => {
        socket.emit(
          'session:reconnect',
          { sessionId: sessionId.trim().toUpperCase(), playerId, reconnectToken },
          (response) => {
            if (response.success) {
              setGameState(response.data.gameState);
              setCurrentPlayer(response.data.player);
              setCredentials(response.data.credentials);
              saveCredentials(response.data.sessionId, response.data.credentials);
              resolve();
            } else {
              setErrorMessage(response.error.message);
              reject(new Error(response.error.message));
            }
          }
        );
      });
    },
    [saveCredentials]
  );

  const recoverGame = useCallback(
    async (sessionId: string, recoveryCode: string, newPlayerName?: string) => {
      const socket = socketRef.current;
      if (!socket) throw new Error('Socket not connected');

      setErrorMessage(null);
      return new Promise<void>((resolve, reject) => {
        socket.emit(
          'session:recover',
          { sessionId: sessionId.trim().toUpperCase(), recoveryCode, newPlayerName },
          (response) => {
            if (response.success) {
              setGameState(response.data.gameState);
              setCurrentPlayer(response.data.player);
              setCredentials(response.data.credentials);
              saveCredentials(response.data.sessionId, response.data.credentials);
              resolve();
            } else {
              setErrorMessage(response.error.message);
              reject(new Error(response.error.message));
            }
          }
        );
      });
    },
    [saveCredentials]
  );

  const rollDice = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    const actionId = `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<void>((resolve, reject) => {
      socket.emit('dice:roll', { actionId }, (response) => {
        if (response.success) {
          resolve();
        } else {
          setErrorMessage(response.error.message);
          reject(new Error(response.error.message));
        }
      });
    });
  }, []);

  const moveToken = useCallback(async (tokenId: TokenId) => {
    const socket = socketRef.current;
    if (!socket) return;
    const actionId = `move-${tokenId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<void>((resolve, reject) => {
      socket.emit('token:move', { tokenId, actionId }, (response) => {
        if (response.success) {
          resolve();
        } else {
          setErrorMessage(response.error.message);
          reject(new Error(response.error.message));
        }
      });
    });
  }, []);

  const leaveGame = useCallback(() => {
    clearSavedCredentials();
    setGameState(null);
    setCurrentPlayer(null);
    setCredentials(null);
  }, [clearSavedCredentials]);

  return {
    socketStatus: status,
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
  };
}
