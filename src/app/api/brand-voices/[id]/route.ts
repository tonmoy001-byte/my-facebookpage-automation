// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';

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

    const voice = await prisma.brandVoice.findFirst({
      where: {
        id,
        OR: [
          { isGlobal: true },
          { tenantId: user.tenantId },
        ],
      },
    });

    if (!voice) {
      return NextResponse.json({ error: 'Brand voice not found' }, { status: 404 });
    }

    return NextResponse.json({ voice });
  } catch (error: any) {
    console.error('Get brand voice error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get brand voice' },
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
    const { name, description, tone, styleGuide, examples } = await request.json();

    // Only allow editing tenant-specific or owned voices, not global ones
    const voice = await prisma.brandVoice.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        isGlobal: false,
      },
    });

    if (!voice) {
      return NextResponse.json({ error: 'Brand voice not found' }, { status: 404 });
    }

    const updatedVoice = await prisma.brandVoice.update({
      where: { id },
      data: {
        name: name || voice.name,
        description: description || voice.description,
        tone: tone || voice.tone,
        styleGuide: styleGuide || voice.styleGuide,
        examples: examples || voice.examples,
      },
    });

    return NextResponse.json({ voice: updatedVoice });
  } catch (error: any) {
    console.error('Update brand voice error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update brand voice' },
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

    const voice = await prisma.brandVoice.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        isGlobal: false,
      },
    });

    if (!voice) {
      return NextResponse.json({ error: 'Brand voice not found' }, { status: 404 });
    }

    await prisma.brandVoice.delete({ where: { id } });

    return NextResponse.json({ message: 'Brand voice deleted successfully' });
  } catch (error: any) {
    console.error('Delete brand voice error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete brand voice' },
      { status: 500 }
    );
  }
}
