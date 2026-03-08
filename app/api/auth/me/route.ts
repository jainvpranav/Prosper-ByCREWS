/**
 * app/api/auth/me/route.ts
 * GET /api/auth/me — returns current user from session cookie, or 401
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'prosper_session';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(COOKIE_NAME);
    if (!cookie?.value) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    const user = JSON.parse(decoded);

    if (!user?.userId || !user?.email) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
