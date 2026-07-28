// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAnalytics } from '@/lib/analytics';
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
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    const analytics = await getAnalytics(user.id, user.tenantId, startDate || undefined, endDate || undefined);

    return NextResponse.json({ analytics });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get analytics' }, { status: 500 });
  }
}
