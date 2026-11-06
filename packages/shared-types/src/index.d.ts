/**
 * @ludo/shared-types
 * Core domain types and interfaces shared across frontend, backend, game engine, and validation.
 */
export type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';
export type GameMode = '2P' | '4P';
export type SessionStatus = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'ENDED';
export type PlayerPresence = 'CONNECTED' | 'DISCONNECTED';
export type TokenId = 0 | 1 | 2 | 3;
export type TokenPositionType = 'YARD' | 'MAIN_TRACK' | 'HOME_PATH' | 'HOME_FINAL';
export interface TokenPosition {
    positionType: TokenPositionType;
    /**
     * For YARD: 0..3 (individual yard slot)
     * For MAIN_TRACK: 0..51 (global board step)
     * For HOME_PATH: 0..4 (player's private runway leading to home)
     * For HOME_FINAL: 5 (completed)
     */
    step: number;
}
export interface TokenState extends TokenPosition {
    id: TokenId;
    color: PlayerColor;
}
export interface PublicPlayer {
    id: string;
    name: string;
    color: PlayerColor;
    slotIndex: number;
    isHost: boolean;
    isReady: boolean;
    presence: PlayerPresence;
    tokens: TokenState[];
    lastSeenAt: number;
    completedTokensCount: number;
}
export interface PrivatePlayerCredentials {
    playerId: string;
    reconnectToken: string;
    recoveryCode: string;
}
export interface LegalMove {
    tokenId: TokenId;
    color: PlayerColor;
    from: TokenPosition;
    to: TokenPosition;
    isCapture: boolean;
    capturedToken?: {
        color: PlayerColor;
        tokenId: TokenId;
    };
}
export interface DiceRollResult {
    value: number;
    rolledBy: PlayerColor;
    timestamp: number;
    consecutiveSixes: number;
    mustPass: boolean;
    reason?: 'THREE_SIXES' | 'NO_LEGAL_MOVES';
}
export interface MoveResult {
    success: boolean;
    playerColor: PlayerColor;
    tokenId: TokenId;
    diceValue: number;
    from: TokenPosition;
    to: TokenPosition;
    isCapture: boolean;
    capturedToken?: {
        color: PlayerColor;
        tokenId: TokenId;
    };
    isHomeFinal: boolean;
    bonusTurnGranted: boolean;
    bonusReason?: 'ROLLED_SIX' | 'CAPTURED_OPPONENT';
    nextTurnColor: PlayerColor;
    isGameOver: boolean;
    winnerColor?: PlayerColor;
}
export interface GameActivityEntry {
    id: string;
    timestamp: number;
    text: string;
    type: 'JOIN' | 'LEAVE' | 'READY' | 'START' | 'ROLL' | 'MOVE' | 'CAPTURE' | 'BONUS' | 'PASS' | 'DISCONNECT' | 'RECONNECT' | 'WIN' | 'PAUSE' | 'RESUME';
    color?: PlayerColor;
}
export interface GameState {
    sessionId: string;
    mode: GameMode;
    status: SessionStatus;
    createdAt: number;
    updatedAt: number;
    currentTurnColor: PlayerColor;
    diceRolledThisTurn: boolean;
    currentDiceValue: number | null;
    consecutiveSixesCount: number;
    legalMoves: LegalMove[];
    players: Record<PlayerColor, PublicPlayer | null>;
    colorOrder: PlayerColor[];
    winner: PlayerColor | null;
    rankings: PlayerColor[];
    pauseReason?: string;
    disconnectGraceExpiresAt?: number | null;
    sequenceNumber: number;
    turnSequenceNumber?: number;
    activityLog: GameActivityEntry[];
}
/**
 * Socket.IO Contract
 */
export interface ClientToServerEvents {
    'session:create': (payload: {
        mode: GameMode;
        playerName?: string;
    }, callback: (response: SocketResponse<CreateSessionSuccessPayload>) => void) => void;
    'session:join': (payload: {
        sessionId: string;
        playerName?: string;
    }, callback: (response: SocketResponse<JoinSessionSuccessPayload>) => void) => void;
    'session:reconnect': (payload: {
        sessionId: string;
        playerId: string;
        reconnectToken: string;
    }, callback: (response: SocketResponse<ReconnectSessionSuccessPayload>) => void) => void;
    'session:recover': (payload: {
        sessionId: string;
        recoveryCode: string;
        newPlayerName?: string;
    }, callback: (response: SocketResponse<ReconnectSessionSuccessPayload>) => void) => void;
    'player:ready': (payload: {
        isReady: boolean;
    }, callback: (response: SocketResponse<{
        isReady: boolean;
    }>) => void) => void;
    'dice:roll': (payload: {
        actionId: string;
    }, callback: (response: SocketResponse<{
        diceValue: number;
        legalMoves: LegalMove[];
    }>) => void) => void;
    'token:move': (payload: {
        actionId: string;
        tokenId: TokenId;
    }, callback: (response: SocketResponse<{
        moveResult: MoveResult;
    }>) => void) => void;
    'ping:heartbeat': (payload: {
        clientTime: number;
    }, callback: (response: {
        clientTime: number;
        serverTime: number;
    }) => void) => void;
}
export interface ServerToClientEvents {
    'session:state': (state: GameState) => void;
    'session:joined': (player: PublicPlayer) => void;
    'session:paused': (payload: {
        reason: string;
        graceExpiresAt: number | null;
    }) => void;
    'session:resumed': (state: GameState) => void;
    'session:ended': (payload: {
        reason: string;
        winner?: PlayerColor;
    }) => void;
    'player:connected': (payload: {
        playerId: string;
        color: PlayerColor;
    }) => void;
    'player:disconnected': (payload: {
        playerId: string;
        color: PlayerColor;
        graceExpiresAt: number | null;
    }) => void;
    'player:reconnected': (payload: {
        playerId: string;
        color: PlayerColor;
    }) => void;
    'player:ready': (payload: {
        playerId: string;
        color: PlayerColor;
        isReady: boolean;
    }) => void;
    'game:start': (state: GameState) => void;
    'dice:result': (payload: DiceRollResult & {
        legalMoves: LegalMove[];
    }) => void;
    'token:moved': (payload: MoveResult & {
        state: GameState;
    }) => void;
    'game:updated': (state: GameState) => void;
    'game:finished': (payload: {
        winner: PlayerColor;
        rankings: PlayerColor[];
        state: GameState;
    }) => void;
    'error:notification': (payload: {
        code: string;
        message: string;
    }) => void;
}
export type SocketResponse<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};
export interface CreateSessionSuccessPayload {
    sessionId: string;
    player: PublicPlayer;
    credentials: PrivatePlayerCredentials;
    gameState: GameState;
}
export interface JoinSessionSuccessPayload {
    sessionId: string;
    player: PublicPlayer;
    credentials: PrivatePlayerCredentials;
    gameState: GameState;
}
export interface ReconnectSessionSuccessPayload {
    sessionId: string;
    player: PublicPlayer;
    credentials: PrivatePlayerCredentials;
    gameState: GameState;
}
//# sourceMappingURL=index.d.ts.map