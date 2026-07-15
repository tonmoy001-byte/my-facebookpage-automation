// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          brandVoice: true,
          schedules: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({ posts, total, limit, offset });
  } catch (error: any) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { caption, hashtags, imageUrl, brandVoiceId, scheduledAt } = await request.json();

    if (!caption) {
      return NextResponse.json(
        { error: 'Caption is required' },
        { status: 400 }
      );
    }

    // Get the user's connected Facebook page
    const page = await prisma.facebookPage.findFirst({
      where: { userId: user.id },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'No Facebook page connected. Please connect a page first.' },
        { status: 400 }
      );
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        pageId: page.id,
        caption,
        hashtags: hashtags || [],
        imageUrl,
        brandVoiceId: brandVoiceId || null,
        status: scheduledAt ? 'scheduled' : 'draft',
      },
    });

    // Create schedule if provided
    if (scheduledAt) {
      await prisma.schedule.create({
        data: {
          postId: post.id,
          userId: user.id,
          scheduledAt: new Date(scheduledAt),
        },
      });
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error: any) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}
