// @ts-nocheck
import { prisma } from '../prisma';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface OpenRouterOptions {
  tenantId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BrandVoiceData {
  id: string;
  name: string;
  slug: string;
  tone: string;
  styleGuide: string;
  examples: string[];
}

const LANGUAGE_MAP: Record<string, string> = {
  EN: 'Respond in English.',
  BN: 'উত্তর দিন বাংলায়। (Respond in Bangla.)',
};

export function getLanguageInstruction(language: string): string {
  return LANGUAGE_MAP[language] || LANGUAGE_MAP.EN;
}

export async function getApiKey(tenantId?: string): Promise<string> {
  if (tenantId) {
    const credential = await prisma.aICredential.findFirst({
      where: { tenantId, provider: 'google' },
    });
    if (credential?.apiKey) return credential.apiKey;
  }
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  throw new Error('No AI API key configured. Add your Gemini key in Settings > AI.');
}

export async function getModel(tenantId?: string): Promise<string> {
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.defaultModel) return settings.defaultModel;
  }
  return 'gemini-2.5-flash';
}

export async function getTemperature(tenantId?: string): Promise<number> {
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.temperature != null) return settings.temperature;
  }
  return 0.7;
}

export async function resolveBrandVoice(
  brandVoiceId?: string | null,
  tenantId?: string
): Promise<BrandVoiceData> {
  // 1. Try the provided brandVoiceId
  if (brandVoiceId) {
    const voice = await prisma.brandVoice.findUnique({ where: { id: brandVoiceId } });
    if (voice) return voice;
  }

  // 2. Try tenant's default brand voice
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.defaultBrandVoiceId) {
      const voice = await prisma.brandVoice.findUnique({
        where: { id: settings.defaultBrandVoiceId },
      });
      if (voice) return voice;
    }
  }

  // 3. Fall back to professional preset
  const preset = await prisma.brandVoice.findFirst({
    where: { slug: 'professional', isPreset: true },
  });
  if (preset) return preset;

  // 4. Ultimate fallback (should not happen after seed)
  return {
    id: 'fallback',
    name: 'Professional',
    slug: 'professional',
    tone: 'Formal, knowledgeable',
    styleGuide: 'Clear, authoritative language.',
    examples: [],
  };
}

export async function imageToBase64DataUri(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:${contentType};base64,${base64}`;
}

export async function callGemini(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const { tenantId, temperature: tempOverride, maxTokens = 1000 } = options;

  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);
  const temperature = tempOverride ?? await getTemperature(tenantId);

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI provider error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
