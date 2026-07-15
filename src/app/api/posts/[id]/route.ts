// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        brandVoice: true,
        schedules: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Get post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get post' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { caption, hashtags, imageUrl, brandVoiceId, status, scheduledAt } =
      await request.json();

    const post = await prisma.post.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        caption: caption || post.caption,
        hashtags: hashtags || post.hashtags,
        imageUrl: imageUrl || post.imageUrl,
        brandVoiceId: brandVoiceId || post.brandVoiceId,
        status: status || post.status,
      },
    });

    // Update schedule if provided
    if (scheduledAt) {
      await prisma.schedule.updateMany({
        where: { postId: id },
        data: { scheduledAt: new Date(scheduledAt) },
      });
    }

    return NextResponse.json({ post: updatedPost });
  } catch (error: any) {
    console.error('Update post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    );
  }
}

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

    const post = await prisma.post.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Delete related schedules first
    await prisma.schedule.deleteMany({
      where: { postId: id },
    });

    // Delete the post
    await prisma.post.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
}
