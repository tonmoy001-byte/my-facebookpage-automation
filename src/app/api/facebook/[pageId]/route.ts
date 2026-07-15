// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { pageId } = await params;

    // Find the page and verify ownership
    const page = await prisma.facebookPage.findFirst({
      where: {
        id: pageId,
        userId: user.id,
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Delete the page
    await prisma.facebookPage.delete({
      where: { id: pageId },
    });

    return NextResponse.json({ message: 'Page disconnected successfully' });
  } catch (error: any) {
    console.error('Delete page error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status: 500 }
    );
  }
}
