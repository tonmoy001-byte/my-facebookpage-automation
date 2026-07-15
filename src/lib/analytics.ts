// @ts-nocheck
import { prisma } from './prisma';
import { createFacebookService } from './facebook';

export interface PostMetrics {
  postId: string;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface PageMetrics {
  pageId: string;
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
}

// Collect metrics for a specific post
export async function collectPostMetrics(postId: string): Promise<PostMetrics | null> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { page: true },
    });

    if (!post || !post.facebookPostId || !post.page) return null;

    const fbService = createFacebookService(post.page.accessToken, post.page.pageId);
    const insights = await fbService.getPostInsights(post.facebookPostId);

    // Parse Facebook Insights response
    const metrics: PostMetrics = {
      postId,
      impressions: 0,
      reach: 0,
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    };

    if (insights?.data) {
      for (const metric of insights.data) {
        switch (metric.name) {
          case 'post_impressions':
            metrics.impressions = metric.values?.[0]?.value || 0;
            break;
          case 'post_reactions_by_type_total':
            metrics.likes = metric.values?.[0]?.value || 0;
            break;
          case 'post_comments':
            metrics.comments = metric.values?.[0]?.value || 0;
            break;
          case 'post_shares':
            metrics.shares = metric.values?.[0]?.value || 0;
            break;
        }
      }
    }

    metrics.engagement = metrics.likes + metrics.comments + metrics.shares;

    // Store metrics in database
    await prisma.analytics.upsert({
      where: {
        postId_date: {
          postId,
          date: new Date().toISOString().split('T')[0],
        },
      },
      update: {
        impressions: metrics.impressions,
        reach: metrics.reach,
        engagement: metrics.engagement,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
      },
      create: {
        postId,
        userId: post.userId,
        date: new Date().toISOString().split('T')[0],
        impressions: metrics.impressions,
        reach: metrics.reach,
        engagement: metrics.engagement,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
      },
    });

    return metrics;
  } catch (error) {
    console.error(`Failed to collect metrics for post ${postId}:`, error);
    return null;
  }
}

// Collect page-level metrics
export async function collectPageMetrics(pageId: string): Promise<PageMetrics | null> {
  try {
    const page = await prisma.facebookPage.findUnique({
      where: { id: pageId },
    });

    if (!page) return null;

    const fbService = createFacebookService(page.accessToken, page.pageId);
    const stats = await fbService.getPageStats();

    const metrics: PageMetrics = {
      pageId,
      date: new Date().toISOString().split('T')[0],
      followers: stats.fan_count || 0,
      reach: stats.talking_about_count || 0,
      impressions: 0,
      engagement: 0,
    };

    return metrics;
  } catch (error) {
    console.error(`Failed to collect page metrics for ${pageId}:`, error);
    return null;
  }
}

// Get analytics for a user with date filtering
export async function getAnalytics(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const where: any = { userId };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  const analytics = await prisma.analytics.findMany({
    where,
    include: {
      post: {
        select: {
          id: true,
          caption: true,
          imageUrl: true,
          createdAt: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  return analytics;
}

// Get summary stats for a user
export async function getSummaryStats(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const [totalPosts, publishedPosts, scheduledPosts, totalAnalytics] = await Promise.all([
    prisma.post.count({ where: { userId } }),
    prisma.post.count({ where: { userId, status: 'published' } }),
    prisma.post.count({ where: { userId, status: 'scheduled' } }),
    prisma.analytics.aggregate({
      where: {
        userId,
        date: { gte: startDateStr },
      },
      _sum: {
        impressions: true,
        engagement: true,
        likes: true,
        comments: true,
        shares: true,
      },
    }),
  ]);

  return {
    totalPosts,
    publishedPosts,
    scheduledPosts,
    totalImpressions: totalAnalytics._sum.impressions || 0,
    totalEngagement: totalAnalytics._sum.engagement || 0,
    totalLikes: totalAnalytics._sum.likes || 0,
    totalComments: totalAnalytics._sum.comments || 0,
    totalShares: totalAnalytics._sum.shares || 0,
  };
}

// Get top performing posts
export async function getTopPosts(userId: string, limit: number = 5) {
  const posts = await prisma.post.findMany({
    where: {
      userId,
      status: 'published',
    },
    include: {
      analytics: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      analytics: {
        _count: 'desc',
      },
    },
    take: limit,
  });

  return posts
    .filter((p) => p.analytics.length > 0)
    .map((p) => ({
      ...p,
      metrics: p.analytics[0],
    }));
}

// Get engagement by day of week
export async function getEngagementByDay(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const analytics = await prisma.analytics.findMany({
    where: {
      userId,
      date: { gte: startDateStr },
    },
  });

  const dayStats: Record<string, { engagement: number; count: number }> = {
    sun: { engagement: 0, count: 0 },
    mon: { engagement: 0, count: 0 },
    tue: { engagement: 0, count: 0 },
    wed: { engagement: 0, count: 0 },
    thu: { engagement: 0, count: 0 },
    fri: { engagement: 0, count: 0 },
    sat: { engagement: 0, count: 0 },
  };

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  for (const record of analytics) {
    const date = new Date(record.date);
    const dayName = dayNames[date.getDay()];
    dayStats[dayName].engagement += record.engagement;
    dayStats[dayName].count++;
  }

  return Object.entries(dayStats).map(([day, stats]) => ({
    day,
    avgEngagement: stats.count > 0 ? Math.round(stats.engagement / stats.count) : 0,
    totalEngagement: stats.engagement,
    postCount: stats.count,
  }));
}
