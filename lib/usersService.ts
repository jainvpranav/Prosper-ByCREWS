/**
 * lib/usersService.ts
 * CRUD operations for public.users
 *
 * HIPAA Notes:
 *  - Passwords are NEVER stored or logged — only bcrypt/Argon2 hashes
 *  - All mutations are audit-logged
 *  - Email is the only PII in this table; treat with care
 *
 * Migrated from SQL Server (mssql) → Supabase (PostgreSQL).
 */

import { getSupabase } from './supabase';
import { logChange, logSessionEvent } from './auditLogger';

export interface User {
  userId: string;
  email: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
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
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
    })
    .select('user_id, email, is_active, mfa_enabled, created_at, last_login_at')
    .single();

  if (error || !data) {
    throw new Error(`[UsersService] Failed to create user: ${error?.message}`);
  }

  const user: User = {
    userId: data.user_id,
    email: data.email,
    isActive: data.is_active,
    mfaEnabled: data.mfa_enabled,
    createdAt: data.created_at,
    lastLoginAt: data.last_login_at,
  };

  await logChange({
    tableName: 'users',
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
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('user_id, email, is_active, mfa_enabled, created_at, last_login_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    userId: data.user_id,
    email: data.email,
    isActive: data.is_active,
    mfaEnabled: data.mfa_enabled,
    createdAt: data.created_at,
    lastLoginAt: data.last_login_at,
  };
}

/**
 * Used during login — returns only what is needed for auth verification.
 * Returns the hash so the caller can compare; never logs the hash.
 */
export async function getUserAuthRecord(
  email: string
): Promise<{ userId: string; passwordHash: string; mfaEnabled: boolean } | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('user_id, password_hash, mfa_enabled')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    userId: data.user_id,
    passwordHash: data.password_hash,
    mfaEnabled: data.mfa_enabled,
  };
}

// ------------------------------------
// UPDATE
// ------------------------------------

export async function updateLastLogin(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('users')
    .update({
      last_login_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[UsersService] Failed to update last login:', error.message);
  }

  await logSessionEvent(userId, 'LOGIN_SUCCESS', options?.ipAddress, options?.userAgent);
}

export async function enableMFA(userId: string, totpSecret: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('users')
    .update({
      mfa_enabled: true,
      mfa_secret: totpSecret,
      modified_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`[UsersService] Failed to enable MFA: ${error.message}`);
  }

  await logChange({
    tableName: 'users',
    recordId: userId,
    operation: 'UPDATE',
    newValues: { mfaEnabled: true },
  });
}

// ------------------------------------
// SOFT DELETE (HIPAA — retain audit trail, purge PHI)
// ------------------------------------

/**
 * Fully purges a user's PHI.
 * Use this for "Right to Delete" / HIPAA de-identification requests.
 */
export async function purgeUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<void> {
  const supabase = getSupabase();

  // 1. Soft-delete the user account
  await supabase
    .from('users')
    .update({
      is_active: false,
      email: `purged_${userId}`,
      modified_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // 2. Hard-delete PHI (cascade handles child tables via FK ON DELETE CASCADE)
  await supabase.from('user_profiles').delete().eq('user_id', userId);
  await supabase.from('appointments').delete().eq('user_id', userId);
  await supabase.from('chat_messages').delete().eq('user_id', userId);

  await logChange({
    tableName: 'users',
    recordId: userId,
    operation: 'PURGE',
    changedByUserId: options?.requestedByUserId,
    ipAddress: options?.ipAddress,
  });
}
