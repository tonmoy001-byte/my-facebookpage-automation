// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectPostMetrics } from '@/lib/analytics';

// Cron: Collects analytics for all published posts that haven't been tracked recently
// Runs every 6 hours via Vercel cron
async function collectAllAnalytics() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Find published posts with a Facebook Post ID that haven't been tracked recently
  const posts = await prisma.post.findMany({
    where: {
      status: 'published',
      facebookPostId: { not: null },
      OR: [
        { analytics: { none: {} } },
        { analytics: { every: { collectedAt: { lt: sixHoursAgo } } } },
      ],
    },
    take: 50,
  });

  const results = [];

  for (const post of posts) {
    try {
      const metrics = await collectPostMetrics(post.id);
      if (metrics) {
        results.push({ postId: post.id, status: 'collected', metrics });
      }
    } catch (error: any) {
      console.error(`[Analytics Cron] Failed for post ${post.id}:`, error.message);
      results.push({ postId: post.id, status: 'failed', error: error.message });
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

    const results = await collectAllAnalytics();

    return NextResponse.json({
      collected: results.filter((r) => r.status === 'collected').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    });
  } catch (error: any) {
    console.error('Analytics collection cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to collect analytics' },
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

    const results = await collectAllAnalytics();

    return NextResponse.json({
      collected: results.filter((r) => r.status === 'collected').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    });
  } catch (error: any) {
    console.error('Analytics collection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to collect analytics' },
      { status: 500 }
    );
  }
}
