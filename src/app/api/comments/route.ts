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
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const rl = checkRateLimit(`comments:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: any = tenantWhere(user.tenantId, { userId: user.id });
    if (status) where.status = status;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          page: { select: { pageName: true } },
          rule: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({ comments, total, limit, offset });
  } catch (error: any) {
    console.error('Get comments error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to get comments' } }, { status: 500 });
  }
}
