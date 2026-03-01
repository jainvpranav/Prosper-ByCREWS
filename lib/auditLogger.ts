/**
 * lib/auditLogger.ts
 * HIPAA §164.312(b) — Audit Controls
 *
 * Centralised functions to write to audit.AuditLog and audit.DataAccessLog.
 * Every CREATE / UPDATE / DELETE of PHI tables and every SELECT of PHI
 * must be logged via this module.
 */

import { getPool, sql } from './db';

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
 * Write a change event to audit.AuditLog.
 * Call this BEFORE or AFTER every INSERT / UPDATE / DELETE on PHI tables.
 */
export async function logChange(entry: AuditEntry): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('TableName', sql.NVarChar(128), entry.tableName)
      .input('RecordId', sql.NVarChar(128), entry.recordId)
      .input('Operation', sql.NVarChar(10), entry.operation)
      .input('ChangedByUserId', sql.NVarChar(256), entry.changedByUserId ?? null)
      .input('OldValues', sql.NVarChar(sql.MAX), entry.oldValues ? JSON.stringify(entry.oldValues) : null)
      .input('NewValues', sql.NVarChar(sql.MAX), entry.newValues ? JSON.stringify(entry.newValues) : null)
      .input('IpAddress', sql.NVarChar(45), entry.ipAddress ?? null)
      .input('UserAgent', sql.NVarChar(512), entry.userAgent ?? null)
      .query(`
        INSERT INTO audit.AuditLog
          (TableName, RecordId, Operation, ChangedByUserId, OldValues, NewValues, IpAddress, UserAgent)
        VALUES
          (@TableName, @RecordId, @Operation, @ChangedByUserId, @OldValues, @NewValues, @IpAddress, @UserAgent)
      `);
  } catch (err) {
    // Audit logging must never crash the main request — but always report
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/**
 * Write a read access event to audit.DataAccessLog.
 * Call this whenever PHI is read in response to a user request.
 */
export async function logAccess(entry: AccessEntry): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('AccessedByUserId', sql.NVarChar(256), entry.accessedByUserId)
      .input('TableName', sql.NVarChar(128), entry.tableName)
      .input('RecordId', sql.NVarChar(128), entry.recordId ?? null)
      .input('IpAddress', sql.NVarChar(45), entry.ipAddress ?? null)
      .input('Purpose', sql.NVarChar(200), entry.purpose ?? 'Treatment')
      .query(`
        INSERT INTO audit.DataAccessLog
          (AccessedByUserId, TableName, RecordId, IpAddress, Purpose)
        VALUES
          (@AccessedByUserId, @TableName, @RecordId, @IpAddress, @Purpose)
      `);
  } catch (err) {
    console.error('[AuditLog] Failed to write access entry:', err);
  }
}

/**
 * Log user authentication events to audit.UserSessionLog.
 */
export async function logSessionEvent(
  userId: string,
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAIL' | 'LOGOUT' | 'TIMEOUT',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('UserId', sql.UniqueIdentifier, userId)
      .input('EventType', sql.NVarChar(20), eventType)
      .input('IpAddress', sql.NVarChar(45), ipAddress ?? null)
      .input('UserAgent', sql.NVarChar(512), userAgent ?? null)
      .query(`
        INSERT INTO audit.UserSessionLog (UserId, EventType, IpAddress, UserAgent)
        VALUES (@UserId, @EventType, @IpAddress, @UserAgent)
      `);
  } catch (err) {
    console.error('[AuditLog] Failed to write session event:', err);
  }
}
