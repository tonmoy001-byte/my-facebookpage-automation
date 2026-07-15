// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';

// This endpoint is called by Vercel cron to process scheduled posts
// In production, you'd secure this with a cron secret
export async function POST(request: Request) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find all schedules that are due
    const dueSchedules = await prisma.schedule.findMany({
      where: {
        scheduledAt: {
          lte: now,
        },
        post: {
          status: 'scheduled',
        },
      },
      include: {
        post: {
          include: {
            page: true,
          },
        },
        user: true,
      },
    });

    const results = [];

    for (const schedule of dueSchedules) {
      try {
        const { post, user } = schedule;

        if (!post.page) {
          console.error(`No Facebook page connected for post ${post.id}`);
          continue;
        }

        // Create Facebook service with the page's credentials
        const fbService = createFacebookService(
          post.page.accessToken,
          post.page.pageId
        );

        let result;

        // Post to Facebook based on content type
        if (post.mediaUrls?.[0]) {
          result = await fbService.postPhoto(
            post.mediaUrls[0],
            post.content
          );
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

        // Delete the schedule
        await prisma.schedule.delete({
          where: { id: schedule.id },
        });

        results.push({
          postId: post.id,
          status: 'published',
          facebookPostId: result.id,
        });

        console.log(`Successfully published post ${post.id}`);
      } catch (error: any) {
        console.error(`Failed to publish post ${schedule.post.id}:`, error);

        // Update post status to failed
        await prisma.post.update({
          where: { id: schedule.post.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
          },
        });

        results.push({
          postId: schedule.post.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

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

// GET endpoint to check pending schedules
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    const pendingCount = await prisma.schedule.count({
      where: {
        scheduledAt: {
          lte: now,
        },
        post: {
          status: 'scheduled',
        },
      },
    });

    const upcomingSchedules = await prisma.schedule.findMany({
      where: {
        post: {
          status: 'scheduled',
        },
      },
      include: {
        post: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    return NextResponse.json({
      pendingCount,
      upcoming: upcomingSchedules,
    });
  } catch (error: any) {
    console.error('Get schedule status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get schedule status' },
      { status: 500 }
    );
  }
}
