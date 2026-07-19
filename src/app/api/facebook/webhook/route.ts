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

  // Idempotency: check if comment already processed
  const existingComment = await prisma.comment.findUnique({
    where: { facebookCommentId: comment_id },
  });
  if (existingComment) {
    console.log(`Comment ${comment_id} already processed, skipping`);
    return;
  }

  // Find the post in our database
  let postId = null;
  let post = null;
  if (post_id) {
    post = await prisma.post.findFirst({
      where: { facebookPostId: post_id },
    });
    if (post) postId = post.id;
  }

  // Create comment record immediately with PROCESSING status
  const comment = await prisma.comment.create({
    data: {
      userId: page.userId,
      pageId: page.id,
      tenantId: page.tenantId,
      postId,
      facebookCommentId: comment_id,
      authorName: from.name || 'Unknown',
      authorId: from.id,
      content: message,
      status: 'PROCESSING',
    },
  });

  // Early exit: no post found
  if (!post) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'PENDING' },
    });
    return;
  }

  // Early exit: auto-reply not enabled on this post
  if (!post.autoReply) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'PENDING' },
    });
    return;
  }

  // Find matching reply rules (priority order)
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

      if (rule.action === 'escalate') {
        // Escalate: store but do NOT reply
        replyText = null;
      } else if (rule.action === 'ai_reply') {
        // AI reply: generate using AI with language detection
        try {
          const { generateReply } = await import('@/lib/ai/reply');
          const result = await generateReply({
            comment: message,
            postContent: post.content,
            brandVoiceId: rule.brandVoiceId,
            tenantId: page.tenantId,
            pageName: page.pageName,
          });
          replyText = result.reply;

          // Update comment with AI metadata
          await prisma.comment.update({
            where: { id: comment.id },
            data: {
              replyType: 'AI',
              brandVoiceId: result.brandVoiceId,
              modelUsed: result.modelUsed,
            },
          });
        } catch (aiError) {
          console.error('AI reply generation failed, falling back to template:', aiError);
          replyText = rule.replyTemplate || null;
          if (replyText) {
            await prisma.comment.update({
              where: { id: comment.id },
              data: { replyType: 'TEMPLATE' },
            });
          }
        }
      } else {
        // Template reply (default)
        replyText = rule.replyTemplate || null;
        if (replyText) {
          await prisma.comment.update({
            where: { id: comment.id },
            data: { replyType: 'TEMPLATE' },
          });
        }
      }

      // Replace template variables
      if (replyText) {
        replyText = replyText.replace(/{name}/g, from.name || 'there');
        replyText = replyText.replace(/{comment}/g, message);
        replyText = replyText.replace(/{postTitle}/g, (post.content || '').substring(0, 100));
        replyText = replyText.replace(/{pageName}/g, page.pageName || 'our page');
      }
      break;
    }
  }

  // Update comment with rule match info
  await prisma.comment.update({
    where: { id: comment.id },
    data: {
      ruleId: matchedRule?.id || null,
    },
  });

  // No rule matched — mark as PENDING
  if (!matchedRule) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'PENDING' },
    });
    return;
  }

  // Escalated — mark as ESCALATED
  if (matchedRule.action === 'escalate') {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'ESCALATED' },
    });
    return;
  }

  // No reply text generated — mark as PENDING
  if (!replyText) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'PENDING' },
    });
    return;
  }

  // Send the Facebook reply (with retry)
  try {
    const fbService = createFacebookService(page.accessToken, page.pageId);
    await fbService.replyToComment(comment_id, replyText);

    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        reply: replyText,
        repliedAt: new Date(),
        status: 'REPLIED',
      },
    });

    console.log(`Auto-replied to comment ${comment_id} using rule ${matchedRule.name} (action: ${matchedRule.action})`);
  } catch (error) {
    console.error(`Failed to reply to comment ${comment_id}, retrying once:`, error);

    // Retry once
    try {
      const fbService = createFacebookService(page.accessToken, page.pageId);
      await fbService.replyToComment(comment_id, replyText);

      await prisma.comment.update({
        where: { id: comment.id },
        data: {
          reply: replyText,
          repliedAt: new Date(),
          status: 'REPLIED',
        },
      });
    } catch (retryError) {
      console.error(`Retry failed for comment ${comment_id}:`, retryError);
      await prisma.comment.update({
        where: { id: comment.id },
        data: { status: 'FAILED' },
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
