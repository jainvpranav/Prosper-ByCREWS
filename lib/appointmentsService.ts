/**
 * lib/appointmentsService.ts
 * CRUD for dbo.Appointments
 *
 * HIPAA Notes:
 *  - Appointments contain PHI (provider name, date, notes)
 *  - Notes are stored encrypted via encryptPHI
 *  - All mutations are audit-logged
 *  - Records are soft-deleted (IsActive = 0), never hard-deleted without usp_PurgeUserPHI
 */

import { getPool, sql } from './db';
import { encryptPHI, decryptPHI } from './phi';
import { logChange, logAccess } from './auditLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppointmentInput {
  locationName: string;
  locationAddress?: string;
  appointmentDate: string; // 'YYYY-MM-DD'
  timeSlot: string;        // e.g. '09:00 AM'
  provider?: string;
  notes?: string;          // PHI — will be encrypted
}

export interface Appointment {
  appointmentId: string;
  userId: string;
  locationName: string;
  locationAddress: string | null;
  appointmentDate: string;
  timeSlot: string;
  provider: string | null;
  appointmentStatus: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
  notes: string | null;     // decrypted
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createAppointment(
  userId: string,
  data: AppointmentInput,
  options?: { ipAddress?: string }
): Promise<Appointment> {
  const pool = await getPool();
  const encNotes = encryptPHI(data.notes ?? null);

  const result = await pool
    .request()
    .input('UserId',          sql.UniqueIdentifier, userId)
    .input('LocationName',    sql.NVarChar(300), data.locationName)
    .input('LocationAddress', sql.NVarChar(500), data.locationAddress ?? null)
    .input('AppointmentDate', sql.Date, data.appointmentDate)
    .input('TimeSlot',        sql.NVarChar(20), data.timeSlot)
    .input('Provider',        sql.NVarChar(300), data.provider ?? null)
    .input('Notes_Enc',       sql.NVarChar(sql.MAX), encNotes)
    .query<{
      appointmentId: string; userId: string; locationName: string; locationAddress: string;
      appointmentDate: string; timeSlot: string; provider: string; appointmentStatus: string;
      notes_Enc: string; createdAt: Date;
    }>(`
      INSERT INTO dbo.Appointments
        (UserId, LocationName, LocationAddress, AppointmentDate, TimeSlot, Provider, Notes_Enc)
      OUTPUT
        INSERTED.AppointmentId  AS appointmentId,
        INSERTED.UserId         AS userId,
        INSERTED.LocationName   AS locationName,
        INSERTED.LocationAddress AS locationAddress,
        INSERTED.AppointmentDate AS appointmentDate,
        INSERTED.TimeSlot       AS timeSlot,
        INSERTED.Provider       AS provider,
        INSERTED.AppointmentStatus AS appointmentStatus,
        INSERTED.Notes_Enc      AS notes_Enc,
        INSERTED.CreatedAt      AS createdAt
      VALUES
        (@UserId, @LocationName, @LocationAddress, @AppointmentDate, @TimeSlot, @Provider, @Notes_Enc)
    `);

  const row = result.recordset[0];

  await logChange({
    tableName: 'dbo.Appointments',
    recordId: row.appointmentId,
    operation: 'INSERT',
    changedByUserId: userId,
    newValues: {
      locationName: row.locationName,
      appointmentDate: row.appointmentDate,
      timeSlot: row.timeSlot,
    },
    ipAddress: options?.ipAddress,
  });

  return {
    ...row,
    appointmentStatus: row.appointmentStatus as Appointment['appointmentStatus'],
    notes: decryptPHI(row.notes_Enc),
  };
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getAppointmentsByUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<Appointment[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query<{
      appointmentId: string; userId: string; locationName: string; locationAddress: string;
      appointmentDate: string; timeSlot: string; provider: string; appointmentStatus: string;
      notes_Enc: string; createdAt: Date;
    }>(`
      SELECT
        AppointmentId   AS appointmentId,
        UserId          AS userId,
        LocationName    AS locationName,
        LocationAddress AS locationAddress,
        CONVERT(VARCHAR(10), AppointmentDate, 120) AS appointmentDate,
        TimeSlot        AS timeSlot,
        Provider        AS provider,
        AppointmentStatus AS appointmentStatus,
        Notes_Enc       AS notes_Enc,
        CreatedAt       AS createdAt
      FROM dbo.Appointments
      WHERE UserId = @UserId AND IsActive = 1
      ORDER BY AppointmentDate DESC
    `);

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'dbo.Appointments',
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return result.recordset.map((row) => ({
    ...row,
    appointmentStatus: row.appointmentStatus as Appointment['appointmentStatus'],
    notes: decryptPHI(row.notes_Enc),
  }));
}

// ---------------------------------------------------------------------------
// UPDATE STATUS
// ---------------------------------------------------------------------------

export async function updateAppointmentStatus(
  appointmentId: string,
  status: Appointment['appointmentStatus'],
  cancellationReason?: string,
  options?: { changedByUserId?: string; ipAddress?: string }
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('AppointmentId',     sql.UniqueIdentifier, appointmentId)
    .input('AppointmentStatus', sql.NVarChar(50), status)
    .input('CancellationReason', sql.NVarChar(500), cancellationReason ?? null)
    .query(`
      UPDATE dbo.Appointments
      SET AppointmentStatus = @AppointmentStatus,
          CancellationReason = @CancellationReason,
          ModifiedAt = SYSDATETIMEOFFSET()
      WHERE AppointmentId = @AppointmentId
    `);

  await logChange({
    tableName: 'dbo.Appointments',
    recordId: appointmentId,
    operation: 'UPDATE',
    changedByUserId: options?.changedByUserId,
    newValues: { appointmentStatus: status },
    ipAddress: options?.ipAddress,
  });
}

// ---------------------------------------------------------------------------
// SOFT DELETE
// ---------------------------------------------------------------------------

export async function cancelAppointment(
  appointmentId: string,
  reason: string,
  options?: { changedByUserId?: string; ipAddress?: string }
): Promise<void> {
  await updateAppointmentStatus(appointmentId, 'Cancelled', reason, options);
  const pool = await getPool();
  await pool
    .request()
    .input('AppointmentId', sql.UniqueIdentifier, appointmentId)
    .query(`UPDATE dbo.Appointments SET IsActive = 0, ModifiedAt = SYSDATETIMEOFFSET() WHERE AppointmentId = @AppointmentId`);
}
