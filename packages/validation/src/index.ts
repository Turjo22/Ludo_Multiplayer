import { z } from 'zod';
import type { GameMode, PlayerColor, TokenId } from '@ludo/shared-types';

export const SESSION_ID_REGEX = /^[A-Z0-9]{6,8}$/;

export const SessionIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SESSION_ID_REGEX, 'Session ID must be 6 to 8 uppercase alphanumeric characters (e.g. LUDO7A)');

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name cannot be empty')
  .max(20, 'Name must be 20 characters or fewer')
  .regex(/^[\w\s\u00C0-\u024F\u1E00-\u1EFF().,'-]+$/, 'Name contains invalid characters')
  .default('Player');

export const GameModeSchema = z.enum(['2P', '4P'] as const satisfies readonly [GameMode, ...GameMode[]]);

export const PlayerColorSchema = z.enum([
  'RED',
  'GREEN',
  'YELLOW',
  'BLUE',
] as const satisfies readonly [PlayerColor, ...PlayerColor[]]);

export const TokenIdSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]) as z.ZodType<TokenId>;

export const CreateSessionSchema = z.object({
  mode: GameModeSchema,
  playerName: PlayerNameSchema.optional(),
});

export const JoinSessionSchema = z.object({
  sessionId: SessionIdSchema,
  playerName: PlayerNameSchema.optional(),
});

export const ReconnectSessionSchema = z.object({
  sessionId: SessionIdSchema,
  playerId: z.string().min(8, 'Invalid Player ID format'),
  reconnectToken: z.string().min(16, 'Invalid reconnection token format'),
});

export const RecoverSessionSchema = z.object({
  sessionId: SessionIdSchema,
  recoveryCode: z.string().trim().min(8, 'Recovery code must be at least 8 characters').max(64),
  newPlayerName: PlayerNameSchema.optional(),
});

export const RollDiceSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
});

export const MoveTokenSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
  tokenId: TokenIdSchema,
});

export const PlayerReadySchema = z.object({
  isReady: z.boolean(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
export type ReconnectSessionInput = z.infer<typeof ReconnectSessionSchema>;
export type RecoverSessionInput = z.infer<typeof RecoverSessionSchema>;
export type RollDiceInput = z.infer<typeof RollDiceSchema>;
export type MoveTokenInput = z.infer<typeof MoveTokenSchema>;
export type PlayerReadyInput = z.infer<typeof PlayerReadySchema>;
