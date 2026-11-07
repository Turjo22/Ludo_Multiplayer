import type {
  GameMode,
  PlayerColor,
  TokenId,
  TokenPosition,
  TokenPositionType,
  TokenState,
  PublicPlayer,
  LegalMove,
  MoveResult,
} from '@ludo/shared-types';

export const TOTAL_TRACK_SQUARES = 52;
export const HOME_RUNWAY_LENGTH = 5;
export const HOME_FINAL_STEP = 5;
export const MAX_CONSECUTIVE_SIXES = 3;

export const START_SQUARES: Record<PlayerColor, number> = {
  RED: 0,
  BLUE: 13,
  YELLOW: 26,
  GREEN: 39,
};

export const COLOR_ORDER_4P: readonly PlayerColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
export const COLOR_ORDER_2P: readonly PlayerColor[] = ['RED', 'YELLOW'];

/**
 * Standard Ludo Safe Squares (8 squares):
 * - 4 starting squares (0, 13, 26, 39)
 * - 4 star/globe squares (8, 21, 34, 47)
 */
export const SAFE_SQUARES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

/**
 * Converts a main track global index to distance travelled from player's start.
 */
export function getDistanceFromStart(color: PlayerColor, trackStep: number): number {
  const startStep = START_SQUARES[color];
  return (trackStep - startStep + TOTAL_TRACK_SQUARES) % TOTAL_TRACK_SQUARES;
}

/**
 * Calculates candidate new position for a token given a dice roll (1..6).
 * Returns null if the move is illegal (e.g. overshooting home or yard without a 6).
 */
export function calculateTargetPosition(
  token: TokenState,
  diceValue: number
): TokenPosition | null {
  if (diceValue < 1 || diceValue > 6) {
    return null;
  }

  // Yard token
  if (token.positionType === 'YARD') {
    if (diceValue === 6) {
      return {
        positionType: 'MAIN_TRACK',
        step: START_SQUARES[token.color],
      };
    }
    return null;
  }

  // Token already reached final destination
  if (token.positionType === 'HOME_FINAL') {
    return null;
  }

  // Token on main track
  if (token.positionType === 'MAIN_TRACK') {
    const currentDist = getDistanceFromStart(token.color, token.step);
    const targetDist = currentDist + diceValue;

    if (targetDist <= 50) {
      const targetStep = (START_SQUARES[token.color] + targetDist) % TOTAL_TRACK_SQUARES;
      return {
        positionType: 'MAIN_TRACK',
        step: targetStep,
      };
    }

    // Entering home path (targetDist: 51 -> step 0, ..., 55 -> step 4)
    if (targetDist >= 51 && targetDist <= 55) {
      return {
        positionType: 'HOME_PATH',
        step: targetDist - 51,
      };
    }

    // Reaching home final (targetDist exactly 56)
    if (targetDist === 56) {
      return {
        positionType: 'HOME_FINAL',
        step: HOME_FINAL_STEP,
      };
    }

    // Overshoot
    return null;
  }

  // Token on home path (runway)
  if (token.positionType === 'HOME_PATH') {
    const targetStep = token.step + diceValue;
    if (targetStep < HOME_RUNWAY_LENGTH) {
      return {
        positionType: 'HOME_PATH',
        step: targetStep,
      };
    }
    if (targetStep === HOME_RUNWAY_LENGTH) {
      return {
        positionType: 'HOME_FINAL',
        step: HOME_FINAL_STEP,
      };
    }
    // Overshoot
    return null;
  }

  return null;
}

/**
 * Computes all legal moves available to a player for a given dice roll.
 */
export function getLegalMoves(
  player: PublicPlayer,
  allPlayers: PublicPlayer[],
  diceValue: number
): LegalMove[] {
  const legalMoves: LegalMove[] = [];

  for (const token of player.tokens) {
    const target = calculateTargetPosition(token, diceValue);
    if (!target) continue;

    let isCapture = false;
    let capturedToken: { color: PlayerColor; tokenId: TokenId } | undefined = undefined;

    // Check if landing on an opponent token on main track
    if (target.positionType === 'MAIN_TRACK') {
      const isSafe = SAFE_SQUARES.has(target.step);
      if (!isSafe) {
        for (const otherPlayer of allPlayers) {
          if (otherPlayer.color === player.color) continue;

          for (const otherToken of otherPlayer.tokens) {
            if (
              otherToken.positionType === 'MAIN_TRACK' &&
              otherToken.step === target.step
            ) {
              isCapture = true;
              capturedToken = {
                color: otherPlayer.color,
                tokenId: otherToken.id,
              };
              break;
            }
          }
          if (isCapture) break;
        }
      }
    }

    legalMoves.push({
      tokenId: token.id,
      color: player.color,
      from: { positionType: token.positionType, step: token.step },
      to: target,
      isCapture,
      capturedToken,
    });
  }

  return legalMoves;
}

/**
 * Computes the next player turn in cyclic order, skipping inactive/unassigned slots.
 */
export function getNextTurnColor(
  currentColor: PlayerColor,
  activeColors: PlayerColor[],
  colorOrder: readonly PlayerColor[]
): PlayerColor {
  const available = colorOrder.filter((c) => activeColors.includes(c));
  if (available.length === 0) return currentColor;

  const currentIndex = available.indexOf(currentColor);
  if (currentIndex === -1) return available[0];

  const nextIndex = (currentIndex + 1) % available.length;
  return available[nextIndex];
}

/**
 * Applies a validated legal move and determines capture, bonus turns, and next turn.
 */
export function applyLegalMove(params: {
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
} {
  const { player, allPlayers, tokenId, diceValue, colorOrder } = params;
  const token = player.tokens.find((t) => t.id === tokenId);
  if (!token) {
    throw new Error(`Token ${tokenId} not found for player ${player.color}`);
  }

  const legalMoves = getLegalMoves(player, allPlayers, diceValue);
  const matchedLegalMove = legalMoves.find((m) => m.tokenId === tokenId);
  if (!matchedLegalMove) {
    throw new Error(`Move for token ${tokenId} is not legal for dice value ${diceValue}`);
  }

  const activeColors = allPlayers.map((p) => p.color);

  // Deep clone all players for immutable state update
  const updatedAllPlayers: PublicPlayer[] = allPlayers.map((p) => ({
    ...p,
    tokens: p.tokens.map((t) => ({ ...t })),
  }));

  const updatedCurrentPlayer = updatedAllPlayers.find((p) => p.color === player.color)!;
  const targetToken = updatedCurrentPlayer.tokens.find((t) => t.id === tokenId)!;

  targetToken.positionType = matchedLegalMove.to.positionType;
  targetToken.step = matchedLegalMove.to.step;

  // Handle capture
  let capturedTokenInfo: { color: PlayerColor; tokenId: TokenId } | undefined = undefined;
  if (matchedLegalMove.isCapture && matchedLegalMove.capturedToken) {
    const victimPlayer = updatedAllPlayers.find(
      (p) => p.color === matchedLegalMove.capturedToken!.color
    );
    if (victimPlayer) {
      const victimToken = victimPlayer.tokens.find(
        (t) => t.id === matchedLegalMove.capturedToken!.tokenId
      );
      if (victimToken) {
        victimToken.positionType = 'YARD';
        victimToken.step = victimToken.id;
        capturedTokenInfo = {
          color: victimPlayer.color,
          tokenId: victimToken.id,
        };
      }
    }
  }

  // Update completed tokens count
  updatedCurrentPlayer.completedTokensCount = updatedCurrentPlayer.tokens.filter(
    (t) => t.positionType === 'HOME_FINAL'
  ).length;

  const isGameOver = updatedCurrentPlayer.completedTokensCount === 4;
  const winnerColor = isGameOver ? updatedCurrentPlayer.color : undefined;

  // Bonus turn logic:
  // Rolling a 6 OR capturing an opponent grants a bonus turn.
  // Game over immediately ends turns.
  let bonusTurnGranted = false;
  let bonusReason: 'ROLLED_SIX' | 'CAPTURED_OPPONENT' | undefined = undefined;

  if (!isGameOver) {
    if (diceValue === 6) {
      bonusTurnGranted = true;
      bonusReason = 'ROLLED_SIX';
    } else if (matchedLegalMove.isCapture) {
      bonusTurnGranted = true;
      bonusReason = 'CAPTURED_OPPONENT';
    }
  }

  const nextTurnColor = isGameOver
    ? updatedCurrentPlayer.color
    : bonusTurnGranted
    ? updatedCurrentPlayer.color
    : getNextTurnColor(updatedCurrentPlayer.color, activeColors, colorOrder);

  const moveResult: MoveResult = {
    success: true,
    playerColor: updatedCurrentPlayer.color,
    tokenId,
    diceValue,
    from: matchedLegalMove.from,
    to: matchedLegalMove.to,
    isCapture: matchedLegalMove.isCapture,
    capturedToken: capturedTokenInfo,
    isHomeFinal: matchedLegalMove.to.positionType === 'HOME_FINAL',
    bonusTurnGranted,
    bonusReason,
    nextTurnColor,
    isGameOver,
    winnerColor,
  };

  return {
    moveResult,
    updatedAllPlayers,
    nextTurnColor,
    winnerColor,
  };
}

/**
 * Creates 4 fresh tokens in YARD for a player.
 */
export function createInitialTokens(color: PlayerColor): TokenState[] {
  return [0, 1, 2, 3].map((id) => ({
    id: id as TokenId,
    color,
    positionType: 'YARD',
    step: id,
  }));
}
