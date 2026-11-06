import crypto from 'crypto';

// Unambiguous alphabet (removes 0, O, 1, I, L to prevent user confusion when copying/typing)
const SESSION_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically secure, human-friendly 6-character Session ID.
 * Example: '7K9M2P', 'W4B8XQ'
 */
export function generateSessionId(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += SESSION_ALPHABET[bytes[i] % SESSION_ALPHABET.length];
  }
  return id;
}

/**
 * Generates a unique player ID (UUID v4).
 */
export function generatePlayerId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a secure 256-bit reconnection token (64 hex characters).
 */
export function generateReconnectToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a human-friendly recovery code for cross-device recovery.
 * Example: 'RC-9482-1748'
 */
export function generateRecoveryCode(): string {
  const digits = crypto.randomInt(10000000, 99999999).toString();
  return `RC-${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Cryptographically secure server-authoritative dice roll (1..6).
 * Uses OS entropy via crypto.randomInt.
 */
export function rollAuthoritativeDice(): number {
  return crypto.randomInt(1, 7);
}
