// @ts-nocheck
import { prisma, tenantWhere } from './prisma';
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
    await prisma.analytics.create({
      data: {
        postId,
        userId: post.userId,
        tenantId: post.tenantId,
        postType: 'post',
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        reach: metrics.reach,
      },
    });

    return metrics;
  } catch (error) {
    console.error(`Failed to collect metrics for post ${postId}:`, error);
    return null;
  }
}

// Get analytics for a user with date filtering (tenant-scoped)
export async function getAnalytics(
  userId: string,
  tenantId: string,
  startDate?: string,
  endDate?: string
) {
  const where: any = tenantWhere(tenantId, { userId });

  if (startDate || endDate) {
    where.collectedAt = {};
    if (startDate) where.collectedAt.gte = new Date(startDate);
    if (endDate) where.collectedAt.lte = new Date(endDate);
  }

  const analytics = await prisma.analytics.findMany({
    where,
    include: {
      post: {
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          createdAt: true,
        },
      },
    },
    orderBy: { collectedAt: 'desc' },
  });

  return analytics;
}

// Get summary stats for a user (tenant-scoped)
export async function getSummaryStats(userId: string, tenantId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where = tenantWhere(tenantId, { userId });

  const [totalPosts, publishedPosts, scheduledPosts, totalAnalytics] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.count({ where: { ...where, status: 'published' } }),
    prisma.post.count({ where: { ...where, status: 'scheduled' } }),
    prisma.analytics.aggregate({
      where: {
        ...where,
        collectedAt: { gte: startDate },
      },
      _sum: {
        reach: true,
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
    totalReach: totalAnalytics._sum.reach || 0,
    totalLikes: totalAnalytics._sum.likes || 0,
    totalComments: totalAnalytics._sum.comments || 0,
    totalShares: totalAnalytics._sum.shares || 0,
    totalEngagement: (totalAnalytics._sum.likes || 0) + (totalAnalytics._sum.comments || 0) + (totalAnalytics._sum.shares || 0),
  };
}

// Get top performing posts (tenant-scoped)
export async function getTopPosts(userId: string, tenantId: string, limit: number = 5) {
  const where = tenantWhere(tenantId, { userId, status: 'published' });

  const posts = await prisma.post.findMany({
    where,
    include: {
      analytics: {
        orderBy: { collectedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      analytics: { _count: 'desc' },
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

// Get engagement by day of week (tenant-scoped)
export async function getEngagementByDay(userId: string, tenantId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analytics = await prisma.analytics.findMany({
    where: tenantWhere(tenantId, {
      userId,
      collectedAt: { gte: startDate },
    }),
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
    const date = new Date(record.collectedAt);
    const dayName = dayNames[date.getDay()];
    const engagement = record.likes + record.comments + record.shares;
    dayStats[dayName].engagement += engagement;
    dayStats[dayName].count++;
  }

  return Object.entries(dayStats).map(([day, stats]) => ({
    day,
    avgEngagement: stats.count > 0 ? Math.round(stats.engagement / stats.count) : 0,
    totalEngagement: stats.engagement,
    postCount: stats.count,
  }));
}
