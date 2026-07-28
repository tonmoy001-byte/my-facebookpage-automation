// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere, tenantData } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`facebook:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { message, imageUrl } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const page = await prisma.facebookPage.findFirst({
      where: tenantWhere(user.tenantId, { userId: user.id }),
    });

    if (!page) {
      return NextResponse.json({ error: 'No Facebook page connected. Go to Settings → Facebook to connect one.' }, { status: 400 });
    }

    const fbService = createFacebookService(page.accessToken, page.pageId);
    let facebookPostId: string;

    if (imageUrl && imageUrl.trim()) {
      const result = await fbService.postPhoto(imageUrl.trim(), message.trim());
      facebookPostId = result.id;
    } else {
      const result = await fbService.postToFeed(message.trim());
      facebookPostId = result.id;
    }

    const now = new Date();
    const mediaUrls = imageUrl ? [imageUrl.trim()] : [];

    const post = await prisma.post.create({
      data: tenantData(user.tenantId, {
        userId: user.id, pageId: page.id, content: message.trim(),
        mediaUrls, mediaType: imageUrl ? 'image' : 'text',
        brandVoice: 'direct', status: 'published', facebookPostId, publishedAt: now,
      }),
    });

    return NextResponse.json({ success: true, postId: post.id, facebookPostId, message: 'Published successfully to Facebook!' }, { status: 200 });
  } catch (error: any) {
    console.error('Direct publish error:', error);
    return NextResponse.json({ error: error.message || 'Failed to publish' }, { status: 500 });
  }
}
