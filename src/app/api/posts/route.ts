// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere, tenantData } from '@/lib/prisma';

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
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          publishJob: true,
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

    const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, scheduledAt, timezone, autoReply, language } = await request.json();

    if (!caption) {
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }

    // Get the user's connected Facebook page (tenant-scoped)
    const page = await prisma.facebookPage.findFirst({
      where: tenantWhere(user.tenantId, { userId: user.id }),
    });

    if (!page) {
      return NextResponse.json(
        { error: 'No Facebook page connected. Please connect a page first.' },
        { status: 400 }
      );
    }

    // Build content with hashtags
    const hashtagText = hashtags?.length ? '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ') : '';
    const content = caption + hashtagText;

    // Build media URLs
    const finalMediaUrls = mediaUrls || (imageUrl ? [imageUrl] : []);
    const mediaType = finalMediaUrls.length > 0
      ? (finalMediaUrls[0].includes('.mp4') || finalMediaUrls[0].includes('video') ? 'video' : 'image')
      : 'text';

    // Create the post
    const post = await prisma.post.create({
      data: tenantData(user.tenantId, {
        userId: user.id,
        pageId: page.id,
        content,
        mediaUrls: finalMediaUrls,
        mediaType,
        brandVoice: brandVoiceId || 'professional',
        status: scheduledAt ? 'scheduled' : 'draft',
        autoReply: autoReply === true,
        language: language || 'EN',
      }),
    });

    // Create PublishJob + enqueue if scheduled
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);

      const publishJob = await prisma.publishJob.create({
        data: {
          postId: post.id,
          userId: user.id,
          tenantId: user.tenantId,
          scheduledAt: scheduledDate,
          timezone: timezone || 'UTC',
        },
      });

      try {
        const { schedulePublishJob } = await import('@/lib/queue');
        await schedulePublishJob(publishJob.id, scheduledDate);
      } catch (e) {
        console.warn('Redis not available, cron will handle:', e);
      }
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
