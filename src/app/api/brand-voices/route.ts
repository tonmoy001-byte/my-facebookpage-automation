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

    const voices = await prisma.brandVoice.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error('Get brand voices error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get brand voices' },
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

    const { name, description, tone, examples } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    const voice = await prisma.brandVoice.create({
      data: {
        userId: user.id,
        name,
        description,
        tone: tone || 'professional',
        examples: examples || [],
      },
    });

    return NextResponse.json({ voice }, { status: 201 });
  } catch (error: any) {
    console.error('Create brand voice error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create brand voice' },
      { status: 500 }
    );
  }
}
