// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: any = tenantWhere(user.tenantId, { userId: user.id });

    if (status) {
      where.status = status;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          page: {
            select: {
              pageName: true,
            },
          },
          rule: {
            select: {
              name: true,
            },
          },
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
    return NextResponse.json(
      { error: error.message || 'Failed to get comments' },
      { status: 500 }
    );
  }
}
