// @ts-nocheck
import { callOpenRouter, resolveBrandVoice, getLanguageInstruction, getModel, type OpenRouterMessage } from './client';

export interface GenerateReplyOptions {
  comment: string;
  postContent?: string;
  brandVoiceId?: string;
  tenantId?: string;
  pageName?: string;
}

export interface ReplyResult {
  reply: string;
  detectedLanguage: string;
  brandVoiceId: string;
  modelUsed: string;
}

// Detect language from comment text
export function detectLanguage(text: string): string {
  // Count Bangla Unicode characters (\u0980-\u09FF)
  const banglaChars = text.match(/[\u0980-\u09FF]/g) || [];
  const totalChars = text.replace(/\s/g, '').length;

  if (totalChars === 0) return 'EN';

  const banglaRatio = banglaChars.length / totalChars;
  if (banglaRatio > 0.3) return 'BN';

  // If no Bangla and only ASCII, it's English
  const nonAscii = text.match(/[^\x00-\x7F]/g) || [];
  if (nonAscii.length === 0) return 'EN';

  // Mixed content — default to English
  return 'EN';
}

export async function generateReply(options: GenerateReplyOptions): Promise<ReplyResult> {
  const {
    comment,
    postContent,
    brandVoiceId,
    tenantId,
    pageName,
  } = options;

  const brandVoice = await resolveBrandVoice(brandVoiceId, tenantId);
  const detectedLang = detectLanguage(comment);
  const langInstruction = getLanguageInstruction(detectedLang);

  // Build style context
  const styleContext = brandVoice.styleGuide
    ? `\nStyle Guide: ${brandVoice.styleGuide}`
    : '';
  const examplesContext =
    brandVoice.examples.length > 0
      ? `\nExamples of your tone:\n${brandVoice.examples.map((e) => `- ${e}`).join('\n')}`
      : '';

  const postContext = postContent
    ? `\nPost content for context: "${postContent.substring(0, 200)}"`
    : '';

  const pageContext = pageName
    ? `\nPage name: ${pageName}`
    : '';

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: `You are a social media manager responding to comments on a Facebook page.
${langInstruction}
Brand Voice: ${brandVoice.tone}
${styleContext}${examplesContext}${postContext}${pageContext}

Rules:
- Keep replies under 200 characters
- Be genuine and helpful
- Match the language of the comment
- Use the commenter's name naturally if appropriate
- Do not use hashtags in replies
- Do not be overly promotional`,
    },
    {
      role: 'user',
      content: `Comment: "${comment}"
Author name: "${comment.match(/^@\w+/)?.[0]?.substring(1) || 'there'}"

Generate a brief, appropriate reply.`,
    },
  ];

  const reply = await callOpenRouter(messages, { tenantId, maxTokens: 200 });
  const modelUsed = await getModel(tenantId);

  return {
    reply: reply.trim(),
    detectedLanguage: detectedLang,
    brandVoiceId: brandVoice.id,
    modelUsed,
  };
}
