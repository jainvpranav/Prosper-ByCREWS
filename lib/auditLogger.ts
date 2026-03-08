/**
 * lib/auditLogger.ts
 * HIPAA §164.312(b) — Audit Controls
 *
 * Centralised functions to write to audit tables.
 * Every CREATE / UPDATE / DELETE of PHI tables and every SELECT of PHI
 * must be logged via this module.
 *
 * NOTE: Supabase REST API doesn't expose custom schemas (like `audit.`)
 * with the publishable key. Tables are in `public` schema with `audit_` prefix.
 *
 * Migrated from SQL Server (mssql) → Supabase (PostgreSQL).
 */

import { getSupabase } from './supabase';

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'PURGE';

export interface AuditEntry {
  tableName: string;
  recordId: string;
  operation: AuditOperation;
  changedByUserId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AccessEntry {
  accessedByUserId: string;
  tableName: string;
  recordId?: string;
  ipAddress?: string;
  purpose?: string;
}

/**
 * Write a change event to public.audit_log.
 * Call this BEFORE or AFTER every INSERT / UPDATE / DELETE on PHI tables.
 */
export async function logChange(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert({
      table_name: entry.tableName,
      record_id: entry.recordId,
      operation: entry.operation,
      changed_by_user_id: entry.changedByUserId ?? null,
      old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });

    if (error) {
      console.error('[AuditLog] Failed to write audit entry:', error.message);
    }
  } catch (err) {
    // Audit logging must never crash the main request — but always report
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/**
 * Write a read access event to public.data_access_log.
 * Call this whenever PHI is read in response to a user request.
 */
export async function logAccess(entry: AccessEntry): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('data_access_log').insert({
      accessed_by_user_id: entry.accessedByUserId,
      table_name: entry.tableName,
      record_id: entry.recordId ?? null,
      ip_address: entry.ipAddress ?? null,
      purpose: entry.purpose ?? 'Treatment',
    });

    if (error) {
      console.error('[AuditLog] Failed to write access entry:', error.message);
    }
  } catch (err) {
    console.error('[AuditLog] Failed to write access entry:', err);
  }
}

/**
 * Log user authentication events to public.user_session_log.
 */
export async function logSessionEvent(
  userId: string,
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAIL' | 'LOGOUT' | 'TIMEOUT',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('user_session_log').insert({
      user_id: userId,
      event_type: eventType,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    });

    if (error) {
      console.error('[AuditLog] Failed to write session event:', error.message);
    }
  } catch (err) {
    console.error('[AuditLog] Failed to write session event:', err);
  }
}
