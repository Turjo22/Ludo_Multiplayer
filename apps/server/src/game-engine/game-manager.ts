import type {
  GameState,
  LegalMove,
  MoveResult,
  PlayerColor,
  PublicPlayer,
  TokenId,
  DiceRollResult,
} from '@ludo/shared-types';
import {
  applyLegalMove,
  getLegalMoves,
  getNextTurnColor,
  MAX_CONSECUTIVE_SIXES,
} from '@ludo/game-rules';
import type { IStorageAdapter } from '../storage/storage-adapter.interface.js';
import { rollAuthoritativeDice } from '../security/crypto-utils.js';
import { IdempotencyTracker } from '../security/idempotency.js';

export class GameManager {
  private idempotency = new IdempotencyTracker(60);

  constructor(private storage: IStorageAdapter) {}

  /**
   * Performs server-authoritative dice generation and legal move computation.
   */
  async rollDice(
    sessionId: string,
    playerId: string,
    actionId: string
  ): Promise<{ diceResult: DiceRollResult; legalMoves: LegalMove[]; gameState: GameState }> {
    if (this.idempotency.has(actionId)) {
      const cached = this.idempotency.getSavedResult<{
        diceResult: DiceRollResult;
        legalMoves: LegalMove[];
        gameState: GameState;
      }>(actionId);
      if (cached) return cached;
    }

    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    if (session.status !== 'ACTIVE') {
      throw new Error(`Cannot roll dice: Game is currently ${session.status}.`);
    }

    // Verify player identity and turn
    const currentPlayer = session.players[session.currentTurnColor];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new Error(`It is not your turn. Current turn: ${session.currentTurnColor}`);
    }

    if (session.diceRolledThisTurn) {
      throw new Error('Dice has already been rolled for this turn. Please select a token to move.');
    }

    const diceValue = rollAuthoritativeDice();
    const timestamp = Date.now();
    session.sequenceNumber = (session.sequenceNumber || 0) + 1;
    session.turnSequenceNumber = session.sequenceNumber;

    let consecutiveSixes = session.consecutiveSixesCount || 0;
    if (diceValue === 6) {
      consecutiveSixes += 1;
    } else {
      consecutiveSixes = 0;
    }
    session.consecutiveSixesCount = consecutiveSixes;

    const allJoinedPlayers = session.colorOrder
      .map((c) => session.players[c])
      .filter(Boolean) as PublicPlayer[];

    // Rule: 3 consecutive sixes penalty
    if (consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
      session.consecutiveSixesCount = 0;
      session.diceRolledThisTurn = false;
      session.currentDiceValue = null;
      session.legalMoves = [];

      const activeColors = session.colorOrder;
      const nextTurn = getNextTurnColor(session.currentTurnColor, activeColors, session.colorOrder);
      const prevColor = session.currentTurnColor;
      session.currentTurnColor = nextTurn;

      session.activityLog.push({
        id: `${timestamp}-3sixes`,
        timestamp,
        text: `${currentPlayer.name} rolled three consecutive sixes! Turn forfeited.`,
        type: 'PASS',
        color: prevColor,
      });

      await this.storage.saveSession(session);

      const rollResult: DiceRollResult = {
        value: diceValue,
        rolledBy: prevColor,
        timestamp,
        consecutiveSixes,
        mustPass: true,
        reason: 'THREE_SIXES',
      };

      const payload = { diceResult: rollResult, legalMoves: [], gameState: session };
      this.idempotency.record(actionId, payload);
      return payload;
    }

    // Compute legal moves
    const legalMoves = getLegalMoves(currentPlayer, allJoinedPlayers, diceValue);

    // Rule: No legal moves -> auto pass
    if (legalMoves.length === 0) {
      session.diceRolledThisTurn = false;
      session.currentDiceValue = null;
      session.legalMoves = [];

      const activeColors = session.colorOrder;
      const nextTurn = getNextTurnColor(session.currentTurnColor, activeColors, session.colorOrder);
      const prevColor = session.currentTurnColor;
      session.currentTurnColor = nextTurn;

      session.activityLog.push({
        id: `${timestamp}-nopass`,
        timestamp,
        text: `${currentPlayer.name} rolled a ${diceValue} with no legal moves. Turn passed.`,
        type: 'PASS',
        color: prevColor,
      });

      await this.storage.saveSession(session);

      const rollResult: DiceRollResult = {
        value: diceValue,
        rolledBy: prevColor,
        timestamp,
        consecutiveSixes,
        mustPass: true,
        reason: 'NO_LEGAL_MOVES',
      };

      const payload = { diceResult: rollResult, legalMoves: [], gameState: session };
      this.idempotency.record(actionId, payload);
      return payload;
    }

    // Normal roll with available legal moves
    session.diceRolledThisTurn = true;
    session.currentDiceValue = diceValue;
    session.legalMoves = legalMoves;

    session.activityLog.push({
      id: `${timestamp}-roll`,
      timestamp,
      text: `${currentPlayer.name} rolled a ${diceValue}.`,
      type: 'ROLL',
      color: currentPlayer.color,
    });

    await this.storage.saveSession(session);

    const rollResult: DiceRollResult = {
      value: diceValue,
      rolledBy: currentPlayer.color,
      timestamp,
      consecutiveSixes,
      mustPass: false,
    };

    const payload = { diceResult: rollResult, legalMoves, gameState: session };
    this.idempotency.record(actionId, payload);
    return payload;
  }

  /**
   * Server-authoritative token movement execution.
   */
  async moveToken(
    sessionId: string,
    playerId: string,
    tokenId: TokenId,
    actionId: string
  ): Promise<{ moveResult: MoveResult; gameState: GameState }> {
    if (this.idempotency.has(actionId)) {
      const cached = this.idempotency.getSavedResult<{
        moveResult: MoveResult;
        gameState: GameState;
      }>(actionId);
      if (cached) return cached;
    }

    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    if (session.status !== 'ACTIVE') {
      throw new Error(`Cannot move token: Game is currently ${session.status}.`);
    }

    const currentPlayer = session.players[session.currentTurnColor];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new Error(`It is not your turn. Current turn: ${session.currentTurnColor}`);
    }

    if (!session.diceRolledThisTurn || session.currentDiceValue === null) {
      throw new Error('You must roll the dice before moving a token.');
    }

    const diceValue = session.currentDiceValue;
    const allJoinedPlayers = session.colorOrder
      .map((c) => session.players[c])
      .filter(Boolean) as PublicPlayer[];

    const { moveResult, updatedAllPlayers, nextTurnColor, winnerColor } = applyLegalMove({
      player: currentPlayer,
      allPlayers: allJoinedPlayers,
      tokenId,
      diceValue,
      colorOrder: session.colorOrder,
    });

    // Update session players
    for (const updated of updatedAllPlayers) {
      session.players[updated.color] = updated;
    }

    const timestamp = Date.now();
    session.updatedAt = timestamp;
    session.sequenceNumber = (session.sequenceNumber || 0) + 1;
    session.turnSequenceNumber = session.sequenceNumber;

    // Build activity log
    if (moveResult.isCapture && moveResult.capturedToken) {
      session.activityLog.push({
        id: `${timestamp}-capture`,
        timestamp,
        text: `${currentPlayer.name} captured ${moveResult.capturedToken.color}'s token and earned a bonus roll!`,
        type: 'CAPTURE',
        color: currentPlayer.color,
      });
    } else if (moveResult.isHomeFinal) {
      session.activityLog.push({
        id: `${timestamp}-home`,
        timestamp,
        text: `${currentPlayer.name} reached HOME with token #${tokenId + 1}!`,
        type: 'MOVE',
        color: currentPlayer.color,
      });
    } else {
      session.activityLog.push({
        id: `${timestamp}-move`,
        timestamp,
        text: `${currentPlayer.name} moved token #${tokenId + 1} by ${diceValue} steps.`,
        type: 'MOVE',
        color: currentPlayer.color,
      });
    }

    // Reset turn state
    session.diceRolledThisTurn = false;
    session.currentDiceValue = null;
    session.legalMoves = [];

    if (moveResult.isGameOver && winnerColor) {
      session.status = 'ENDED';
      session.winner = winnerColor;
      session.rankings = [winnerColor];
      session.activityLog.push({
        id: `${timestamp}-win`,
        timestamp,
        text: `Game over! ${currentPlayer.name} (${winnerColor}) wins the game! 🎉`,
        type: 'WIN',
        color: winnerColor,
      });
    } else {
      session.currentTurnColor = nextTurnColor;
      if (moveResult.bonusTurnGranted) {
        session.activityLog.push({
          id: `${timestamp}-bonus`,
          timestamp,
          text: `${currentPlayer.name} gets a bonus turn!`,
          type: 'BONUS',
          color: currentPlayer.color,
        });
      }
    }

    await this.storage.saveSession(session);

    const payload = { moveResult, gameState: session };
    this.idempotency.record(actionId, payload);
    return payload;
  }
}
