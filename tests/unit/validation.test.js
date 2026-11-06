"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const validation_1 = require("@ludo/validation");
(0, vitest_1.describe)('Validation Schemas', () => {
    (0, vitest_1.describe)('SessionIdSchema', () => {
        (0, vitest_1.it)('accepts valid 6 to 8 char alphanumeric session IDs and transforms to uppercase', () => {
            (0, vitest_1.expect)(validation_1.SessionIdSchema.parse('LUDO7A')).toBe('LUDO7A');
            (0, vitest_1.expect)(validation_1.SessionIdSchema.parse('ludo7a')).toBe('LUDO7A');
            (0, vitest_1.expect)(validation_1.SessionIdSchema.parse('  ab12cd  ')).toBe('AB12CD');
            (0, vitest_1.expect)(validation_1.SessionIdSchema.parse('ABCD1234')).toBe('ABCD1234');
        });
        (0, vitest_1.it)('rejects invalid session IDs', () => {
            (0, vitest_1.expect)(() => validation_1.SessionIdSchema.parse('12345')).toThrow(); // too short (5)
            (0, vitest_1.expect)(() => validation_1.SessionIdSchema.parse('123456789')).toThrow(); // too long (9)
            (0, vitest_1.expect)(() => validation_1.SessionIdSchema.parse('LUDO-7')).toThrow(); // invalid hyphen
            (0, vitest_1.expect)(() => validation_1.SessionIdSchema.parse('LUDO!#')).toThrow(); // special characters
        });
    });
    (0, vitest_1.describe)('PlayerNameSchema', () => {
        (0, vitest_1.it)('accepts and trims valid player names', () => {
            (0, vitest_1.expect)(validation_1.PlayerNameSchema.parse('  Alice  ')).toBe('Alice');
            (0, vitest_1.expect)(validation_1.PlayerNameSchema.parse('Gamer_99')).toBe('Gamer_99');
            (0, vitest_1.expect)(validation_1.PlayerNameSchema.parse('Jean-Luc')).toBe('Jean-Luc');
        });
        (0, vitest_1.it)('rejects names that are too long or contain unsafe scripts', () => {
            (0, vitest_1.expect)(() => validation_1.PlayerNameSchema.parse('')).toThrow();
            (0, vitest_1.expect)(() => validation_1.PlayerNameSchema.parse('a'.repeat(25))).toThrow();
            (0, vitest_1.expect)(() => validation_1.PlayerNameSchema.parse('<script>')).toThrow();
        });
    });
    (0, vitest_1.describe)('CreateSessionSchema', () => {
        (0, vitest_1.it)('validates 2P and 4P mode creation', () => {
            const res2P = validation_1.CreateSessionSchema.parse({ mode: '2P', playerName: 'Alex' });
            (0, vitest_1.expect)(res2P.mode).toBe('2P');
            (0, vitest_1.expect)(res2P.playerName).toBe('Alex');
            const res4P = validation_1.CreateSessionSchema.parse({ mode: '4P' });
            (0, vitest_1.expect)(res4P.mode).toBe('4P');
        });
        (0, vitest_1.it)('rejects invalid mode', () => {
            (0, vitest_1.expect)(() => validation_1.CreateSessionSchema.parse({ mode: '3P' })).toThrow();
        });
    });
    (0, vitest_1.describe)('JoinSessionSchema', () => {
        (0, vitest_1.it)('validates joining with valid session ID', () => {
            const res = validation_1.JoinSessionSchema.parse({ sessionId: 'LUDO7A', playerName: 'Bob' });
            (0, vitest_1.expect)(res.sessionId).toBe('LUDO7A');
            (0, vitest_1.expect)(res.playerName).toBe('Bob');
        });
    });
    (0, vitest_1.describe)('MoveTokenSchema', () => {
        (0, vitest_1.it)('validates token movement with token IDs 0..3', () => {
            (0, vitest_1.expect)(validation_1.MoveTokenSchema.parse({ actionId: 'act-1', tokenId: 0 }).tokenId).toBe(0);
            (0, vitest_1.expect)(validation_1.MoveTokenSchema.parse({ actionId: 'act-2', tokenId: 3 }).tokenId).toBe(3);
            (0, vitest_1.expect)(() => validation_1.MoveTokenSchema.parse({ actionId: 'act-3', tokenId: 4 })).toThrow();
        });
    });
    (0, vitest_1.describe)('RollDiceSchema', () => {
        (0, vitest_1.it)('requires actionId', () => {
            (0, vitest_1.expect)(validation_1.RollDiceSchema.parse({ actionId: 'dice-1' }).actionId).toBe('dice-1');
            (0, vitest_1.expect)(() => validation_1.RollDiceSchema.parse({})).toThrow();
        });
    });
});
//# sourceMappingURL=validation.test.js.map