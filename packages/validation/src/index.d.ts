import { z } from 'zod';
import type { TokenId } from '@ludo/shared-types';
export declare const SESSION_ID_REGEX: RegExp;
export declare const SessionIdSchema: z.ZodString;
export declare const PlayerNameSchema: z.ZodDefault<z.ZodString>;
export declare const GameModeSchema: z.ZodEnum<["2P", "4P"]>;
export declare const PlayerColorSchema: z.ZodEnum<["RED", "GREEN", "YELLOW", "BLUE"]>;
export declare const TokenIdSchema: z.ZodType<TokenId>;
export declare const CreateSessionSchema: z.ZodObject<{
    mode: z.ZodEnum<["2P", "4P"]>;
    playerName: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    mode: "2P" | "4P";
    playerName?: string | undefined;
}, {
    mode: "2P" | "4P";
    playerName?: string | undefined;
}>;
export declare const JoinSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    playerName: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    playerName?: string | undefined;
}, {
    sessionId: string;
    playerName?: string | undefined;
}>;
export declare const ReconnectSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    playerId: z.ZodString;
    reconnectToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    reconnectToken: string;
    playerId: string;
}, {
    sessionId: string;
    reconnectToken: string;
    playerId: string;
}>;
export declare const RecoverSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    recoveryCode: z.ZodString;
    newPlayerName: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    recoveryCode: string;
    newPlayerName?: string | undefined;
}, {
    sessionId: string;
    recoveryCode: string;
    newPlayerName?: string | undefined;
}>;
export declare const RollDiceSchema: z.ZodObject<{
    actionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actionId: string;
}, {
    actionId: string;
}>;
export declare const MoveTokenSchema: z.ZodObject<{
    actionId: z.ZodString;
    tokenId: z.ZodType<TokenId, z.ZodTypeDef, TokenId>;
}, "strip", z.ZodTypeAny, {
    tokenId: TokenId;
    actionId: string;
}, {
    tokenId: TokenId;
    actionId: string;
}>;
export declare const PlayerReadySchema: z.ZodObject<{
    isReady: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isReady: boolean;
}, {
    isReady: boolean;
}>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
export type ReconnectSessionInput = z.infer<typeof ReconnectSessionSchema>;
export type RecoverSessionInput = z.infer<typeof RecoverSessionSchema>;
export type RollDiceInput = z.infer<typeof RollDiceSchema>;
export type MoveTokenInput = z.infer<typeof MoveTokenSchema>;
export type PlayerReadyInput = z.infer<typeof PlayerReadySchema>;
//# sourceMappingURL=index.d.ts.map