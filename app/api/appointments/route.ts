/**
 * app/api/appointments/route.ts
 *
 * GET  /api/appointments?userId=<id>  — list all appointments for a user
 * POST /api/appointments              — create (book) a new appointment
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAppointment,
  getAppointmentsByUser,
} from '@/lib/appointmentsService';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
    }

    const appointments = await getAppointmentsByUser(userId, {
      requestedByUserId: userId,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('[API /appointments GET]', err);
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...appointmentData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!appointmentData.locationName || !appointmentData.appointmentDate || !appointmentData.timeSlot) {
      return NextResponse.json(
        { error: 'locationName, appointmentDate, and timeSlot are required' },
        { status: 400 }
      );
    }

    const appointment = await createAppointment(userId, appointmentData, {
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    console.error('[API /appointments POST]', err);
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 });
  }
}
