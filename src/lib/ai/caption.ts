// @ts-nocheck
import { callOpenRouter, imageToBase64DataUri, resolveBrandVoice, getLanguageInstruction, type OpenRouterMessage } from './client';

export interface GenerateCaptionOptions {
  tenantId?: string;
  imageUrl?: string;
  description: string;
  language?: string;
  brandVoiceId?: string;
  includeHashtags?: boolean;
  maxHashtags?: number;
  maxLength?: number;
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
}

export async function generateCaption(options: GenerateCaptionOptions): Promise<GeneratedCaption> {
  const {
    tenantId,
    imageUrl,
    description,
    language = 'EN',
    brandVoiceId,
    includeHashtags = true,
    maxHashtags = 5,
    maxLength = 500,
  } = options;

  const brandVoice = await resolveBrandVoice(brandVoiceId, tenantId);
  const langInstruction = getLanguageInstruction(language);

  // Build style guide from brandVoice
  const styleGuide = brandVoice.styleGuide
    ? `\nStyle Guide: ${brandVoice.styleGuide}`
    : '';
  const examples =
    brandVoice.examples.length > 0
      ? `\nExamples of your tone:\n${brandVoice.examples.map((e) => `- ${e}`).join('\n')}`
      : '';

  // Build messages
  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: `You are a professional social media content creator for Facebook Pages.
Generate engaging, authentic captions that match the brand voice and drive audience engagement.
Keep captions concise but impactful. Use appropriate emojis sparingly.
${langInstruction}
Brand Voice: ${brandVoice.tone}
${styleGuide}${examples}`,
    },
  ];

  // Build user prompt
  let userPrompt = `Description: ${description}`;

  // Handle image — send as multimodal if URL provided
  if (imageUrl) {
    userPrompt += `\n\nAnalyze this image and use its content to enhance the caption. The image shows what the post is about.`;

    const dataUri = await imageToBase64DataUri(imageUrl);

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  // Add hashtag instruction
  if (includeHashtags) {
    messages.push({
      role: 'user',
      content: `Also generate ${maxHashtags} relevant hashtags for this post. Make them ${brandVoice.tone.toLowerCase()} in style.`,
    });
  }

  messages.push({
    role: 'user',
    content: `Maximum ${maxLength} characters for the caption.

Format your response as JSON:
{
  "caption": "your caption here",
  "hashtags": ["hashtag1", "hashtag2"]
}${includeHashtags ? '' : '\nSet hashtags to an empty array.'}`,
  });

  const content = await callOpenRouter(messages, { tenantId, maxTokens: 1000 });

  try {
    const parsed = JSON.parse(content);
    return {
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  } catch {
    // Fallback: extract caption and hashtags from text
    const lines = content.split('\n');
    const caption = lines
      .filter((line: string) => !line.startsWith('#') && !line.startsWith('['))
      .join(' ')
      .trim();
    const hashtagMatches = content.match(/#\w+/g) || [];
    return {
      caption: caption || description,
      hashtags: hashtagMatches.map((h: string) => h.substring(1)),
    };
  }
}
