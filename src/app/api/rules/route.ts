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

    const rules = await prisma.replyRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Get rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get rules' },
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

    const {
      name,
      type,
      keywords,
      sentiment,
      daysOfWeek,
      startTime,
      endTime,
      responseTemplate,
      useAI,
      brandVoiceId,
      priority,
    } = await request.json();

    if (!name || !type || !responseTemplate) {
      return NextResponse.json(
        { error: 'Name, type, and response template are required' },
        { status: 400 }
      );
    }

    // Validate type-specific fields
    if (type === 'keyword' && (!keywords || keywords.length === 0)) {
      return NextResponse.json(
        { error: 'Keywords are required for keyword rules' },
        { status: 400 }
      );
    }

    if (type === 'sentiment' && !sentiment) {
      return NextResponse.json(
        { error: 'Sentiment is required for sentiment rules' },
        { status: 400 }
      );
    }

    if (type === 'time' && (!daysOfWeek || !startTime || !endTime)) {
      return NextResponse.json(
        { error: 'Days and time range are required for time rules' },
        { status: 400 }
      );
    }

    // Get the highest priority to set new rule at top
    const highestPriority = await prisma.replyRule.findFirst({
      where: { userId: user.id },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });

    const rule = await prisma.replyRule.create({
      data: {
        userId: user.id,
        name,
        type,
        keywords: keywords || [],
        sentiment,
        daysOfWeek: daysOfWeek || [],
        startTime,
        endTime,
        responseTemplate,
        useAI: useAI || false,
        brandVoiceId: brandVoiceId || null,
        priority: priority || (highestPriority?.priority || 0) + 1,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    console.error('Create rule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create rule' },
      { status: 500 }
    );
  }
}
