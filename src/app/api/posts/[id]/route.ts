// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { cancelPublishJob, schedulePublishJob } from '@/lib/queue';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const rl = checkRateLimit(`posts:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
      include: { publishJob: true },
    });

    if (!post) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Get post error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to get post' } }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const rl = checkRateLimit(`posts:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { id } = await params;
    const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, status, scheduledAt, timezone, autoReply, language } =
      await request.json();

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!post) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, { status: 404 });
    }

    const finalMediaUrls = mediaUrls || (imageUrl ? [imageUrl] : post.mediaUrls);

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content: caption || post.content,
        mediaUrls: finalMediaUrls,
        brandVoice: brandVoiceId || post.brandVoice,
        status: status || post.status,
        ...(autoReply !== undefined && { autoReply }),
        ...(language && { language }),
      },
    });

    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      const existingJob = await prisma.publishJob.findFirst({ where: { postId: id } });
      if (existingJob) {
        try { await cancelPublishJob(existingJob.id); } catch (e) { console.warn('Failed to cancel Redis job:', e); }
        await prisma.publishJob.update({
          where: { id: existingJob.id },
          data: { scheduledAt: scheduledDate, timezone: timezone || 'UTC', status: 'queued', attempts: 0, errorMessage: null },
        });
        try { await schedulePublishJob(existingJob.id, scheduledDate); } catch (e) { console.warn('Redis not available:', e); }
      } else {
        const newJob = await prisma.publishJob.create({
          data: { postId: id, userId: user.id, tenantId: user.tenantId, scheduledAt: scheduledDate, timezone: timezone || 'UTC' },
        });
        try { await schedulePublishJob(newJob.id, scheduledDate); } catch (e) { console.warn('Redis not available:', e); }
      }
    }

    return NextResponse.json({ post: updatedPost });
  } catch (error: any) {
    console.error('Update post error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update post' } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const rl = checkRateLimit(`posts:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!post) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, { status: 404 });
    }

    const existingJob = await prisma.publishJob.findFirst({ where: { postId: id } });
    if (existingJob) {
      try { await cancelPublishJob(existingJob.id); } catch (e) { console.warn('Failed to cancel Redis job:', e); }
      await prisma.publishAttempt.deleteMany({ where: { jobId: existingJob.id } });
      await prisma.publishJob.delete({ where: { id: existingJob.id } });
    }

    await prisma.analytics.deleteMany({ where: { postId: id } });
    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    console.error('Delete post error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete post' } }, { status: 500 });
  }
}
