// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/facebook';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify this is a page event
    if (body.object !== 'page') {
      return NextResponse.json({ status: 'not page event' });
    }

    // Process each entry
    for (const entry of body.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field === 'feed') {
          const value = change.value;

          // Handle new comments
          if (value.item === 'comment' && value.verb === 'add') {
            await handleNewComment(value);
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

async function handleNewComment(value: any) {
  const { comment_id, message, from, post_id } = value;

  if (!from?.id || !message) return;

  // Find the page by checking all connected pages
  // In production, you'd want to match by page ID from the webhook entry
  const pages = await prisma.facebookPage.findMany();

  for (const page of pages) {
    // Store the comment for processing
    await prisma.comment.create({
      data: {
        pageId: page.id,
        facebookCommentId: comment_id,
        authorName: from.name || 'Unknown',
        authorId: from.id,
        content: message,
      },
    });

    // Check for matching reply rules
    const rules = await prisma.replyRule.findMany({
      where: {
        userId: page.userId,
        isActive: true,
      },
    });

    for (const rule of rules) {
      if (shouldReply(rule, message)) {
        // Generate and send reply (will be implemented in Phase 5)
        console.log(`Would reply to comment ${comment_id} using rule ${rule.name}`);
        break;
      }
    }
  }
}

function shouldReply(rule: any, message: string): boolean {
  const lowerMessage = message.toLowerCase();

  switch (rule.type) {
    case 'keyword':
      return rule.keywords.some((keyword: string) =>
        lowerMessage.includes(keyword.toLowerCase())
      );

    case 'sentiment':
      // Simple sentiment check - in production, use AI
      if (rule.sentiment === 'positive') {
        return /\b(love|great|awesome|amazing|thank|good|nice|happy)\b/i.test(message);
      }
      if (rule.sentiment === 'negative') {
        return /\b(hate|bad|terrible|awful|worst|angry|upset|disappointed)\b/i.test(message);
      }
      return true;

    case 'time':
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const currentDay = dayNames[now.getDay()];

      if (!rule.daysOfWeek.includes(currentDay)) return false;
      if (rule.startTime && rule.endTime) {
        return currentTime >= rule.startTime && currentTime <= rule.endTime;
      }
      return true;

    default:
      return false;
  }
}
