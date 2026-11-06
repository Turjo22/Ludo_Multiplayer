import type { PlayerColor, TokenId, TokenPosition, TokenState, PublicPlayer, LegalMove, MoveResult } from '@ludo/shared-types';
export declare const TOTAL_TRACK_SQUARES = 52;
export declare const HOME_RUNWAY_LENGTH = 5;
export declare const HOME_FINAL_STEP = 5;
export declare const MAX_CONSECUTIVE_SIXES = 3;
export declare const START_SQUARES: Record<PlayerColor, number>;
export declare const COLOR_ORDER_4P: readonly PlayerColor[];
export declare const COLOR_ORDER_2P: readonly PlayerColor[];
/**
 * Standard Ludo Safe Squares (8 squares):
 * - 4 starting squares (0, 13, 26, 39)
 * - 4 star/globe squares (8, 21, 34, 47)
 */
export declare const SAFE_SQUARES: Set<number>;
/**
 * Converts a main track global index to distance travelled from player's start.
 */
export declare function getDistanceFromStart(color: PlayerColor, trackStep: number): number;
/**
 * Calculates candidate new position for a token given a dice roll (1..6).
 * Returns null if the move is illegal (e.g. overshooting home or yard without a 6).
 */
export declare function calculateTargetPosition(token: TokenState, diceValue: number): TokenPosition | null;
/**
 * Computes all legal moves available to a player for a given dice roll.
 */
export declare function getLegalMoves(player: PublicPlayer, allPlayers: PublicPlayer[], diceValue: number): LegalMove[];
/**
 * Computes the next player turn in cyclic order, skipping inactive/unassigned slots.
 */
export declare function getNextTurnColor(currentColor: PlayerColor, activeColors: PlayerColor[], colorOrder: readonly PlayerColor[]): PlayerColor;
/**
 * Applies a validated legal move and determines capture, bonus turns, and next turn.
 */
export declare function applyLegalMove(params: {
    player: PublicPlayer;
    allPlayers: PublicPlayer[];
    tokenId: TokenId;
    diceValue: number;
    colorOrder: readonly PlayerColor[];
}): {
    moveResult: MoveResult;
    updatedAllPlayers: PublicPlayer[];
    nextTurnColor: PlayerColor;
    winnerColor?: PlayerColor;
};
/**
 * Creates 4 fresh tokens in YARD for a player.
 */
export declare function createInitialTokens(color: PlayerColor): TokenState[];
//# sourceMappingURL=index.d.ts.map