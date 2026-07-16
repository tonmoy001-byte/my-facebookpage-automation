// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return global brand voices + tenant-specific brand voices
    const voices = await prisma.brandVoice.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { tenantId: user.tenantId },
        ],
      },
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

    const { name, description, tone, styleGuide, examples } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const voice = await prisma.brandVoice.create({
      data: {
        name,
        slug,
        description,
        tone: tone || 'professional',
        styleGuide: styleGuide || '',
        examples: examples || [],
        isDefault: false,
        isGlobal: false,
        tenantId: user.tenantId,
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
