// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { cancelPublishJob } from '@/lib/queue';

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

    // id can be the PublishJob ID
    const job = await prisma.publishJob.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!job) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Cancel the Redis job
    try {
      await cancelPublishJob(job.id);
    } catch (e) {
      console.warn('Failed to cancel Redis job:', e);
    }

    // Only reset post to draft if it hasn't been published yet
    const post = await prisma.post.findUnique({ where: { id: job.postId } });
    if (post && post.status !== 'published') {
      await prisma.post.update({
        where: { id: job.postId },
        data: { status: 'draft' },
      });
    }

    // Delete related attempts
    await prisma.publishAttempt.deleteMany({ where: { jobId: job.id } });

    // Delete the PublishJob
    await prisma.publishJob.delete({ where: { id: job.id } });

    return NextResponse.json({ message: 'Schedule deleted successfully' });
  } catch (error: any) {
    console.error('Delete schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { scheduledAt, timezone } = await request.json();

    if (!scheduledAt) {
      return NextResponse.json(
        { error: 'Scheduled time is required' },
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

    const job = await prisma.publishJob.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!job) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Cancel old Redis job
    try {
      await cancelPublishJob(job.id);
    } catch (e) {
      console.warn('Failed to cancel Redis job:', e);
    }

    // Update PublishJob
    const updatedJob = await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        scheduledAt: scheduledDate,
        timezone: timezone || job.timezone,
        status: 'queued',
        attempts: 0,
        errorMessage: null,
      },
    });

    // Enqueue new Redis job
    try {
      const { schedulePublishJob } = await import('@/lib/queue');
      await schedulePublishJob(job.id, scheduledDate);
    } catch (e) {
      console.warn('Failed to enqueue Redis job:', e);
    }

    return NextResponse.json({ schedule: updatedJob });
  } catch (error: any) {
    console.error('Update schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update schedule' },
      { status: 500 }
    );
  }
}
