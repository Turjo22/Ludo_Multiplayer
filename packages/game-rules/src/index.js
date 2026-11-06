"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_SQUARES = exports.COLOR_ORDER_2P = exports.COLOR_ORDER_4P = exports.START_SQUARES = exports.MAX_CONSECUTIVE_SIXES = exports.HOME_FINAL_STEP = exports.HOME_RUNWAY_LENGTH = exports.TOTAL_TRACK_SQUARES = void 0;
exports.getDistanceFromStart = getDistanceFromStart;
exports.calculateTargetPosition = calculateTargetPosition;
exports.getLegalMoves = getLegalMoves;
exports.getNextTurnColor = getNextTurnColor;
exports.applyLegalMove = applyLegalMove;
exports.createInitialTokens = createInitialTokens;
exports.TOTAL_TRACK_SQUARES = 52;
exports.HOME_RUNWAY_LENGTH = 5;
exports.HOME_FINAL_STEP = 5;
exports.MAX_CONSECUTIVE_SIXES = 3;
exports.START_SQUARES = {
    RED: 0,
    GREEN: 13,
    YELLOW: 26,
    BLUE: 39,
};
exports.COLOR_ORDER_4P = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
exports.COLOR_ORDER_2P = ['RED', 'YELLOW'];
/**
 * Standard Ludo Safe Squares (8 squares):
 * - 4 starting squares (0, 13, 26, 39)
 * - 4 star/globe squares (8, 21, 34, 47)
 */
exports.SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
/**
 * Converts a main track global index to distance travelled from player's start.
 */
function getDistanceFromStart(color, trackStep) {
    const startStep = exports.START_SQUARES[color];
    return (trackStep - startStep + exports.TOTAL_TRACK_SQUARES) % exports.TOTAL_TRACK_SQUARES;
}
/**
 * Calculates candidate new position for a token given a dice roll (1..6).
 * Returns null if the move is illegal (e.g. overshooting home or yard without a 6).
 */
function calculateTargetPosition(token, diceValue) {
    if (diceValue < 1 || diceValue > 6) {
        return null;
    }
    // Yard token
    if (token.positionType === 'YARD') {
        if (diceValue === 6) {
            return {
                positionType: 'MAIN_TRACK',
                step: exports.START_SQUARES[token.color],
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
            const targetStep = (exports.START_SQUARES[token.color] + targetDist) % exports.TOTAL_TRACK_SQUARES;
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
                step: exports.HOME_FINAL_STEP,
            };
        }
        // Overshoot
        return null;
    }
    // Token on home path (runway)
    if (token.positionType === 'HOME_PATH') {
        const targetStep = token.step + diceValue;
        if (targetStep < exports.HOME_RUNWAY_LENGTH) {
            return {
                positionType: 'HOME_PATH',
                step: targetStep,
            };
        }
        if (targetStep === exports.HOME_RUNWAY_LENGTH) {
            return {
                positionType: 'HOME_FINAL',
                step: exports.HOME_FINAL_STEP,
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
function getLegalMoves(player, allPlayers, diceValue) {
    const legalMoves = [];
    for (const token of player.tokens) {
        const target = calculateTargetPosition(token, diceValue);
        if (!target)
            continue;
        let isCapture = false;
        let capturedToken = undefined;
        // Check if landing on an opponent token on main track
        if (target.positionType === 'MAIN_TRACK') {
            const isSafe = exports.SAFE_SQUARES.has(target.step);
            if (!isSafe) {
                for (const otherPlayer of allPlayers) {
                    if (otherPlayer.color === player.color)
                        continue;
                    for (const otherToken of otherPlayer.tokens) {
                        if (otherToken.positionType === 'MAIN_TRACK' &&
                            otherToken.step === target.step) {
                            isCapture = true;
                            capturedToken = {
                                color: otherPlayer.color,
                                tokenId: otherToken.id,
                            };
                            break;
                        }
                    }
                    if (isCapture)
                        break;
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
function getNextTurnColor(currentColor, activeColors, colorOrder) {
    const available = colorOrder.filter((c) => activeColors.includes(c));
    if (available.length === 0)
        return currentColor;
    const currentIndex = available.indexOf(currentColor);
    if (currentIndex === -1)
        return available[0];
    const nextIndex = (currentIndex + 1) % available.length;
    return available[nextIndex];
}
/**
 * Applies a validated legal move and determines capture, bonus turns, and next turn.
 */
function applyLegalMove(params) {
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
    const updatedAllPlayers = allPlayers.map((p) => ({
        ...p,
        tokens: p.tokens.map((t) => ({ ...t })),
    }));
    const updatedCurrentPlayer = updatedAllPlayers.find((p) => p.color === player.color);
    const targetToken = updatedCurrentPlayer.tokens.find((t) => t.id === tokenId);
    targetToken.positionType = matchedLegalMove.to.positionType;
    targetToken.step = matchedLegalMove.to.step;
    // Handle capture
    let capturedTokenInfo = undefined;
    if (matchedLegalMove.isCapture && matchedLegalMove.capturedToken) {
        const victimPlayer = updatedAllPlayers.find((p) => p.color === matchedLegalMove.capturedToken.color);
        if (victimPlayer) {
            const victimToken = victimPlayer.tokens.find((t) => t.id === matchedLegalMove.capturedToken.tokenId);
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
    updatedCurrentPlayer.completedTokensCount = updatedCurrentPlayer.tokens.filter((t) => t.positionType === 'HOME_FINAL').length;
    const isGameOver = updatedCurrentPlayer.completedTokensCount === 4;
    const winnerColor = isGameOver ? updatedCurrentPlayer.color : undefined;
    // Bonus turn logic:
    // Rolling a 6 OR capturing an opponent grants a bonus turn.
    // Game over immediately ends turns.
    let bonusTurnGranted = false;
    let bonusReason = undefined;
    if (!isGameOver) {
        if (diceValue === 6) {
            bonusTurnGranted = true;
            bonusReason = 'ROLLED_SIX';
        }
        else if (matchedLegalMove.isCapture) {
            bonusTurnGranted = true;
            bonusReason = 'CAPTURED_OPPONENT';
        }
    }
    const nextTurnColor = isGameOver
        ? updatedCurrentPlayer.color
        : bonusTurnGranted
            ? updatedCurrentPlayer.color
            : getNextTurnColor(updatedCurrentPlayer.color, activeColors, colorOrder);
    const moveResult = {
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
function createInitialTokens(color) {
    return [0, 1, 2, 3].map((id) => ({
        id: id,
        color,
        positionType: 'YARD',
        step: id,
    }));
}
//# sourceMappingURL=index.js.map