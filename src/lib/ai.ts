// @ts-nocheck
import axios from 'axios';
import { prisma } from './prisma';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface GenerateCaptionOptions {
  tenantId?: string;
  imageUrl?: string;
  description: string;
  brandVoice?: string;
  hashtags?: boolean;
  maxHashtags?: number;
  tone?: string;
  maxLength?: number;
}

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
}

const SYSTEM_PROMPT = `You are a professional social media content creator for Facebook Pages.
Generate engaging, authentic captions that match the brand voice and drive audience engagement.
Keep captions concise but impactful. Use appropriate emojis sparingly.
Always follow the specified tone and style.`;

const BRAND_VOICE_PROMPTS: Record<string, string> = {
  professional: 'Write in a professional, authoritative tone. Use industry expertise and credibility.',
  casual: 'Write in a friendly, conversational tone. Be approachable and relatable.',
  emotional: 'Write with emotion and empathy. Connect on a personal level with the audience.',
  tech_startup: 'Write in a modern, innovative tone. Use tech-savvy language and forward-thinking ideas.',
  local_business: 'Write in a warm, community-focused tone. Emphasize local connections and trust.',
  ecommerce: 'Write in a persuasive, product-focused tone. Highlight benefits and create urgency.',
  educational: 'Write in an informative, helpful tone. Teach and provide value to the audience.',
  entertainment: 'Write in a fun, engaging tone. Use humor and excitement to captivate readers.',
  health_wellness: 'Write in a supportive, encouraging tone. Focus on wellbeing and positive change.',
  luxury: 'Write in an elegant, sophisticated tone. Emphasize exclusivity and premium quality.',
};

// Look up tenant-specific AI API key, fallback to env var
async function getApiKey(tenantId?: string): Promise<string> {
  if (tenantId) {
    const credential = await prisma.aICredential.findFirst({
      where: { tenantId, provider: 'openrouter' },
    });
    if (credential?.apiKey) return credential.apiKey;
  }
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  throw new Error('No AI API key configured. Add your OpenRouter key in Settings > AI.');
}

// Look up tenant-specific model, fallback to default
async function getModel(tenantId?: string): Promise<string> {
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.defaultModel) return settings.defaultModel;
  }
  return 'google/gemini-2.5-flash';
}

// Look up tenant-specific temperature
async function getTemperature(tenantId?: string): Promise<number> {
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.temperature != null) return settings.temperature;
  }
  return 0.7;
}

export async function generateCaption(options: GenerateCaptionOptions): Promise<GeneratedContent> {
  const { tenantId, imageUrl, description, brandVoice = 'professional', hashtags = true, maxHashtags = 5, tone, maxLength = 500 } = options;

  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);
  const temperature = await getTemperature(tenantId);

  const voicePrompt = BRAND_VOICE_PROMPTS[brandVoice] || BRAND_VOICE_PROMPTS.professional;
  const toneInstruction = tone ? `Tone: ${tone}.` : '';

  let userPrompt = `Brand Voice: ${voicePrompt}
${toneInstruction}

Description: ${description}

Generate a Facebook post caption`;

  if (imageUrl) userPrompt += ` for an image`;

  userPrompt += ` that is engaging and matches the brand voice. Maximum ${maxLength} characters.`;

  if (hashtags) userPrompt += `\n\nAlso generate ${maxHashtags} relevant hashtags for this post.`;

  userPrompt += `\n\nFormat your response as JSON:
{
  "caption": "your caption here",
  "hashtags": ["hashtag1", "hashtag2"]
}`;

  const response = await axios.post(
    OPENROUTER_API_URL,
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fb-autopost.com',
        'X-Title': 'FB Autopost SaaS',
      },
    }
  );

  const content = response.data.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    return { caption: parsed.caption || '', hashtags: parsed.hashtags || [] };
  } catch {
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

export async function suggestHashtags(description: string, count: number = 5, tenantId?: string): Promise<string[]> {
  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);
  const temperature = await getTemperature(tenantId);

  const response = await axios.post(
    OPENROUTER_API_URL,
    {
      model,
      messages: [
        {
          role: 'user',
          content: `Generate ${count} relevant hashtags for a Facebook post about: "${description}"

Return only the hashtags as a JSON array, like: ["hashtag1", "hashtag2", "hashtag3"]`,
        },
      ],
      temperature,
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = response.data.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const matches = content.match(/#\w+/g) || [];
    return matches.map((h: string) => h.substring(1));
  }
}

export async function generateReply(
  comment: string,
  brandVoice: string = 'professional',
  tenantId?: string
): Promise<string> {
  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);
  const temperature = await getTemperature(tenantId);

  const voicePrompt = BRAND_VOICE_PROMPTS[brandVoice] || BRAND_VOICE_PROMPTS.professional;

  const response = await axios.post(
    OPENROUTER_API_URL,
    {
      model,
      messages: [
        {
          role: 'system',
          content: `You are a social media manager responding to comments on a Facebook page.
Brand Voice: ${voicePrompt}
Generate a brief, appropriate reply to this comment. Keep it under 200 characters.`,
        },
        {
          role: 'user',
          content: `Comment: "${comment}"`,
        },
      ],
      temperature,
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0].message.content.trim();
}
