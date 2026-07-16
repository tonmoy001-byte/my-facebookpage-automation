// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';

async function processSchedules() {
  const now = new Date();

  // Find all schedules that are due (only pick pending or failed-with-retries)
  const dueSchedules = await prisma.schedule.findMany({
    where: {
      scheduledAt: { lte: now },
      status: { in: ['pending', 'failed'] },
      post: { status: 'scheduled' },
    },
    include: {
      post: { include: { page: true } },
      user: true,
    },
  });

  const results = [];

  for (const schedule of dueSchedules) {
    try {
      const { post, user } = schedule;

      if (!post.page) {
        console.error(`No Facebook page connected for post ${post.id}`);
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { status: 'failed' },
        });
        continue;
      }

      // Mark as processing
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: 'processing' },
      });

      const fbService = createFacebookService(
        post.page.accessToken,
        post.page.pageId
      );

      let result;

      // Guard: mediaType expects media but none was uploaded
      if ((post.mediaType === 'image' || post.mediaType === 'video') && !post.mediaUrls?.[0]) {
        const errorMsg = `Post expects ${post.mediaType} but no media was uploaded`;
        console.error(errorMsg + ` (post ${post.id})`);
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage: errorMsg },
        });
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { status: 'failed', retryCount: schedule.retryCount + 1 },
        });
        results.push({ postId: post.id, status: 'failed', error: errorMsg });
        continue;
      }

      // Post to Facebook based on media type
      if (post.mediaType === 'video' && post.mediaUrls?.[0]) {
        result = await fbService.postVideo(post.mediaUrls[0], post.content);
      } else if (post.mediaUrls?.[0]) {
        if (post.mediaUrls.length > 1) {
          result = await fbService.postMultiplePhotos(post.mediaUrls, post.content);
        } else {
          result = await fbService.postPhoto(post.mediaUrls[0], post.content);
        }
      } else {
        result = await fbService.postToFeed(post.content);
      }

      // Update post status to published
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'published',
          publishedAt: now,
          facebookPostId: result.id,
        },
      });

      // Collect analytics from Facebook
      try {
        const insights = await fbService.getPostInsights(result.id);
        const metrics = insights?.data || [];
        const getMetric = (name: string) => {
          const m = metrics.find((d: any) => d.name === name);
          return m?.values?.[0]?.value || 0;
        };

        await prisma.analytics.create({
          data: {
            userId: user.id,
            postId: post.id,
            postType: 'post',
            likes: getMetric('post_reactions_by_type_total'),
            comments: getMetric('post_comments'),
            shares: getMetric('post_shares'),
            reach: getMetric('post_impressions'),
          },
        });
      } catch (insightError) {
        console.error(`Failed to collect analytics for post ${post.id}:`, insightError);
      }

      // Mark schedule as completed
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: 'completed' },
      });

      results.push({
        postId: post.id,
        status: 'published',
        facebookPostId: result.id,
      });

      console.log(`Successfully published post ${post.id}`);
    } catch (error: any) {
      console.error(`Failed to publish post ${schedule.post.id}:`, error);

      const newRetryCount = schedule.retryCount + 1;

      if (newRetryCount >= 3) {
        // Max retries reached — mark as failed
        await prisma.post.update({
          where: { id: schedule.post.id },
          data: { status: 'failed', errorMessage: error.message },
        });
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { status: 'failed', retryCount: newRetryCount },
        });
      } else {
        // Retry later — reset schedule status to pending
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { status: 'pending', retryCount: newRetryCount },
        });
      }

      results.push({
        postId: schedule.post.id,
        status: newRetryCount >= 3 ? 'failed' : 'retrying',
        error: error.message,
        retryCount: newRetryCount,
      });
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

    const results = await processSchedules();

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Process schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process schedule' },
      { status: 500 }
    );
  }
}

// POST handler — manual trigger or API call
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await processSchedules();

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Process schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process schedule' },
      { status: 500 }
    );
  }
}
