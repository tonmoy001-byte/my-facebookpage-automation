// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getEngagementByDay } from '@/lib/analytics';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`analytics:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const engagement = await getEngagementByDay(user.id, user.tenantId, days);

    return NextResponse.json({ engagement });
  } catch (error: any) {
    console.error('Get engagement by day error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get engagement by day' }, { status: 500 });
  }
}
