"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const game_rules_1 = require("@ludo/game-rules");
function createMockPlayer(id, color, tokens) {
    return {
        id,
        name: `Player ${color}`,
        color,
        slotIndex: 0,
        isHost: color === 'RED',
        isReady: true,
        presence: 'CONNECTED',
        tokens: tokens || (0, game_rules_1.createInitialTokens)(color),
        lastSeenAt: Date.now(),
        completedTokensCount: 0,
    };
}
(0, vitest_1.describe)('Ludo Game Engine - Core Rules', () => {
    (0, vitest_1.it)('correctly calculates distance from start for all colors', () => {
        // Red starts at 0
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('RED', 0)).toBe(0);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('RED', 10)).toBe(10);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('RED', 51)).toBe(51);
        // Green starts at 13
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('GREEN', 13)).toBe(0);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('GREEN', 14)).toBe(1);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('GREEN', 12)).toBe(51);
        // Yellow starts at 26
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('YELLOW', 26)).toBe(0);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('YELLOW', 25)).toBe(51);
        // Blue starts at 39
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('BLUE', 39)).toBe(0);
        (0, vitest_1.expect)((0, game_rules_1.getDistanceFromStart)('BLUE', 38)).toBe(51);
    });
    (0, vitest_1.it)('identifies classic safe squares correctly', () => {
        // 4 start squares
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(game_rules_1.START_SQUARES.RED)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(game_rules_1.START_SQUARES.GREEN)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(game_rules_1.START_SQUARES.YELLOW)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(game_rules_1.START_SQUARES.BLUE)).toBe(true);
        // 4 star squares (8, 21, 34, 47)
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(8)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(21)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(34)).toBe(true);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(47)).toBe(true);
        // Normal non-safe squares
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(1)).toBe(false);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(7)).toBe(false);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(9)).toBe(false);
        (0, vitest_1.expect)(game_rules_1.SAFE_SQUARES.has(20)).toBe(false);
    });
    (0, vitest_1.it)('requires a 6 to bring token out of yard', () => {
        const yardToken = {
            id: 0,
            color: 'RED',
            positionType: 'YARD',
            step: 0,
        };
        // Rolling 1-5 yields null
        for (let roll = 1; roll <= 5; roll++) {
            (0, vitest_1.expect)((0, game_rules_1.calculateTargetPosition)(yardToken, roll)).toBeNull();
        }
        // Rolling 6 places token at player start square (0 for Red)
        const target = (0, game_rules_1.calculateTargetPosition)(yardToken, 6);
        (0, vitest_1.expect)(target).toEqual({
            positionType: 'MAIN_TRACK',
            step: 0,
        });
    });
    (0, vitest_1.it)('moves tokens forward along main track with wrap-around', () => {
        const token = {
            id: 0,
            color: 'RED',
            positionType: 'MAIN_TRACK',
            step: 45,
        };
        // Red moves 4 steps from 45 -> 49 (dist 49 <= 50)
        const target = (0, game_rules_1.calculateTargetPosition)(token, 4);
        (0, vitest_1.expect)(target).toEqual({
            positionType: 'MAIN_TRACK',
            step: 49,
        });
    });
    (0, vitest_1.it)('transitions from main track into home runway', () => {
        const token = {
            id: 0,
            color: 'RED',
            positionType: 'MAIN_TRACK',
            step: 49, // distance = 49
        };
        // Target distance: 49 + 3 = 52 -> enters HOME_PATH slot 1 (52 - 51 = 1)
        const target = (0, game_rules_1.calculateTargetPosition)(token, 3);
        (0, vitest_1.expect)(target).toEqual({
            positionType: 'HOME_PATH',
            step: 1,
        });
    });
    (0, vitest_1.it)('reaches HOME_FINAL with exact roll and rejects overshoot', () => {
        const runwayToken = {
            id: 0,
            color: 'RED',
            positionType: 'HOME_PATH',
            step: 3, // Needs exactly 2 to reach step 5 (HOME_FINAL)
        };
        // Rolling 1 advances to slot 4
        (0, vitest_1.expect)((0, game_rules_1.calculateTargetPosition)(runwayToken, 1)).toEqual({
            positionType: 'HOME_PATH',
            step: 4,
        });
        // Rolling 2 reaches HOME_FINAL
        (0, vitest_1.expect)((0, game_rules_1.calculateTargetPosition)(runwayToken, 2)).toEqual({
            positionType: 'HOME_FINAL',
            step: 5,
        });
        // Rolling 3 overshoots -> null
        (0, vitest_1.expect)((0, game_rules_1.calculateTargetPosition)(runwayToken, 3)).toBeNull();
        (0, vitest_1.expect)((0, game_rules_1.calculateTargetPosition)(runwayToken, 4)).toBeNull();
    });
    (0, vitest_1.it)('captures opponent token on vulnerable square and sends it to yard', () => {
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
        const legalMoves = (0, game_rules_1.getLegalMoves)(redPlayer, allPlayers, 4);
        (0, vitest_1.expect)(legalMoves.length).toBe(1);
        (0, vitest_1.expect)(legalMoves[0].isCapture).toBe(true);
        (0, vitest_1.expect)(legalMoves[0].capturedToken).toEqual({ color: 'YELLOW', tokenId: 0 });
        const result = (0, game_rules_1.applyLegalMove)({
            player: redPlayer,
            allPlayers,
            tokenId: 0,
            diceValue: 4,
            colorOrder: game_rules_1.COLOR_ORDER_2P,
        });
        (0, vitest_1.expect)(result.moveResult.isCapture).toBe(true);
        (0, vitest_1.expect)(result.moveResult.bonusTurnGranted).toBe(true);
        (0, vitest_1.expect)(result.moveResult.bonusReason).toBe('CAPTURED_OPPONENT');
        (0, vitest_1.expect)(result.nextTurnColor).toBe('RED'); // Keeps turn because of capture bonus
        // Verify Yellow token was sent back to yard
        const updatedYellow = result.updatedAllPlayers.find((p) => p.color === 'YELLOW');
        const victimToken = updatedYellow.tokens.find((t) => t.id === 0);
        (0, vitest_1.expect)(victimToken.positionType).toBe('YARD');
    });
    (0, vitest_1.it)('does NOT capture on safe squares', () => {
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
        const legalMoves = (0, game_rules_1.getLegalMoves)(redPlayer, allPlayers, 3);
        (0, vitest_1.expect)(legalMoves.length).toBe(1);
        (0, vitest_1.expect)(legalMoves[0].isCapture).toBe(false);
        const result = (0, game_rules_1.applyLegalMove)({
            player: redPlayer,
            allPlayers,
            tokenId: 0,
            diceValue: 3,
            colorOrder: game_rules_1.COLOR_ORDER_2P,
        });
        (0, vitest_1.expect)(result.moveResult.isCapture).toBe(false);
        (0, vitest_1.expect)(result.moveResult.bonusTurnGranted).toBe(false);
        (0, vitest_1.expect)(result.nextTurnColor).toBe('YELLOW'); // Passes to next player
    });
    (0, vitest_1.it)('grants a bonus turn on rolling a 6', () => {
        const redPlayer = createMockPlayer('p1', 'RED');
        const yellowPlayer = createMockPlayer('p2', 'YELLOW');
        const allPlayers = [redPlayer, yellowPlayer];
        // Roll 6 brings token 0 out of yard
        const result = (0, game_rules_1.applyLegalMove)({
            player: redPlayer,
            allPlayers,
            tokenId: 0,
            diceValue: 6,
            colorOrder: game_rules_1.COLOR_ORDER_2P,
        });
        (0, vitest_1.expect)(result.moveResult.bonusTurnGranted).toBe(true);
        (0, vitest_1.expect)(result.moveResult.bonusReason).toBe('ROLLED_SIX');
        (0, vitest_1.expect)(result.nextTurnColor).toBe('RED');
    });
    (0, vitest_1.it)('declares winner when all 4 tokens reach HOME_FINAL', () => {
        const redPlayer = createMockPlayer('p1', 'RED', [
            { id: 0, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
            { id: 1, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
            { id: 2, color: 'RED', positionType: 'HOME_FINAL', step: 5 },
            { id: 3, color: 'RED', positionType: 'HOME_PATH', step: 4 }, // 1 step away from home
        ]);
        const yellowPlayer = createMockPlayer('p2', 'YELLOW');
        const allPlayers = [redPlayer, yellowPlayer];
        const result = (0, game_rules_1.applyLegalMove)({
            player: redPlayer,
            allPlayers,
            tokenId: 3,
            diceValue: 1,
            colorOrder: game_rules_1.COLOR_ORDER_2P,
        });
        (0, vitest_1.expect)(result.moveResult.isHomeFinal).toBe(true);
        (0, vitest_1.expect)(result.moveResult.isGameOver).toBe(true);
        (0, vitest_1.expect)(result.winnerColor).toBe('RED');
    });
    (0, vitest_1.it)('alternates turns correctly in 2P and 4P modes', () => {
        // 2P mode: RED -> YELLOW -> RED
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('RED', ['RED', 'YELLOW'], game_rules_1.COLOR_ORDER_2P)).toBe('YELLOW');
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('YELLOW', ['RED', 'YELLOW'], game_rules_1.COLOR_ORDER_2P)).toBe('RED');
        // 4P mode: RED -> GREEN -> YELLOW -> BLUE -> RED
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('RED', ['RED', 'GREEN', 'YELLOW', 'BLUE'], game_rules_1.COLOR_ORDER_4P)).toBe('GREEN');
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('GREEN', ['RED', 'GREEN', 'YELLOW', 'BLUE'], game_rules_1.COLOR_ORDER_4P)).toBe('YELLOW');
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('YELLOW', ['RED', 'GREEN', 'YELLOW', 'BLUE'], game_rules_1.COLOR_ORDER_4P)).toBe('BLUE');
        (0, vitest_1.expect)((0, game_rules_1.getNextTurnColor)('BLUE', ['RED', 'GREEN', 'YELLOW', 'BLUE'], game_rules_1.COLOR_ORDER_4P)).toBe('RED');
    });
});
//# sourceMappingURL=game-rules.test.js.map