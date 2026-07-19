// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { reply } = await request.json();

    if (!reply || !reply.trim()) {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
    }

    // Find the comment with tenant ownership
    const comment = await prisma.comment.findFirst({
      where: tenantWhere(user.tenantId, { id }),
      include: {
        page: true,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Send the reply to Facebook
    try {
      const fbService = createFacebookService(comment.page.accessToken, comment.page.pageId);
      await fbService.replyToComment(comment.facebookCommentId, reply);

      // Update the comment record
      const updatedComment = await prisma.comment.update({
        where: { id },
        data: {
          reply,
          repliedAt: new Date(),
          status: 'REPLIED',
          replyType: 'MANUAL',
        },
      });

      return NextResponse.json({ comment: updatedComment });
    } catch (fbError) {
      console.error('Failed to send Facebook reply:', fbError);
      return NextResponse.json(
        { error: 'Failed to send reply to Facebook. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Manual reply error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send reply' },
      { status: 500 }
    );
  }
}
