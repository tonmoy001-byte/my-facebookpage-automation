// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createFacebookService, verifyWebhookSignature } from '@/lib/facebook';

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
    // Verify webhook signature if app secret is configured
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');
      const body = await request.text();

      if (signature && !verifyWebhookSignature(body, signature, appSecret)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ status: 'invalid signature' }, { status: 403 });
      }
    }

    const body = await request.json();

    // Verify this is a page event
    if (body.object !== 'page') {
      return NextResponse.json({ status: 'not page event' });
    }

    // Store webhook event for deduplication
    const eventId = body.entry?.[0]?.id + '-' + Date.now();

    // Process each entry
    for (const entry of body.entry) {
      const pageIdFromWebhook = entry.id;

      // Find the specific page that received this event
      const page = await prisma.facebookPage.findFirst({
        where: { pageId: pageIdFromWebhook },
      });

      if (!page) {
        console.log(`No connected page found for page ID: ${pageIdFromWebhook}`);
        continue;
      }

      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field === 'feed') {
          const value = change.value;

          // Handle new comments
          if (value.item === 'comment' && value.verb === 'add') {
            await handleNewComment(value, page);
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

async function handleNewComment(value: any, page: any) {
  const { comment_id, message, from, post_id } = value;

  if (!from?.id || !message) return;

  // Try to find the post in our database
  let postId = null;
  if (post_id) {
    const post = await prisma.post.findFirst({
      where: { facebookPostId: post_id },
    });
    if (post) postId = post.id;
  }

  // Check for matching reply rules for this tenant (priority order)
  const rules = await prisma.replyRule.findMany({
    where: {
      tenantId: page.tenantId,
      isActive: true,
    },
    orderBy: { priority: 'desc' },
  });

  let matchedRule = null;
  let replyText = null;

  for (const rule of rules) {
    if (shouldReply(rule, message)) {
      matchedRule = rule;

      // Use the rule's reply template
      if (rule.replyTemplate) {
        replyText = rule.replyTemplate;
      }
      break;
    }
  }

  // Store the comment
  const comment = await prisma.comment.create({
    data: {
      userId: page.userId,
      pageId: page.id,
      tenantId: page.tenantId,
      postId,
      ruleId: matchedRule?.id || null,
      facebookCommentId: comment_id,
      authorName: from.name || 'Unknown',
      authorId: from.id,
      content: message,
      status: matchedRule ? 'replied' : 'pending',
    },
  });

  // Send the auto-reply if a rule matched
  if (matchedRule && replyText) {
    try {
      const fbService = createFacebookService(page.accessToken, page.pageId);
      await fbService.replyToComment(comment_id, replyText);

      await prisma.comment.update({
        where: { id: comment.id },
        data: {
          reply: replyText,
          repliedAt: new Date(),
          status: 'replied',
        },
      });

      console.log(`Auto-replied to comment ${comment_id} using rule ${matchedRule.name}`);
    } catch (error) {
      console.error(`Failed to reply to comment ${comment_id}:`, error);
      await prisma.comment.update({
        where: { id: comment.id },
        data: { status: 'pending' },
      });
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
