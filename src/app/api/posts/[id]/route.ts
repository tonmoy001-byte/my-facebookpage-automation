// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { cancelPublishJob, schedulePublishJob } from '@/lib/queue';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
      include: {
        publishJob: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Get post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get post' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, status, scheduledAt, timezone } =
      await request.json();

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const finalMediaUrls = mediaUrls || (imageUrl ? [imageUrl] : post.mediaUrls);

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content: caption || post.content,
        mediaUrls: finalMediaUrls,
        brandVoice: brandVoiceId || post.brandVoice,
        status: status || post.status,
      },
    });

    // Update schedule if provided
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);

      // Cancel old Redis job
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
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Cancel Redis job
    const existingJob = await prisma.publishJob.findFirst({ where: { postId: id } });
    if (existingJob) {
      try { await cancelPublishJob(existingJob.id); } catch (e) { console.warn('Failed to cancel Redis job:', e); }
      await prisma.publishAttempt.deleteMany({ where: { jobId: existingJob.id } });
      await prisma.publishJob.delete({ where: { id: existingJob.id } });
    }

    // Delete related data
    await prisma.analytics.deleteMany({ where: { postId: id } });

    // Delete the post
    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
}
