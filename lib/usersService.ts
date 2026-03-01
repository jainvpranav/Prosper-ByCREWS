/**
 * lib/usersService.ts
 * CRUD operations for dbo.Users
 *
 * HIPAA Notes:
 *  - Passwords are NEVER stored or logged — only bcrypt/Argon2 hashes
 *  - All mutations are audit-logged
 *  - Email is the only PII in this table; treat with care
 */

import { getPool, sql } from './db';
import { logChange, logSessionEvent } from './auditLogger';

export interface User {
  userId: string;
  email: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

// ------------------------------------
// CREATE
// ------------------------------------

/**
 * Creates a new user. The caller is responsible for hashing the password
 * with bcrypt / Argon2id BEFORE passing passwordHash here.
 * NEVER pass a plaintext password.
 */
export async function createUser(
  email: string,
  passwordHash: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<User> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Email', sql.NVarChar(320), email.toLowerCase().trim())
    .input('PasswordHash', sql.NVarChar(512), passwordHash)
    .query<User>(`
      INSERT INTO dbo.Users (Email, PasswordHash)
      OUTPUT
        INSERTED.UserId     AS userId,
        INSERTED.Email      AS email,
        INSERTED.IsActive   AS isActive,
        INSERTED.MfaEnabled AS mfaEnabled,
        INSERTED.CreatedAt  AS createdAt,
        INSERTED.LastLoginAt AS lastLoginAt
      VALUES (@Email, @PasswordHash)
    `);

  const user = result.recordset[0];
  await logChange({
    tableName: 'dbo.Users',
    recordId: user.userId,
    operation: 'INSERT',
    newValues: { email: user.email },
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
  return user;
}

// ------------------------------------
// READ
// ------------------------------------

export async function getUserById(userId: string): Promise<User | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query<User>(`
      SELECT
        UserId     AS userId,
        Email      AS email,
        IsActive   AS isActive,
        MfaEnabled AS mfaEnabled,
        CreatedAt  AS createdAt,
        LastLoginAt AS lastLoginAt
      FROM dbo.Users
      WHERE UserId = @UserId AND IsActive = 1
    `);
  return result.recordset[0] ?? null;
}

/**
 * Used during login — returns only what is needed for auth verification.
 * Returns the hash so the caller can compare; never logs the hash.
 */
export async function getUserAuthRecord(
  email: string
): Promise<{ userId: string; passwordHash: string; mfaEnabled: boolean } | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Email', sql.NVarChar(320), email.toLowerCase().trim())
    .query<{ userId: string; passwordHash: string; mfaEnabled: boolean }>(`
      SELECT UserId AS userId, PasswordHash AS passwordHash, MfaEnabled AS mfaEnabled
      FROM dbo.Users
      WHERE Email = @Email AND IsActive = 1
    `);
  return result.recordset[0] ?? null;
}

// ------------------------------------
// UPDATE
// ------------------------------------

export async function updateLastLogin(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query(`
      UPDATE dbo.Users
      SET LastLoginAt = SYSDATETIMEOFFSET(), ModifiedAt = SYSDATETIMEOFFSET()
      WHERE UserId = @UserId
    `);

  await logSessionEvent(userId, 'LOGIN_SUCCESS', options?.ipAddress, options?.userAgent);
}

export async function enableMFA(userId: string, totpSecret: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .input('MfaSecret', sql.NVarChar(256), totpSecret)
    .query(`
      UPDATE dbo.Users
      SET MfaEnabled = 1, MfaSecret = @MfaSecret, ModifiedAt = SYSDATETIMEOFFSET()
      WHERE UserId = @UserId
    `);
  await logChange({ tableName: 'dbo.Users', recordId: userId, operation: 'UPDATE', newValues: { mfaEnabled: true } });
}

// ------------------------------------
// SOFT DELETE (HIPAA — retain audit trail, purge PHI)
// ------------------------------------

/**
 * Fully purges a user's PHI by calling the stored procedure dbo.usp_PurgeUserPHI.
 * Use this for "Right to Delete" / HIPAA de-identification requests.
 */
export async function purgeUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .execute('dbo.usp_PurgeUserPHI');

  await logChange({
    tableName: 'dbo.Users',
    recordId: userId,
    operation: 'PURGE',
    changedByUserId: options?.requestedByUserId,
    ipAddress: options?.ipAddress,
  });
}
