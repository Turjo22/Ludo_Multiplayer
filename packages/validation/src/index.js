"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerReadySchema = exports.MoveTokenSchema = exports.RollDiceSchema = exports.RecoverSessionSchema = exports.ReconnectSessionSchema = exports.JoinSessionSchema = exports.CreateSessionSchema = exports.TokenIdSchema = exports.PlayerColorSchema = exports.GameModeSchema = exports.PlayerNameSchema = exports.SessionIdSchema = exports.SESSION_ID_REGEX = void 0;
const zod_1 = require("zod");
exports.SESSION_ID_REGEX = /^[A-Z0-9]{6,8}$/;
exports.SessionIdSchema = zod_1.z
    .string()
    .trim()
    .toUpperCase()
    .regex(exports.SESSION_ID_REGEX, 'Session ID must be 6 to 8 uppercase alphanumeric characters (e.g. LUDO7A)');
exports.PlayerNameSchema = zod_1.z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(20, 'Name must be 20 characters or fewer')
    .regex(/^[\w\s\u00C0-\u024F\u1E00-\u1EFF-]+$/, 'Name contains invalid characters')
    .default('Player');
exports.GameModeSchema = zod_1.z.enum(['2P', '4P']);
exports.PlayerColorSchema = zod_1.z.enum([
    'RED',
    'GREEN',
    'YELLOW',
    'BLUE',
]);
exports.TokenIdSchema = zod_1.z.union([
    zod_1.z.literal(0),
    zod_1.z.literal(1),
    zod_1.z.literal(2),
    zod_1.z.literal(3),
]);
exports.CreateSessionSchema = zod_1.z.object({
    mode: exports.GameModeSchema,
    playerName: exports.PlayerNameSchema.optional(),
});
exports.JoinSessionSchema = zod_1.z.object({
    sessionId: exports.SessionIdSchema,
    playerName: exports.PlayerNameSchema.optional(),
});
exports.ReconnectSessionSchema = zod_1.z.object({
    sessionId: exports.SessionIdSchema,
    playerId: zod_1.z.string().min(8, 'Invalid Player ID format'),
    reconnectToken: zod_1.z.string().min(16, 'Invalid reconnection token format'),
});
exports.RecoverSessionSchema = zod_1.z.object({
    sessionId: exports.SessionIdSchema,
    recoveryCode: zod_1.z.string().trim().min(8, 'Recovery code must be at least 8 characters').max(64),
    newPlayerName: exports.PlayerNameSchema.optional(),
});
exports.RollDiceSchema = zod_1.z.object({
    actionId: zod_1.z.string().min(1, 'Action ID is required'),
});
exports.MoveTokenSchema = zod_1.z.object({
    actionId: zod_1.z.string().min(1, 'Action ID is required'),
    tokenId: exports.TokenIdSchema,
});
exports.PlayerReadySchema = zod_1.z.object({
    isReady: zod_1.z.boolean(),
});
//# sourceMappingURL=index.js.map