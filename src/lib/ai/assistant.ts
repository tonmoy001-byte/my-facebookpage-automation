// @ts-nocheck
import { prisma, tenantWhere, tenantData } from '../prisma';
import { getApiKey, getModel, resolveBrandVoice, getLanguageInstruction, type OpenRouterMessage } from './client';
import { generateImage } from './image-gen';
import { uploadBase64ToCloudinary } from './upload';
import { generateCaption } from './caption';
import { createFacebookService } from '../facebook';
import { getSummaryStats } from '../analytics';
import { ASSISTANT_TOOLS, type ToolDefinition } from './tools';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const MAX_TOOL_ITERATIONS = 5;

export interface ToolResult {
  tool: string;
  status: 'success' | 'error';
  data: any;
  error?: string;
}

export interface AssistantResponse {
  content: string;
  toolResults: ToolResult[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

async function buildSystemPrompt(tenantId: string, userId: string): Promise<string> {
  const [pages, voices, settings] = await Promise.all([
    prisma.facebookPage.findMany({
      where: tenantWhere(tenantId, { userId }),
      select: { pageName: true, pageId: true },
    }),
    prisma.brandVoice.findMany({
      where: tenantWhere(tenantId, {}),
      select: { id: true, name: true, slug: true },
    }),
    prisma.aISettings.findUnique({ where: { tenantId } }),
  ]);

  const pageList = pages.length > 0
    ? pages.map((p: any) => `- ${p.pageName} (ID: ${p.pageId})`).join('\n')
    : 'No pages connected. Tell the user to connect a Facebook page in Settings first.';

  const voiceList = voices.length > 0
    ? voices.map((v: any) => `- ${v.name} (ID: ${v.id})`).join('\n')
    : 'No custom brand voices. Use default professional tone.';

  const language = settings?.defaultLanguage || 'EN';

  return `You are an AI assistant for a Facebook Page management SaaS. You help users manage their Facebook presence through natural language commands.

You can:
- Generate images using AI (describe what you want, the system generates it)
- Generate captions and hashtags for posts
- Create draft posts or schedule them for later
- Publish posts directly to Facebook
- Check page analytics
- View and reply to comments
- Manage auto-reply rules

Connected Facebook pages:
${pageList}

Available brand voices:
${voiceList}

Default language: ${language}

IMPORTANT RULES:
- When generating image prompts, be very detailed and descriptive (style, colors, composition, mood)
- When creating posts, always include relevant hashtags unless the user says otherwise
- When scheduling, convert relative times ("tomorrow at 8pm") to ISO 8601 format using the user's context
- Confirm what you did after each action
- If a required connected page is missing, tell the user to connect one in Settings
- Be helpful, concise, and conversational`;
}

async function executeTool(
  name: string,
  args: Record<string, any>,
  tenantId: string,
  userId: string
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'generate_image': {
        const { prompt, aspect_ratio } = args;
        const result = await generateImage({ prompt, aspectRatio: aspect_ratio, tenantId });
        const folder = `fb-saas/${userId}/assistant`;
        const uploaded = await uploadBase64ToCloudinary(result.base64, folder, result.mimeType);
        return { tool: name, status: 'success', data: { imageUrl: uploaded.url, publicId: uploaded.publicId, prompt } };
      }

      case 'generate_caption': {
        const { description, language, brand_voice_id, include_hashtags } = args;
        const result = await generateCaption({
          tenantId,
          description,
          language,
          brandVoiceId: brand_voice_id,
          includeHashtags: include_hashtags !== false,
        });
        return { tool: name, status: 'success', data: result };
      }

      case 'create_post': {
        const { caption, hashtags, image_url, scheduled_at, brand_voice_id, language, auto_reply } = args;

        const page = await prisma.facebookPage.findFirst({
          where: tenantWhere(tenantId, { userId }),
        });
        if (!page) {
          return { tool: name, status: 'error', data: null, error: 'No Facebook page connected. Ask user to connect one in Settings.' };
        }

        const hashtagText = hashtags?.length ? '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ') : '';
        const content = caption + hashtagText;
        const mediaUrls = image_url ? [image_url] : [];
        const mediaType = image_url ? 'image' : 'text';

        const post = await prisma.post.create({
          data: tenantData(tenantId, {
            userId,
            pageId: page.id,
            content,
            mediaUrls,
            mediaType,
            brandVoice: brand_voice_id || 'professional',
            status: scheduled_at ? 'scheduled' : 'draft',
            autoReply: auto_reply === true,
            language: language || 'EN',
          }),
        });

        let scheduledJob = null;
        if (scheduled_at) {
          const scheduledDate = new Date(scheduled_at);
          scheduledJob = await prisma.publishJob.create({
            data: {
              postId: post.id,
              userId,
              tenantId,
              scheduledAt: scheduledDate,
              timezone: 'UTC',
            },
          });

          try {
            const { schedulePublishJob } = await import('../queue');
            await schedulePublishJob(scheduledJob.id, scheduledDate);
          } catch (e) {
            console.warn('Redis not available for scheduling:', e);
          }
        }

        return {
          tool: name,
          status: 'success',
          data: {
            postId: post.id,
            status: post.status,
            scheduledAt: scheduledJob?.scheduledAt || null,
            hasImage: !!image_url,
          },
        };
      }

      case 'publish_now': {
        const { message, image_url } = args;

        const page = await prisma.facebookPage.findFirst({
          where: tenantWhere(tenantId, { userId }),
        });
        if (!page) {
          return { tool: name, status: 'error', data: null, error: 'No Facebook page connected.' };
        }

        const fbService = createFacebookService(page.accessToken, page.pageId);
        let facebookPostId: string;

        if (image_url) {
          const result = await fbService.postPhoto(image_url, message);
          facebookPostId = result.id;
        } else {
          const result = await fbService.postToFeed(message);
          facebookPostId = result.id;
        }

        const post = await prisma.post.create({
          data: tenantData(tenantId, {
            userId,
            pageId: page.id,
            content: message,
            mediaUrls: image_url ? [image_url] : [],
            mediaType: image_url ? 'image' : 'text',
            brandVoice: 'direct',
            status: 'published',
            facebookPostId,
            publishedAt: new Date(),
          }),
        });

        return {
          tool: name,
          status: 'success',
          data: { postId: post.id, facebookPostId, message: 'Published to Facebook!' },
        };
      }

      case 'get_analytics': {
        const { days } = args;
        const stats = await getSummaryStats(userId, tenantId, days || 30);
        return { tool: name, status: 'success', data: stats };
      }

      case 'get_comments': {
        const { status, limit } = args;
        const where: any = tenantWhere(tenantId, { userId });
        if (status) where.status = status;

        const comments = await prisma.comment.findMany({
          where,
          include: { page: { select: { pageName: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit || 10,
        });

        return { tool: name, status: 'success', data: { comments, total: comments.length } };
      }

      case 'reply_to_comment': {
        const { comment_id, reply_text } = args;

        const comment = await prisma.comment.findUnique({
          where: { id: comment_id },
          include: { page: true },
        });
        if (!comment) {
          return { tool: name, status: 'error', data: null, error: 'Comment not found.' };
        }
        if (!comment.page) {
          return { tool: name, status: 'error', data: null, error: 'Page not found for this comment.' };
        }

        const fbService = createFacebookService(comment.page.accessToken, comment.page.pageId);
        await fbService.replyToComment(comment.facebookCommentId, reply_text);

        await prisma.comment.update({
          where: { id: comment_id },
          data: { status: 'REPLIED', responseText: reply_text },
        });

        return { tool: name, status: 'success', data: { commentId: comment_id, replyText: reply_text } };
      }

      case 'list_rules': {
        const rules = await prisma.replyRule.findMany({
          where: tenantWhere(tenantId, { userId }),
          orderBy: { priority: 'desc' },
        });
        return { tool: name, status: 'success', data: { rules } };
      }

      case 'create_rule': {
        const { name: ruleName, type, keywords, sentiment, reply_template, action, priority } = args;

        const highestPriority = await prisma.replyRule.findFirst({
          where: tenantWhere(tenantId, { userId }),
          orderBy: { priority: 'desc' },
          select: { priority: true },
        });

        const rule = await prisma.replyRule.create({
          data: tenantData(tenantId, {
            userId,
            name: ruleName,
            type,
            keywords: keywords || [],
            sentiment,
            replyTemplate: reply_template || null,
            action: action || 'reply',
            priority: priority || (highestPriority?.priority || 0) + 1,
          }),
        });

        return { tool: name, status: 'success', data: { ruleId: rule.id, name: rule.name } };
      }

      default:
        return { tool: name, status: 'error', data: null, error: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    console.error(`[Assistant] Tool ${name} error:`, error);
    return { tool: name, status: 'error', data: null, error: error.message || 'Tool execution failed' };
  }
}

async function callGeminiWithTools(
  messages: ChatMessage[],
  tenantId: string
): Promise<{ content: string | null; toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }> }> {
  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`Unexpected Gemini response: ${JSON.stringify(data).substring(0, 500)}`);
  }

  const message = data.choices[0].message;

  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));
    return { content: message.content || null, toolCalls };
  }

  return { content: message.content || '', toolCalls: [] };
}

export async function processAssistantMessage(options: {
  message: string;
  tenantId: string;
  userId: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<AssistantResponse> {
  const { message, tenantId, userId, history = [] } = options;

  const systemPrompt = await buildSystemPrompt(tenantId, userId);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message },
  ];

  const toolResults: ToolResult[] = [];
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;
    const result = await callGeminiWithTools(messages, tenantId);

    if (result.toolCalls.length === 0) {
      return { content: result.content || 'Done!', toolResults };
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: result.content || undefined,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });

    // Execute each tool call
    for (const tc of result.toolCalls) {
      const toolResult = await executeTool(tc.name, tc.arguments, tenantId, userId);
      toolResults.push(toolResult);

      // Add tool response message
      messages.push({
        role: 'tool',
        content: JSON.stringify(toolResult),
        tool_call_id: tc.id,
      });
    }
  }

  // After max iterations, get final response
  const finalResult = await callGeminiWithTools(messages, tenantId);
  return { content: finalResult.content || 'I completed the requested actions.', toolResults };
}
