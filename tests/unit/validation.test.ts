import { describe, it, expect } from 'vitest';
import {
  SessionIdSchema,
  PlayerNameSchema,
  CreateSessionSchema,
  JoinSessionSchema,
  ReconnectSessionSchema,
  RecoverSessionSchema,
  RollDiceSchema,
  MoveTokenSchema,
} from '@ludo/validation';

describe('Validation Schemas', () => {
  describe('SessionIdSchema', () => {
    it('accepts valid 6 to 8 char alphanumeric session IDs and transforms to uppercase', () => {
      expect(SessionIdSchema.parse('LUDO7A')).toBe('LUDO7A');
      expect(SessionIdSchema.parse('ludo7a')).toBe('LUDO7A');
      expect(SessionIdSchema.parse('  ab12cd  ')).toBe('AB12CD');
      expect(SessionIdSchema.parse('ABCD1234')).toBe('ABCD1234');
    });

    it('rejects invalid session IDs', () => {
      expect(() => SessionIdSchema.parse('12345')).toThrow(); // too short (5)
      expect(() => SessionIdSchema.parse('123456789')).toThrow(); // too long (9)
      expect(() => SessionIdSchema.parse('LUDO-7')).toThrow(); // invalid hyphen
      expect(() => SessionIdSchema.parse('LUDO!#')).toThrow(); // special characters
    });
  });

  describe('PlayerNameSchema', () => {
    it('accepts and trims valid player names', () => {
      expect(PlayerNameSchema.parse('  Alice  ')).toBe('Alice');
      expect(PlayerNameSchema.parse('Gamer_99')).toBe('Gamer_99');
      expect(PlayerNameSchema.parse('Jean-Luc')).toBe('Jean-Luc');
    });

    it('rejects names that are too long or contain unsafe scripts', () => {
      expect(() => PlayerNameSchema.parse('')).toThrow();
      expect(() => PlayerNameSchema.parse('a'.repeat(25))).toThrow();
      expect(() => PlayerNameSchema.parse('<script>')).toThrow();
    });
  });

  describe('CreateSessionSchema', () => {
    it('validates 2P and 4P mode creation', () => {
      const res2P = CreateSessionSchema.parse({ mode: '2P', playerName: 'Alex' });
      expect(res2P.mode).toBe('2P');
      expect(res2P.playerName).toBe('Alex');

      const res4P = CreateSessionSchema.parse({ mode: '4P' });
      expect(res4P.mode).toBe('4P');
    });

    it('rejects invalid mode', () => {
      expect(() => CreateSessionSchema.parse({ mode: '3P' })).toThrow();
    });
  });

  describe('JoinSessionSchema', () => {
    it('validates joining with valid session ID', () => {
      const res = JoinSessionSchema.parse({ sessionId: 'LUDO7A', playerName: 'Bob' });
      expect(res.sessionId).toBe('LUDO7A');
      expect(res.playerName).toBe('Bob');
    });
  });

  describe('MoveTokenSchema', () => {
    it('validates token movement with token IDs 0..3', () => {
      expect(MoveTokenSchema.parse({ actionId: 'act-1', tokenId: 0 }).tokenId).toBe(0);
      expect(MoveTokenSchema.parse({ actionId: 'act-2', tokenId: 3 }).tokenId).toBe(3);
      expect(() => MoveTokenSchema.parse({ actionId: 'act-3', tokenId: 4 })).toThrow();
    });
  });

  describe('RollDiceSchema', () => {
    it('requires actionId', () => {
      expect(RollDiceSchema.parse({ actionId: 'dice-1' }).actionId).toBe('dice-1');
      expect(() => RollDiceSchema.parse({})).toThrow();
    });
  });
});
