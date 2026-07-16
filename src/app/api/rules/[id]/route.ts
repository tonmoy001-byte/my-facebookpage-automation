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

    const rule = await prisma.replyRule.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error: any) {
    console.error('Get rule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get rule' },
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
    const {
      name,
      type,
      keywords,
      sentiment,
      daysOfWeek,
      startTime,
      endTime,
      replyTemplate,
      action,
      priority,
      isActive,
    } = await request.json();

    const rule = await prisma.replyRule.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const updatedRule = await prisma.replyRule.update({
      where: { id },
      data: {
        name: name || rule.name,
        type: type || rule.type,
        keywords: keywords || rule.keywords,
        sentiment: sentiment || rule.sentiment,
        daysOfWeek: daysOfWeek || rule.daysOfWeek,
        startTime: startTime || rule.startTime,
        endTime: endTime || rule.endTime,
        replyTemplate: replyTemplate || rule.replyTemplate,
        action: action || rule.action,
        priority: priority || rule.priority,
        isActive: isActive !== undefined ? isActive : rule.isActive,
      },
    });

    return NextResponse.json({ rule: updatedRule });
  } catch (error: any) {
    console.error('Update rule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update rule' },
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

    const rule = await prisma.replyRule.findFirst({
      where: tenantWhere(user.tenantId, { id, userId: user.id }),
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.replyRule.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Rule deleted successfully' });
  } catch (error: any) {
    console.error('Delete rule error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
