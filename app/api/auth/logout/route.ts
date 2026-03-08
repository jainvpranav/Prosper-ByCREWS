/**
 * app/api/auth/logout/route.ts
 * POST /api/auth/logout — clears session cookie
 */

import { NextResponse } from 'next/server';

const COOKIE_NAME = 'prosper_session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });
  return response;
}
