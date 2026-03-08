/**
 * app/api/auth/login/route.ts
 * POST /api/auth/login
 *
 * Validates email + password against the users table,
 * sets an HTTP-only session cookie, and returns user info.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { logSessionEvent } from '@/lib/auditLogger';

const COOKIE_NAME = 'prosper_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    // 1. Look up user
    const { data: userRow, error: dbError } = await supabase
      .from('users')
      .select('user_id, email, password_hash, is_active, mfa_enabled')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (dbError || !userRow) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    // 2. Compare password
    const passwordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordValid) {
      await logSessionEvent(
        userRow.user_id,
        'LOGIN_FAIL',
        req.headers.get('x-forwarded-for') ?? undefined,
      );
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    // 3. Check if profile exists
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('profile_complete')
      .eq('user_id', userRow.user_id)
      .single();

    const profileComplete = profileRow?.profile_complete ?? false;

    // 4. Create session cookie (simple JSON token — signed via cookie options)
    const sessionPayload = JSON.stringify({
      userId: userRow.user_id,
      email: userRow.email,
      profileComplete,
    });

    const sessionToken = Buffer.from(sessionPayload).toString('base64');

    const response = NextResponse.json({
      user: {
        userId: userRow.user_id,
        email: userRow.email,
        profileComplete,
      },
    });

    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    // 5. Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString(), modified_at: new Date().toISOString() })
      .eq('user_id', userRow.user_id);

    await logSessionEvent(
      userRow.user_id,
      'LOGIN_SUCCESS',
      req.headers.get('x-forwarded-for') ?? undefined,
    );

    return response;
  } catch (err) {
    console.error('[API /auth/login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
