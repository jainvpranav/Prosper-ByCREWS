/**
 * app/api/appointments/[id]/route.ts
 *
 * PATCH /api/appointments/<appointmentId>  — update status or cancel
 * Body: { status: 'Completed' | 'Cancelled' | 'No-Show', reason?: string, changedByUserId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateAppointmentStatus, cancelAppointment } from '@/lib/appointmentsService';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appointmentId = params.id;
    const body = await req.json();
    const { status, reason, changedByUserId } = body;

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ?? undefined;

    if (status === 'Cancelled') {
      await cancelAppointment(appointmentId, reason ?? 'User requested cancellation', {
        changedByUserId,
        ipAddress: ip,
      });
    } else {
      await updateAppointmentStatus(appointmentId, status, reason, {
        changedByUserId,
        ipAddress: ip,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API /appointments/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
}
