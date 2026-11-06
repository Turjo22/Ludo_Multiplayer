import type {
  GameMode,
  GameState,
  PlayerColor,
  PublicPlayer,
  PrivatePlayerCredentials,
  CreateSessionSuccessPayload,
  JoinSessionSuccessPayload,
  ReconnectSessionSuccessPayload,
} from '@ludo/shared-types';
import {
  COLOR_ORDER_2P,
  COLOR_ORDER_4P,
  createInitialTokens,
} from '@ludo/game-rules';
import type { IStorageAdapter } from '../storage/storage-adapter.interface.js';
import {
  generateSessionId,
  generatePlayerId,
  generateReconnectToken,
  generateRecoveryCode,
} from '../security/crypto-utils.js';

export class SessionManager {
  constructor(private storage: IStorageAdapter) {}

  /**
   * Creates a new game session with the creator assigned to slot 0 (RED).
   */
  async createSession(
    mode: GameMode,
    playerName?: string
  ): Promise<CreateSessionSuccessPayload> {
    const sessionId = generateSessionId();
    const playerId = generatePlayerId();
    const reconnectToken = generateReconnectToken();
    const recoveryCode = generateRecoveryCode();

    const colorOrder = mode === '2P' ? COLOR_ORDER_2P : COLOR_ORDER_4P;
    const creatorColor: PlayerColor = 'RED';

    const creatorPlayer: PublicPlayer = {
      id: playerId,
      name: (playerName || 'Player 1').trim().slice(0, 20),
      color: creatorColor,
      slotIndex: 0,
      isHost: true,
      isReady: true,
      presence: 'CONNECTED',
      tokens: createInitialTokens(creatorColor),
      lastSeenAt: Date.now(),
      completedTokensCount: 0,
    };

    const playersMap: Record<PlayerColor, PublicPlayer | null> = {
      RED: creatorPlayer,
      GREEN: null,
      YELLOW: null,
      BLUE: null,
    };

    const initialGameState: GameState = {
      sessionId,
      mode,
      status: 'WAITING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentTurnColor: 'RED',
      diceRolledThisTurn: false,
      currentDiceValue: null,
      consecutiveSixesCount: 0,
      legalMoves: [],
      players: playersMap,
      colorOrder: [...colorOrder],
      winner: null,
      rankings: [],
      sequenceNumber: 0,
      turnSequenceNumber: 0,
      disconnectGraceExpiresAt: null,
      activityLog: [
        {
          id: `${Date.now()}-1`,
          timestamp: Date.now(),
          text: `${creatorPlayer.name} created the session (${mode} mode)`,
          type: 'JOIN',
          color: 'RED',
        },
      ],
    };

    const credentials: PrivatePlayerCredentials = {
      playerId,
      reconnectToken,
      recoveryCode,
    };

    await this.storage.saveSession(initialGameState);
    await this.storage.saveCredentials(sessionId, playerId, credentials);

    return {
      sessionId,
      player: creatorPlayer,
      credentials,
      gameState: initialGameState,
    };
  }

  /**
   * Joins an existing game session in WAITING status.
   */
  async joinSession(
    sessionId: string,
    playerName?: string
  ): Promise<JoinSessionSuccessPayload> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Game session "${sessionId}" not found. Please verify the Session ID.`);
    }

    if (session.status !== 'WAITING') {
      throw new Error(`Cannot join session "${sessionId}": Game has already started or ended.`);
    }

    const colorOrder = session.mode === '2P' ? COLOR_ORDER_2P : COLOR_ORDER_4P;
    const maxCapacity = colorOrder.length;

    // Find first vacant color slot
    const assignedColor = colorOrder.find((c) => session.players[c] === null);
    if (!assignedColor) {
      throw new Error(`Game session "${sessionId}" is completely full (${maxCapacity}/${maxCapacity} players).`);
    }

    const playerId = generatePlayerId();
    const reconnectToken = generateReconnectToken();
    const recoveryCode = generateRecoveryCode();
    const slotIndex = colorOrder.indexOf(assignedColor);

    const newPlayer: PublicPlayer = {
      id: playerId,
      name: (playerName || `Player ${slotIndex + 1}`).trim().slice(0, 20),
      color: assignedColor,
      slotIndex,
      isHost: false,
      isReady: true,
      presence: 'CONNECTED',
      tokens: createInitialTokens(assignedColor),
      lastSeenAt: Date.now(),
      completedTokensCount: 0,
    };

    session.players[assignedColor] = newPlayer;
    session.updatedAt = Date.now();
    session.activityLog.push({
      id: `${Date.now()}-${slotIndex}`,
      timestamp: Date.now(),
      text: `${newPlayer.name} joined the game as ${assignedColor}`,
      type: 'JOIN',
      color: assignedColor,
    });

    // Check if lobby is now full and ready to start
    const joinedPlayers = colorOrder.map((c) => session.players[c]).filter(Boolean) as PublicPlayer[];
    if (joinedPlayers.length === maxCapacity) {
      session.status = 'ACTIVE';
      session.activityLog.push({
        id: `${Date.now()}-start`,
        timestamp: Date.now(),
        text: `All ${maxCapacity} players joined! Game started!`,
        type: 'START',
      });
    }

    const credentials: PrivatePlayerCredentials = {
      playerId,
      reconnectToken,
      recoveryCode,
    };

    await this.storage.saveSession(session);
    await this.storage.saveCredentials(sessionId, playerId, credentials);

    return {
      sessionId: session.sessionId,
      player: newPlayer,
      credentials,
      gameState: session,
    };
  }

  /**
   * Reconnects an existing player using their private reconnect token.
   */
  async reconnectPlayer(
    sessionId: string,
    playerId: string,
    reconnectToken: string
  ): Promise<ReconnectSessionSuccessPayload> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found or has expired.`);
    }

    const creds = await this.storage.getCredentials(sessionId, playerId);
    if (!creds || creds.reconnectToken !== reconnectToken) {
      throw new Error('Authentication failed: Invalid reconnection credentials.');
    }

    // Locate player in session
    const playerColor = (Object.keys(session.players) as PlayerColor[]).find(
      (c) => session.players[c]?.id === playerId
    );

    if (!playerColor || !session.players[playerColor]) {
      throw new Error('Player not found in active session.');
    }

    const player = session.players[playerColor]!;
    player.presence = 'CONNECTED';
    player.lastSeenAt = Date.now();

    // If game was paused due to disconnect and all required players are now connected, resume!
    if (session.status === 'PAUSED') {
      const activeColors = session.colorOrder;
      const allConnected = activeColors.every(
        (c) => session.players[c] && session.players[c]?.presence === 'CONNECTED'
      );
      if (allConnected) {
        session.status = 'ACTIVE';
        session.pauseReason = undefined;
        session.disconnectGraceExpiresAt = null;
        session.activityLog.push({
          id: `${Date.now()}-resume`,
          timestamp: Date.now(),
          text: `All players reconnected! Game resumed!`,
          type: 'RESUME',
        });
      }
    }

    session.updatedAt = Date.now();
    session.activityLog.push({
      id: `${Date.now()}-reconnect`,
      timestamp: Date.now(),
      text: `${player.name} reconnected.`,
      type: 'RECONNECT',
      color: player.color,
    });

    await this.storage.saveSession(session);

    return {
      sessionId: session.sessionId,
      player,
      credentials: creds,
      gameState: session,
    };
  }

  /**
   * Recovers player identity on a new device or browser using their recovery code.
   */
  async recoverPlayer(
    sessionId: string,
    recoveryCode: string,
    newPlayerName?: string
  ): Promise<ReconnectSessionSuccessPayload> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found or expired.`);
    }

    const creds = await this.storage.getCredentialsByRecoveryCode(sessionId, recoveryCode);
    if (!creds) {
      throw new Error('Recovery failed: Invalid recovery code.');
    }

    const playerColor = (Object.keys(session.players) as PlayerColor[]).find(
      (c) => session.players[c]?.id === creds.playerId
    );

    if (!playerColor || !session.players[playerColor]) {
      throw new Error('Player slot not found in active session.');
    }

    const player = session.players[playerColor]!;
    player.presence = 'CONNECTED';
    player.lastSeenAt = Date.now();
    if (newPlayerName && newPlayerName.trim().length > 0) {
      player.name = newPlayerName.trim().slice(0, 20);
    }

    // Refresh reconnect token for security
    const refreshedCreds: PrivatePlayerCredentials = {
      ...creds,
      reconnectToken: generateReconnectToken(),
    };

    if (session.status === 'PAUSED') {
      const activeColors = session.colorOrder;
      const allConnected = activeColors.every(
        (c) => session.players[c]?.presence === 'CONNECTED'
      );
      if (allConnected) {
        session.status = 'ACTIVE';
        session.pauseReason = undefined;
        session.disconnectGraceExpiresAt = null;
      }
    }

    session.updatedAt = Date.now();
    session.activityLog.push({
      id: `${Date.now()}-recover`,
      timestamp: Date.now(),
      text: `${player.name} restored identity via recovery code.`,
      type: 'RECONNECT',
      color: player.color,
    });

    await this.storage.saveSession(session);
    await this.storage.saveCredentials(sessionId, player.id, refreshedCreds);

    return {
      sessionId: session.sessionId,
      player,
      credentials: refreshedCreds,
      gameState: session,
    };
  }

  /**
   * Marks a player as disconnected and updates game pause / grace period.
   */
  async handlePlayerDisconnect(
    sessionId: string,
    playerId: string
  ): Promise<{ session: GameState | null; disconnectedPlayer: PublicPlayer | null }> {
    const session = await this.storage.getSession(sessionId);
    if (!session) return { session: null, disconnectedPlayer: null };

    const playerColor = (Object.keys(session.players) as PlayerColor[]).find(
      (c) => session.players[c]?.id === playerId
    );
    if (!playerColor || !session.players[playerColor]) {
      return { session, disconnectedPlayer: null };
    }

    const player = session.players[playerColor]!;
    player.presence = 'DISCONNECTED';
    player.lastSeenAt = Date.now();

    // Check how many players are still connected
    const connectedCount = Object.values(session.players).filter(
      (p) => p !== null && p.presence === 'CONNECTED'
    ).length;

    if (session.status === 'ACTIVE') {
      session.status = 'PAUSED';
      session.pauseReason = `${player.name} (${player.color}) disconnected. Waiting for reconnection...`;
    }

    if (connectedCount === 0) {
      // 15-minute countdown grace period
      const graceSeconds = 15 * 60;
      session.disconnectGraceExpiresAt = Date.now() + graceSeconds * 1000;
      session.activityLog.push({
        id: `${Date.now()}-grace`,
        timestamp: Date.now(),
        text: `All players disconnected. Session will expire in 15 minutes if nobody returns.`,
        type: 'PAUSE',
      });
      await this.storage.saveSession(session, graceSeconds);
    } else {
      session.activityLog.push({
        id: `${Date.now()}-disconnect`,
        timestamp: Date.now(),
        text: `${player.name} disconnected. Match is paused.`,
        type: 'DISCONNECT',
        color: player.color,
      });
      await this.storage.saveSession(session);
    }

    return { session, disconnectedPlayer: player };
  }

  async getSession(sessionId: string): Promise<GameState | null> {
    return this.storage.getSession(sessionId);
  }
}
