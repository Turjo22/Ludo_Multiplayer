import { describe, it, expect } from 'vitest';
import {
  TOTAL_TRACK_SQUARES,
  START_SQUARES,
  SAFE_SQUARES,
  COLOR_ORDER_4P,
  COLOR_ORDER_2P,
  getDistanceFromStart,
  calculateTargetPosition,
  getLegalMoves,
  applyLegalMove,
  createInitialTokens,
  getNextTurnColor,
} from '@ludo/game-rules';
import type { PublicPlayer, TokenState } from '@ludo/shared-types';

function createMockPlayer(
  id: string,
  color: 'RED' | 'GREEN' | 'YELLOW' | 'BLUE',
  tokens?: TokenState[]
): PublicPlayer {
  return {
    id,
    name: `Player ${color}`,
    color,
    slotIndex: 0,
    isHost: color === 'RED',
    isReady: true,
    presence: 'CONNECTED',
    tokens: tokens || createInitialTokens(color),
    lastSeenAt: Date.now(),
    completedTokensCount: 0,
  };
}

describe('Ludo Game Engine - Core Rules', () => {
  it('correctly calculates distance from start for all colors', () => {
    // Red starts at 0
    expect(getDistanceFromStart('RED', 0)).toBe(0);
    expect(getDistanceFromStart('RED', 10)).toBe(10);
    expect(getDistanceFromStart('RED', 51)).toBe(51);

    // Green starts at 13
    expect(getDistanceFromStart('GREEN', 13)).toBe(0);
    expect(getDistanceFromStart('GREEN', 14)).toBe(1);
    expect(getDistanceFromStart('GREEN', 12)).toBe(51);

    // Yellow starts at 26
    expect(getDistanceFromStart('YELLOW', 26)).toBe(0);
    expect(getDistanceFromStart('YELLOW', 25)).toBe(51);

    // Blue starts at 39
    expect(getDistanceFromStart('BLUE', 39)).toBe(0);
    expect(getDistanceFromStart('BLUE', 38)).toBe(51);
  });

  it('identifies classic safe squares correctly', () => {
    // 4 start squares
    expect(SAFE_SQUARES.has(START_SQUARES.RED)).toBe(true);
    expect(SAFE_SQUARES.has(START_SQUARES.GREEN)).toBe(true);
    expect(SAFE_SQUARES.has(START_SQUARES.YELLOW)).toBe(true);
    expect(SAFE_SQUARES.has(START_SQUARES.BLUE)).toBe(true);

    // 4 star squares (8, 21, 34, 47)
    expect(SAFE_SQUARES.has(8)).toBe(true);
    expect(SAFE_SQUARES.has(21)).toBe(true);
    expect(SAFE_SQUARES.has(34)).toBe(true);
    expect(SAFE_SQUARES.has(47)).toBe(true);

    // Normal non-safe squares
    expect(SAFE_SQUARES.has(1)).toBe(false);
    expect(SAFE_SQUARES.has(7)).toBe(false);
    expect(SAFE_SQUARES.has(9)).toBe(false);
    expect(SAFE_SQUARES.has(20)).toBe(false);
  });

  it('requires a 6 to bring token out of yard', () => {
    const yardToken: TokenState = {
      id: 0,
      color: 'RED',
      positionType: 'YARD',
      step: 0,
    };

    // Rolling 1-5 yields null
    for (let roll = 1; roll <= 5; roll++) {
      expect(calculateTargetPosition(yardToken, roll)).toBeNull();
    }

    // Rolling 6 places token at player start square (0 for Red)
    const target = calculateTargetPosition(yardToken, 6);
    expect(target).toEqual({
      positionType: 'MAIN_TRACK',
      step: 0,
    });
  });

  it('moves tokens forward along main track with wrap-around', () => {
    const token: TokenState = {
      id: 0,
      color: 'RED',
      positionType: 'MAIN_TRACK',
      step: 45,
    };

    // Red moves 4 steps from 45 -> 49 (dist 49 <= 50)
    const target = calculateTargetPosition(token, 4);
    expect(target).toEqual({
      positionType: 'MAIN_TRACK',
      step: 49,
    });
  });

  it('transitions from main track into home runway', () => {
    const token: TokenState = {
      id: 0,
      color: 'RED',
      positionType: 'MAIN_TRACK',
      step: 49, // distance = 49
    };

    // Target distance: 49 + 3 = 52 -> enters HOME_PATH slot 1 (52 - 51 = 1)
    const target = calculateTargetPosition(token, 3);
    expect(target).toEqual({
      positionType: 'HOME_PATH',
      step: 1,
    });
  });

  it('reaches HOME_FINAL with exact roll and rejects overshoot', () => {
    const runwayToken: TokenState = {
      id: 0,
      color: 'RED',
      positionType: 'HOME_PATH',
      step: 3, // Needs exactly 2 to reach step 5 (HOME_FINAL)
    };

    // Rolling 1 advances to slot 4
    expect(calculateTargetPosition(runwayToken, 1)).toEqual({
      positionType: 'HOME_PATH',
      step: 4,
    });

    // Rolling 2 reaches HOME_FINAL
    expect(calculateTargetPosition(runwayToken, 2)).toEqual({
      positionType: 'HOME_FINAL',
      step: 5,
    });

    // Rolling 3 overshoots -> null
    expect(calculateTargetPosition(runwayToken, 3)).toBeNull();
    expect(calculateTargetPosition(runwayToken, 4)).toBeNull();
  });

  it('captures opponent token on vulnerable square and sends it to yard', () => {
    const redPlayer = createMockPlayer('p1', 'RED', [
      { id: 0, color: 'RED', positionType: 'MAIN_TRACK', step: 5 },
      { id: 1, color: 'RED', positionType: 'YARD', step: 1 },
      { id: 2, color: 'RED', positionType: 'YARD', step: 2 },
      { id: 3, color: 'RED', positionType: 'YARD', step: 3 },
    ]);

    // Square 9 is NOT a safe square. Yellow has a token on 9.
    const yellowPlayer = createMockPlayer('p2', 'YELLOW', [
      { id: 0, color: 'YELLOW', positionType: 'MAIN_TRACK', step: 9 },
      { id: 1, color: 'YELLOW', positionType: 'YARD', step: 1 },
      { id: 2, color: 'YELLOW', positionType: 'YARD', step: 2 },
      { id: 3, color: 'YELLOW', positionType: 'YARD', step: 3 },
    ]);

    const allPlayers = [redPlayer, yellowPlayer];

    // Red rolls 4: moves from 5 to 9
    const legalMoves = getLegalMoves(redPlayer, allPlayers, 4);
    expect(legalMoves.length).toBe(1);
    expect(legalMoves[0].isCapture).toBe(true);
    expect(legalMoves[0].capturedToken).toEqual({ color: 'YELLOW', tokenId: 0 });

    const result = applyLegalMove({
      player: redPlayer,
      allPlayers,
      tokenId: 0,
      diceValue: 4,
      colorOrder: COLOR_ORDER_2P,
    });

    expect(result.moveResult.isCapture).toBe(true);
    expect(result.moveResult.bonusTurnGranted).toBe(true);
    expect(result.moveResult.bonusReason).toBe('CAPTURED_OPPONENT');
    expect(result.nextTurnColor).toBe('RED'); // Keeps turn because of capture bonus

    // Verify Yellow token was sent back to yard
    const updatedYellow = result.updatedAllPlayers.find((p) => p.color === 'YELLOW')!;
    const victimToken = updatedYellow.tokens.find((t) => t.id === 0)!;
    expect(victimToken.positionType).toBe('YARD');
  });

  it('does NOT capture on safe squares', () => {
    // Square 8 is a star safe square
    const redPlayer = createMockPlayer('p1', 'RED', [
      { id: 0, color: 'RED', positionType: 'MAIN_TRACK', step: 5 },
      { id: 1, color: 'RED', positionType: 'YARD', step: 1 },
      { id: 2, color: 'RED', positionType: 'YARD', step: 2 },
      { id: 3, color: 'RED', positionType: 'YARD', step: 3 },
    ]);

    const yellowPlayer = createMockPlayer('p2', 'YELLOW', [
      { id: 0, color: 'YELLOW', positionType: 'MAIN_TRACK', step: 8 },
      { id: 1, color: 'YELLOW', positionType: 'YARD', step: 1 },
      { id: 2, color: 'YELLOW', positionType: 'YARD', step: 2 },
      { id: 3, color: 'YELLOW', positionType: 'YARD', step: 3 },
    ]);

    const allPlayers = [redPlayer, yellowPlayer];

    // Red rolls 3: lands on safe square 8
    const legalMoves = getLegalMoves(redPlayer, allPlayers, 3);
    expect(legalMoves.length).toBe(1);
    expect(legalMoves[0].isCapture).toBe(false);

    const result = applyLegalMove({
      player: redPlayer,
      allPlayers,
      tokenId: 0,
      diceValue: 3,
      colorOrder: COLOR_ORDER_2P,
    });

    expect(result.moveResult.isCapture).toBe(false);
    expect(result.moveResult.bonusTurnGranted).toBe(false);
    expect(result.nextTurnColor).toBe('YELLOW'); // Passes to next player
  });

  it('grants a bonus turn on rolling a 6', () => {
    const redPlayer = createMockPlayer('p1', 'RED');
    const yellowPlayer = createMockPlayer('p2', 'YELLOW');
    const allPlayers = [redPlayer, yellowPlayer];

    // Roll 6 brings token 0 out of yard
    const result = applyLegalMove({
      player: redPlayer,
      allPlayers,
      tokenId: 0,
      diceValue: 6,
      colorOrder: COLOR_ORDER_2P,
    });

    expect(result.moveResult.bonusTurnGranted).toBe(true);
    expect(result.moveResult.bonusReason).toBe('ROLLED_SIX');
    expect(result.nextTurnColor).toBe('RED');
  });

  it('declares winner when all 4 tokens reach HOME_FINAL', () => {
    const redPlayer = createMockPlayer('p1', 'RED', [
      { id: 0, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
      { id: 1, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
      { id: 2, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
      { id: 3, color: 'RED', positionType: 'HOME_PATH', step: 4 }, // 1 step away from home
    ]);

    const yellowPlayer = createMockPlayer('p2', 'YELLOW');
    const allPlayers = [redPlayer, yellowPlayer];

    const result = applyLegalMove({
      player: redPlayer,
      allPlayers,
      tokenId: 3,
      diceValue: 1,
      colorOrder: COLOR_ORDER_2P,
    });

    expect(result.moveResult.isHomeFinal).toBe(true);
    expect(result.moveResult.isGameOver).toBe(true);
    expect(result.winnerColor).toBe('RED');
  });

  it('alternates turns correctly in 2P and 4P modes', () => {
    // 2P mode: RED -> YELLOW -> RED
    expect(getNextTurnColor('RED', ['RED', 'YELLOW'], COLOR_ORDER_2P)).toBe('YELLOW');
    expect(getNextTurnColor('YELLOW', ['RED', 'YELLOW'], COLOR_ORDER_2P)).toBe('RED');

    // 4P mode: RED -> GREEN -> YELLOW -> BLUE -> RED
    expect(getNextTurnColor('RED', ['RED', 'GREEN', 'YELLOW', 'BLUE'], COLOR_ORDER_4P)).toBe('GREEN');
    expect(getNextTurnColor('GREEN', ['RED', 'GREEN', 'YELLOW', 'BLUE'], COLOR_ORDER_4P)).toBe('YELLOW');
    expect(getNextTurnColor('YELLOW', ['RED', 'GREEN', 'YELLOW', 'BLUE'], COLOR_ORDER_4P)).toBe('BLUE');
    expect(getNextTurnColor('BLUE', ['RED', 'GREEN', 'YELLOW', 'BLUE'], COLOR_ORDER_4P)).toBe('RED');
  });
});
