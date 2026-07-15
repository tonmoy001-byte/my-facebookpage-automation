// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    const where: any = {
      userId: user.id,
    };

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        where.scheduledAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduledAt.lte = new Date(endDate);
      }
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        post: {
          select: {
            id: true,
            content: true,
            mediaUrls: true,
            status: true,
            brandVoice: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get schedule' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { postId, scheduledAt } = await request.json();

    if (!postId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Post ID and scheduled time are required' },
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

    // Verify the post belongs to the user
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        userId: user.id,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if post already has a schedule
    const existingSchedule = await prisma.schedule.findFirst({
      where: { postId },
    });

    if (existingSchedule) {
      // Update existing schedule
      const updatedSchedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: { scheduledAt: new Date(scheduledAt) },
      });

      // Update post status
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'scheduled' },
      });

      return NextResponse.json({ schedule: updatedSchedule });
    }

    // Create new schedule
    const schedule = await prisma.schedule.create({
      data: {
        postId,
        userId: user.id,
        scheduledAt: new Date(scheduledAt),
      },
    });

    // Update post status
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'scheduled' },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error: any) {
    console.error('Create schedule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create schedule' },
      { status: 500 }
    );
  }
}
