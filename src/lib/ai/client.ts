// @ts-nocheck
import { prisma } from '../prisma';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
      where: { tenantId, provider: 'openrouter' },
    });
    if (credential?.apiKey) return credential.apiKey;
  }
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  throw new Error('No AI API key configured. Add your OpenRouter key in Settings > AI.');
}

export async function getModel(tenantId?: string): Promise<string> {
  if (tenantId) {
    const settings = await prisma.aISettings.findUnique({ where: { tenantId } });
    if (settings?.defaultModel) return settings.defaultModel;
  }
  return 'google/gemini-2.5-flash';
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

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const { tenantId, temperature: tempOverride, maxTokens = 1000 } = options;

  const apiKey = await getApiKey(tenantId);
  const model = await getModel(tenantId);
  const temperature = tempOverride ?? await getTemperature(tenantId);

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fb-autopost.com',
      'X-Title': 'FB Autopost SaaS',
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
