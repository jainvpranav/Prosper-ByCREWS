/**
 * lib/appointmentsService.ts
 * CRUD for public.appointments
 *
 * HIPAA Notes:
 *  - Appointments contain PHI (provider name, date, notes)
 *  - Notes are stored encrypted via encryptPHI
 *  - All mutations are audit-logged
 *  - Records are soft-deleted (is_active = false), never hard-deleted
 *
 * Migrated from SQL Server (mssql) → Supabase (PostgreSQL).
 */

import { getSupabase } from './supabase';
import { encryptPHI, decryptPHI } from './phi';
import { logChange, logAccess } from './auditLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppointmentInput {
  locationName?: string; // Made optional for Telehealth
  locationAddress?: string;
  appointmentDate: string; // 'YYYY-MM-DD'
  timeSlot: string;        // e.g. '09:00 AM'
  provider?: string;
  notes?: string;          // PHI — will be encrypted
  appointmentType?: string;
  bookingMode?: string;
  doctorType?: string;
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
  createdAt: string;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createAppointment(
  userId: string,
  data: AppointmentInput,
  options?: { ipAddress?: string }
): Promise<Appointment> {
  const supabase = getSupabase();
  const encNotes = encryptPHI(data.notes ?? null);

  const { data: row, error } = await supabase
    .from('appointments')
    .insert({
      user_id: userId,
      location_name: data.locationName ?? null,
      location_address: data.locationAddress ?? null,
      appointment_date: data.appointmentDate,
      time_slot: data.timeSlot,
      provider: data.provider ?? data.doctorType ?? null,
      appointment_type: data.appointmentType ?? 'Regular Check-up',
      booking_mode: data.bookingMode ?? 'In-person',
      doctor_type: data.doctorType ?? null,
      notes_enc: encNotes,
    })
    .select('appointment_id, user_id, location_name, location_address, appointment_date, time_slot, provider, appointment_status, notes_enc, created_at')
    .single();

  if (error || !row) {
    throw new Error(`[AppointmentsService] Failed to create appointment: ${error?.message}`);
  }

  await logChange({
    tableName: 'appointments',
    recordId: row.appointment_id,
    operation: 'INSERT',
    changedByUserId: userId,
    newValues: {
      locationName: row.location_name,
      appointmentDate: row.appointment_date,
      timeSlot: row.time_slot,
      bookingMode: data.bookingMode,
    },
    ipAddress: options?.ipAddress,
  });

  return {
    appointmentId: row.appointment_id,
    userId: row.user_id,
    locationName: row.location_name,
    locationAddress: row.location_address,
    appointmentDate: row.appointment_date,
    timeSlot: row.time_slot,
    provider: row.provider,
    appointmentStatus: row.appointment_status as Appointment['appointmentStatus'],
    notes: decryptPHI(row.notes_enc),
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getAppointmentsByUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<Appointment[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_id, user_id, location_name, location_address, appointment_date, time_slot, provider, appointment_status, notes_enc, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('appointment_date', { ascending: false });

  if (error) {
    throw new Error(`[AppointmentsService] Failed to fetch appointments: ${error.message}`);
  }

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'appointments',
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return (data ?? []).map((row) => ({
    appointmentId: row.appointment_id,
    userId: row.user_id,
    locationName: row.location_name,
    locationAddress: row.location_address,
    appointmentDate: row.appointment_date,
    timeSlot: row.time_slot,
    provider: row.provider,
    appointmentStatus: row.appointment_status as Appointment['appointmentStatus'],
    notes: decryptPHI(row.notes_enc),
    createdAt: row.created_at,
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
  const supabase = getSupabase();

  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_status: status,
      cancellation_reason: cancellationReason ?? null,
      modified_at: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId);

  if (error) {
    throw new Error(`[AppointmentsService] Failed to update status: ${error.message}`);
  }

  await logChange({
    tableName: 'appointments',
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

  const supabase = getSupabase();
  await supabase
    .from('appointments')
    .update({
      is_active: false,
      modified_at: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId);
}
