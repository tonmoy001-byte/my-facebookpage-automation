// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSummaryStats } from '@/lib/analytics';
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

    const stats = await getSummaryStats(user.id, user.tenantId, days);

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Get summary stats error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get summary stats' }, { status: 500 });
  }
}
