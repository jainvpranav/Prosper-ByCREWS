/**
 * lib/phi.ts
 * PHI Encryption / Decryption Utilities
 *
 * HIPAA §164.312(a)(2)(iv) & §164.312(e)(2)(ii) — Encryption at Rest
 *
 * Implements AES-256-GCM symmetric encryption for PHI fields that must be
 * stored encrypted in the database (Medications, Allergies, Conditions,
 * ChatMessages). The encryption key is read from the environment variable
 * PHI_ENCRYPTION_KEY (32-byte hex string).
 *
 * AES-256-GCM provides:
 *   - Confidentiality (256-bit key)
 *   - Integrity + Authenticity (GCM authentication tag)
 *   - A unique 12-byte random IV per encryption call
 *
 * Output format stored in DB: base64(iv + authTag + ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;       // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;      // 128-bit auth tag
const KEY_HEX_LEN = 64;   // 32 bytes = 64 hex chars

function getKey(): Buffer {
  const hexKey = process.env.PHI_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== KEY_HEX_LEN) {
    throw new Error(
      'PHI_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypts a plaintext string (PHI) and returns a base64-encoded string
 * suitable for storage in the database.
 *
 * Returns null if plaintext is null or undefined (pass-through for optional fields).
 */
export function encryptPHI(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null;

  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Store as: iv (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded ciphertext (previously encrypted with encryptPHI).
 * Returns null if the stored value is null.
 * Throws if the ciphertext is tampered or the key is wrong (GCM auth tag mismatch).
 */
export function decryptPHI(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null || ciphertext === '') return null;

  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64');

  if (combined.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Invalid PHI ciphertext: too short');
  }

  const iv = combined.subarray(0, IV_BYTES);
  const authTag = combined.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = combined.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    // GCM auth tag mismatch — data was tampered or wrong key used
    throw new Error('PHI decryption failed: authentication tag mismatch. Data may be tampered.');
  }
}
