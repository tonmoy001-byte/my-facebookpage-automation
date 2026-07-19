// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere, tenantData } from '@/lib/prisma';

/**
 * POST /api/facebook/publish
 * Publish a post directly to Facebook (bypasses queue).
 * Body: { message: string, imageUrl?: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { message, imageUrl } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Find connected Facebook page
    const page = await prisma.facebookPage.findFirst({
      where: tenantWhere(user.tenantId, { userId: user.id }),
    });

    if (!page) {
      return NextResponse.json(
        { error: 'No Facebook page connected. Go to Settings → Facebook to connect one.' },
        { status: 400 }
      );
    }

    // Build Facebook Graph API request
    let facebookPostId: string;

    if (imageUrl && imageUrl.trim()) {
      // Post with image
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${page.pageId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: imageUrl.trim(),
            caption: message.trim(),
            access_token: page.accessToken,
          }),
        }
      );
      const data = await response.json();
      if (data.error) {
        return NextResponse.json(
          { error: `Facebook API error: ${data.error.message}` },
          { status: 400 }
        );
      }
      facebookPostId = data.id;
    } else {
      // Text-only post
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${page.pageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            access_token: page.accessToken,
          }),
        }
      );
      const data = await response.json();
      if (data.error) {
        return NextResponse.json(
          { error: `Facebook API error: ${data.error.message}` },
          { status: 400 }
        );
      }
      facebookPostId = data.id;
    }

    // Save to DB
    const now = new Date();
    const mediaUrls = imageUrl ? [imageUrl.trim()] : [];

    const post = await prisma.post.create({
      data: tenantData(user.tenantId, {
        userId: user.id,
        pageId: page.id,
        content: message.trim(),
        mediaUrls,
        mediaType: imageUrl ? 'image' : 'text',
        brandVoice: 'direct',
        status: 'published',
        facebookPostId,
        publishedAt: now,
      }),
    });

    return NextResponse.json({
      success: true,
      postId: post.id,
      facebookPostId,
      message: 'Published successfully to Facebook!',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Direct publish error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish' },
      { status: 500 }
    );
  }
}
