// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { schedulePublishJob } from '@/lib/queue';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    const where: any = tenantWhere(user.tenantId, { userId: user.id });

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const jobs = await prisma.publishJob.findMany({
      where,
      include: {
        post: {
          select: {
            id: true,
            content: true,
            mediaUrls: true,
            mediaType: true,
            status: true,
            brandVoice: true,
            facebookPostId: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ schedules: jobs });
  } catch (error: any) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get schedule' },
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

    const { postId, scheduledAt, timezone } = await request.json();

    if (!postId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Post ID and scheduled time are required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Verify the post belongs to the user (tenant-scoped)
    const post = await prisma.post.findFirst({
      where: tenantWhere(user.tenantId, { id: postId, userId: user.id }),
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Upsert PublishJob
    let publishJob = await prisma.publishJob.findFirst({ where: { postId } });

    if (publishJob) {
      publishJob = await prisma.publishJob.update({
        where: { id: publishJob.id },
        data: {
          scheduledAt: scheduledDate,
          timezone: timezone || 'UTC',
          status: 'queued',
          attempts: 0,
          errorMessage: null,
        },
      });
    } else {
      publishJob = await prisma.publishJob.create({
        data: {
          postId,
          userId: user.id,
          tenantId: user.tenantId,
          scheduledAt: scheduledDate,
          timezone: timezone || 'UTC',
        },
      });
    }

    // Update post status
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'scheduled' },
    });

    // Enqueue to Redis BullMQ
    try {
      await schedulePublishJob(publishJob.id, scheduledDate);
    } catch (queueError) {
      console.warn('Redis queue unavailable, cron will pick up the job:', queueError);
    }

    return NextResponse.json({ schedule: publishJob }, { status: 201 });
  } catch (error: any) {
    console.error('Create schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create schedule' },
      { status: 500 }
    );
  }
}
