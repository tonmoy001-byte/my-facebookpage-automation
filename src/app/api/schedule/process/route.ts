// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';

// Cron fallback — processes any PublishJobs that are overdue
// (missed by Redis queue, e.g. after worker restart)
async function processOverdueJobs() {
  const now = new Date();

  // Find jobs that are due but still in 'pending' or 'publishing' status
  // (publishing = was being processed when worker died)
  const overdueJobs = await prisma.publishJob.findMany({
    where: {
      scheduledAt: { lte: now },
      status: { in: ['queued', 'publishing'] },
      post: { status: { in: ['scheduled', 'publishing'] } },
    },
    include: {
      post: { include: { page: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  const results = [];

  for (const job of overdueJobs) {
    try {
      const { post } = job;

      if (!post.page) {
        console.error(`No Facebook page connected for job ${job.id}`);
        await prisma.publishJob.update({
          where: { id: job.id },
          data: { status: 'failed', errorMessage: 'No Facebook page connected' },
        });
        continue;
      }

      // Mark as publishing
      await prisma.publishJob.update({
        where: { id: job.id },
        data: { status: 'publishing' },
      });

      // Create attempt record
      const attempt = await prisma.publishAttempt.create({
        data: {
          jobId: job.id,
          tenantId: job.tenantId,
          attemptNumber: 1,
          status: 'running',
          startedAt: now,
        },
      });

      const fbService = createFacebookService(post.page.accessToken, post.page.pageId);
      let result;

      if (post.mediaUrls?.length > 0) {
        if (post.mediaType === 'video') {
          result = await fbService.postVideo(post.mediaUrls[0], post.content);
        } else if (post.mediaUrls.length > 1) {
          result = await fbService.postMultiplePhotos(post.mediaUrls, post.content);
        } else {
          result = await fbService.postPhoto(post.mediaUrls[0], post.content);
        }
      } else {
        result = await fbService.postToFeed(post.content);
      }

      const facebookPostId = result.id;

      // Update attempt
      await prisma.publishAttempt.update({
        where: { id: attempt.id },
        data: { status: 'completed', facebookPostId, finishedAt: new Date() },
      });

      // Update post
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'published', publishedAt: new Date(), facebookPostId },
      });

      // Update job
      await prisma.publishJob.update({
        where: { id: job.id },
        data: { status: 'published', publishedAt: new Date(), facebookPostId },
      });

      results.push({ jobId: job.id, status: 'published', facebookPostId });
      console.log(`[Cron] Published job ${job.id} → FB: ${facebookPostId}`);

    } catch (error: any) {
      console.error(`[Cron] Failed job ${job.id}:`, error.message);

      await prisma.publishJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: error.message },
      });

      await prisma.post.update({
        where: { id: job.postId },
        data: { status: 'failed' },
      });

      results.push({ jobId: job.id, status: 'failed', error: error.message });
    }
  }

  return results;
}

// GET handler — called by Vercel cron
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await processOverdueJobs();

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Process overdue jobs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process overdue jobs' },
      { status: 500 }
    );
  }
}

// POST handler — manual trigger
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await processOverdueJobs();

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Process overdue jobs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process overdue jobs' },
      { status: 500 }
    );
  }
}
