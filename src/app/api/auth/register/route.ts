import { NextResponse } from 'next/server';
import { createUser } from '@/lib/auth';
import { checkRateLimit, markAuthFailed } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `register:${ip}`;

    const rl = checkRateLimit(key, rateLimitConfig.auth);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: `Too many registration attempts. Try again in ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} seconds.` } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)), 'X-RateLimit-Remaining': '0' } }
      );
    }

    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email, password, and name are required' } },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    try {
      const result = await createUser(email, password, name);
      return NextResponse.json({ success: true, data: { user: result } }, { status: 201 });
    } catch (createError: any) {
      if (createError.message === 'User already exists') {
        markAuthFailed(key, rateLimitConfig.auth);
        return NextResponse.json(
          { success: false, error: { code: 'USER_EXISTS', message: 'Email already in use' } },
          { status: 409 }
        );
      }
      throw createError;
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
