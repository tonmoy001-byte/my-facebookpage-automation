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
    const body = await request.text();

    // Verify webhook signature if app secret is configured
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');

      if (!signature || !verifyWebhookSignature(body, signature, appSecret)) {
        console.error('Invalid or missing webhook signature');
        return NextResponse.json({ status: 'invalid signature' }, { status: 403 });
      }
    }

    const parsed = JSON.parse(body);

    // Verify this is a page event
    if (parsed.object !== 'page') {
      return NextResponse.json({ status: 'not page event' });
    }

    // Store webhook event for deduplication
    const eventId = parsed.entry?.[0]?.id + '-' + Date.now();

    // Process each entry
    for (const entry of parsed.entry) {
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

      // Handle different action types
      if (rule.action === 'escalate') {
        // Escalate: store comment but do NOT auto-reply
        replyText = null;
      } else if (rule.action === 'ai_reply') {
        // AI reply: generate using AI with brand voice from rule
        try {
          const { generateReply } = await import('@/lib/ai');
          replyText = await generateReply(message, 'professional');
        } catch (aiError) {
          console.error('AI reply generation failed, falling back to template:', aiError);
          replyText = rule.replyTemplate || null;
        }
      } else {
        // Template reply (default): use replyTemplate with variable substitution
        replyText = rule.replyTemplate || null;
      }

      // Replace template variables
      if (replyText) {
        replyText = replyText.replace(/{name}/g, from.name || 'there');
        replyText = replyText.replace(/{comment}/g, message);
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
      status: matchedRule ? (replyText ? 'replied' : 'pending') : 'pending',
    },
  });

  // Send the auto-reply if a rule matched and we have reply text (not escalated)
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

      console.log(`Auto-replied to comment ${comment_id} using rule ${matchedRule.name} (action: ${matchedRule.action})`);
    } catch (error) {
      console.error(`Failed to reply to comment ${comment_id}:`, error);
      await prisma.comment.update({
        where: { id: comment.id },
        data: { status: 'pending' },
      });
    }
  } else if (matchedRule && matchedRule.action === 'escalate') {
    console.log(`Comment ${comment_id} escalated (rule: ${matchedRule.name}), no auto-reply sent`);
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
