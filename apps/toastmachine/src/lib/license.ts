import { createHash, randomBytes } from "crypto";

// Alphabet without ambiguous characters (no 0/O, 1/I/L) for readable keys.
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SEGMENT_LENGTH = 4;
const SEGMENT_COUNT = 4;

/**
 * Generate a single license key in the format TOAST-XXXX-XXXX-XXXX.
 * Uses cryptographically secure randomness.
 */
export function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let s = 0; s < SEGMENT_COUNT; s++) {
    let segment = "";
    const bytes = randomBytes(SEGMENT_LENGTH);
    for (let i = 0; i < SEGMENT_LENGTH; i++) {
      segment += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
    }
    segments.push(segment);
  }
  return `TOAST-${segments.join("-")}`;
}

/**
 * Generate N unique license keys.
 */
export function generateLicenseKeys(count: number, existing: string[] = []): string[] {
  const set = new Set<string>(existing);
  const keys: string[] = [];
  let guard = 0;
  while (keys.length < count && guard < count * 50) {
    guard++;
    const key = generateLicenseKey();
    if (set.has(key)) continue;
    set.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * Hash a machine fingerprint token (server-side) to avoid storing raw fingerprints
 * in a reversible form, and to keep the DB column short / comparable.
 */
export function hashFingerprint(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a session token for an activated license.
 * Format: <keyId>.<randomHex>.<hmac> — simple tamper-resistant token.
 */
export function createSessionToken(keyId: string, secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${keyId}.${nonce}`;
  const sig = createHash("sha256")
    .update(`${payload}.${secret}`)
    .digest("hex")
    .slice(0, 32);
  return `${payload}.${sig}`;
}

/**
 * Verify a session token's integrity (signature) and return the keyId if valid.
 */
export function verifySessionToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [keyId, nonce, sig] = parts;
  if (!keyId || !nonce || !sig) return null;
  const expected = createHash("sha256")
    .update(`${keyId}.${nonce}.${secret}`)
    .digest("hex")
    .slice(0, 32);
  if (expected !== sig) return null;
  return keyId;
}

export const SESSION_SECRET =
  process.env.SESSION_SECRET || "toast-slot-machine-session-secret-dev";
export const ADMIN_SECRET =
  process.env.ADMIN_SECRET || "toast-admin-secret-change-me";
