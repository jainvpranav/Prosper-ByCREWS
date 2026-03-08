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
import { getUserById } from '@/lib/usersService';
import { sendAppointmentConfirmationEmail } from '@/lib/emailService';

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
    // Legacy map checking vs new Telehealth flow
    const isNewFlow = !!appointmentData.appointment_type;
    
    if (!isNewFlow && (!appointmentData.locationName || !appointmentData.appointmentDate || !appointmentData.timeSlot)) {
      return NextResponse.json(
        { error: 'locationName, appointmentDate, and timeSlot are required for legacy bookings' },
        { status: 400 }
      );
    }

    if (isNewFlow && !appointmentData.date) {
      return NextResponse.json(
        { error: 'date is required for new bookings' },
        { status: 400 }
      );
    }

    // Map the payload to the service expected input
    const serviceInput = isNewFlow 
      ? {
          appointmentDate: appointmentData.date,
          timeSlot: appointmentData.time_slot,
          notes: appointmentData.notes,
          appointmentType: appointmentData.appointment_type,
          bookingMode: appointmentData.booking_mode,
          doctorType: appointmentData.doctor_type,
          locationName: appointmentData.booking_mode === 'Telehealth' ? 'Virtual Session' : 'Prosper Clinic',
        }
      : {
          locationName: appointmentData.locationName,
          appointmentDate: appointmentData.appointmentDate,
          timeSlot: appointmentData.timeSlot,
          provider: appointmentData.provider,
          notes: appointmentData.notes,
        };

    const appointment = await createAppointment(userId, serviceInput, {
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    // Fire & Forget email sending
    getUserById(userId).then(user => {
      if (user && user.email) {
        sendAppointmentConfirmationEmail(user.email, {
          locationName: serviceInput.locationName || 'Virtual Session',
          appointmentDate: serviceInput.appointmentDate,
          timeSlot: serviceInput.timeSlot,
          provider: serviceInput.provider || serviceInput.doctorType || 'Assigned Provider',
        });
      }
    }).catch(err => console.error('[API /appointments POST] Error fetching user for email', err));

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    console.error('[API /appointments POST]', err);
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 });
  }
}
