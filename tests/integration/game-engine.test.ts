import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorageAdapter } from '../../apps/server/src/storage/in-memory-storage.js';
import { SessionManager } from '../../apps/server/src/sessions/session-manager.js';
import { GameManager } from '../../apps/server/src/game-engine/game-manager.js';
import type { TokenId } from '@ludo/shared-types';

describe('Integration: Server-Authoritative Game Engine & Actions', () => {
  let storage: InMemoryStorageAdapter;
  let sessionManager: SessionManager;
  let gameManager: GameManager;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
    sessionManager = new SessionManager(storage);
    gameManager = new GameManager(storage);
  });

  it('rejects roll when not player turn or game not active', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    // Session is WAITING, not ACTIVE yet
    await expect(
      gameManager.rollDice(createRes.sessionId, createRes.player.id, 'act-1')
    ).rejects.toThrow(/Cannot roll dice: Game is currently WAITING/);

    const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');
    // Now ACTIVE! Current turn is RED (Alice). Bob (YELLOW) trying to roll must fail:
    await expect(
      gameManager.rollDice(createRes.sessionId, joinRes.player.id, 'act-2')
    ).rejects.toThrow(/It is not your turn/);
  });

  it('allows active player to roll and generates cryptographically valid dice (1..6)', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    const result = await gameManager.rollDice(createRes.sessionId, createRes.player.id, 'act-roll-1');
    expect(result.diceResult.value).toBeGreaterThanOrEqual(1);
    expect(result.diceResult.value).toBeLessThanOrEqual(6);
    expect(result.gameState.sequenceNumber).toBe(1);

    // If rolled 1-5 with all tokens in yard, must auto-pass to Yellow
    if (result.diceResult.value < 6) {
      expect(result.diceResult.mustPass).toBe(true);
      expect(result.gameState.currentTurnColor).toBe('YELLOW');
      expect(result.legalMoves.length).toBe(0);
    } else {
      // Rolled 6: Alice has legal moves to bring token out of yard
      expect(result.diceResult.mustPass).toBe(false);
      expect(result.gameState.currentTurnColor).toBe('RED');
      expect(result.legalMoves.length).toBe(4);
    }
  });

  it('rejects double roll without moving a token', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Force Red to roll 6 by manipulating session state for test
    const session = (await storage.getSession(createRes.sessionId))!;
    session.diceRolledThisTurn = true;
    session.currentDiceValue = 6;
    session.legalMoves = [
      {
        tokenId: 0,
        color: 'RED',
        from: { positionType: 'YARD', step: 0 },
        to: { positionType: 'MAIN_TRACK', step: 0 },
        isCapture: false,
      },
    ];
    await storage.saveSession(session);

    // Second roll attempt in same turn must fail
    await expect(
      gameManager.rollDice(createRes.sessionId, createRes.player.id, 'act-roll-2')
    ).rejects.toThrow(/Dice has already been rolled/);
  });

  it('enforces idempotency on duplicate action IDs', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    const first = await gameManager.rollDice(createRes.sessionId, createRes.player.id, 'act-idempotent-1');
    const second = await gameManager.rollDice(createRes.sessionId, createRes.player.id, 'act-idempotent-1');

    expect(second.diceResult.value).toBe(first.diceResult.value);
    expect(second.diceResult.timestamp).toBe(first.diceResult.timestamp);
  });

  it('moves token, updates position, and grants bonus turn when rolling 6', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Setup: Red rolled a 6
    const session = (await storage.getSession(createRes.sessionId))!;
    session.diceRolledThisTurn = true;
    session.currentDiceValue = 6;
    session.legalMoves = [
      {
        tokenId: 0 as TokenId,
        color: 'RED',
        from: { positionType: 'YARD', step: 0 },
        to: { positionType: 'MAIN_TRACK', step: 0 },
        isCapture: false,
      },
    ];
    await storage.saveSession(session);

    const moveRes = await gameManager.moveToken(
      createRes.sessionId,
      createRes.player.id,
      0 as TokenId,
      'act-move-0'
    );

    expect(moveRes.moveResult.success).toBe(true);
    expect(moveRes.moveResult.to.positionType).toBe('MAIN_TRACK');
    expect(moveRes.moveResult.to.step).toBe(0);
    expect(moveRes.moveResult.bonusTurnGranted).toBe(true);
    // Alice keeps turn for bonus roll
    expect(moveRes.gameState.currentTurnColor).toBe('RED');
    expect(moveRes.gameState.diceRolledThisTurn).toBe(false);
  });

  it('executes capture and sends opponent token back to yard', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Place Yellow token at square 10 (not safe) and Red token at 7 (not safe)
    const session = (await storage.getSession(createRes.sessionId))!;
    session.players.RED!.tokens[0] = { id: 0, color: 'RED', positionType: 'MAIN_TRACK', step: 7 };
    session.players.YELLOW!.tokens[0] = { id: 0, color: 'YELLOW', positionType: 'MAIN_TRACK', step: 10 };
    session.currentTurnColor = 'RED';
    session.diceRolledThisTurn = true;
    session.currentDiceValue = 3;
    session.legalMoves = [
      {
        tokenId: 0,
        color: 'RED',
        from: { positionType: 'MAIN_TRACK', step: 7 },
        to: { positionType: 'MAIN_TRACK', step: 10 },
        isCapture: true,
        capturedToken: { color: 'YELLOW', tokenId: 0 },
      },
    ];
    await storage.saveSession(session);

    const moveRes = await gameManager.moveToken(
      createRes.sessionId,
      createRes.player.id,
      0,
      'act-capture-1'
    );

    expect(moveRes.moveResult.isCapture).toBe(true);
    expect(moveRes.moveResult.bonusTurnGranted).toBe(true);
    expect(moveRes.moveResult.bonusReason).toBe('CAPTURED_OPPONENT');
    expect(moveRes.gameState.currentTurnColor).toBe('RED'); // bonus turn

    // Verify victim token is back in yard
    const yellowToken = moveRes.gameState.players.YELLOW?.tokens.find((t) => t.id === 0);
    expect(yellowToken?.positionType).toBe('YARD');
  });
});
