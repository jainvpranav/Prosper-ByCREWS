/**
 * app/api/auth/register/route.ts
 * POST /api/auth/register
 *
 * Creates a new user with bcrypt-hashed password,
 * sets session cookie, and returns user info.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { logChange } from '@/lib/auditLogger';

const COOKIE_NAME = 'prosper_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 3. Create user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
      })
      .select('user_id, email')
      .single();

    if (insertError || !newUser) {
      throw new Error(`Failed to create user: ${insertError?.message}`);
    }

    // 4. Set session cookie
    const sessionPayload = JSON.stringify({
      userId: newUser.user_id,
      email: newUser.email,
      profileComplete: false,
    });

    const sessionToken = Buffer.from(sessionPayload).toString('base64');

    const response = NextResponse.json({
      user: {
        userId: newUser.user_id,
        email: newUser.email,
        profileComplete: false,
      },
    });

    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    await logChange({
      tableName: 'users',
      recordId: newUser.user_id,
      operation: 'INSERT',
      newValues: { email: newUser.email },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return response;
  } catch (err) {
    console.error('[API /auth/register]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
