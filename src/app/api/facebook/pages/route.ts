// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`facebook:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const pages = await prisma.facebookPage.findMany({
      where: tenantWhere(user.tenantId, { userId: user.id }),
      select: { id: true, pageId: true, pageName: true, connectedAt: true },
    });

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error('Get pages error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get pages' }, { status: 500 });
  }
}
