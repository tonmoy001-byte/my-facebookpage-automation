import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { checkRateLimit, markAuthFailed, resetBackoff } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `login:${ip}`;

    const rl = checkRateLimit(key, rateLimitConfig.auth);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: `Too many login attempts. Try again in ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} seconds.` } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)), 'X-RateLimit-Remaining': '0' } }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    try {
      const result = await authenticateUser(email, password);
      resetBackoff(key);
      return NextResponse.json(result);
    } catch (authError: any) {
      if (authError.message === 'Invalid credentials') {
        markAuthFailed(key, rateLimitConfig.auth);
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
          { status: 401 }
        );
      }
      throw authError;
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
