/**
 * app/api/profile/route.ts
 * Server-side API route — bridges the 'use client' profile form to profileService
 *
 * GET  /api/profile?userId=<id>  — fetch a user's full profile
 * POST /api/profile              — upsert profile (called on form completion)
 *
 * NOTE: Until auth is wired up, userId is passed explicitly.
 *       Once NextAuth/session is added, replace with:
 *       const session = await getServerSession(); const userId = session.user.id;
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertProfile, getProfileByUser } from '@/lib/profileService';

// GET /api/profile?userId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
    }

    const profile = await getProfileByUser(userId, {
      requestedByUserId: userId,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
      purpose: 'Treatment',
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[API /profile GET]', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// POST /api/profile
// Body: { userId: string, ...ProfileInput }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...profileData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required in request body' }, { status: 400 });
    }

    const profileId = await upsertProfile(userId, profileData, {
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ success: true, profileId }, { status: 200 });
  } catch (err) {
    console.error('[API /profile POST]', err);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
