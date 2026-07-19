// @ts-nocheck
import { callGemini, getLanguageInstruction, type OpenRouterMessage } from './client';

export interface SuggestHashtagsOptions {
  description: string;
  language?: string;
  tone?: string;
  count?: number;
  tenantId?: string;
}

export async function suggestHashtags(options: SuggestHashtagsOptions): Promise<string[]> {
  const {
    description,
    language = 'EN',
    tone = 'professional',
    count = 5,
    tenantId,
  } = options;

  const langInstruction = getLanguageInstruction(language);

  const toneGuidance: Record<string, string> = {
    professional: 'industry-specific, credible, and business-appropriate',
    casual: 'fun, approachable, and community-driven',
    funny: 'playful, witty, and entertaining',
    inspirational: 'motivational, uplifting, and empowering',
    educational: 'informative, descriptive, and knowledge-focused',
  };

  const style = toneGuidance[tone] || toneGuidance.professional;

  const messages: OpenRouterMessage[] = [
    {
      role: 'user',
      content: `${langInstruction}

Generate ${count} relevant hashtags for a Facebook post about: "${description}"

Hashtag style: ${style}

Return ONLY a JSON array of hashtag strings (without # prefix), like: ["hashtag1", "hashtag2", "hashtag3"]`,
    },
  ];

  const content = await callGemini(messages, { tenantId, maxTokens: 200 });

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((h: string) => String(h).replace(/^#/, ''));
    }
    return [];
  } catch {
    const matches = content.match(/#\w+/g) || [];
    return matches.map((h: string) => h.substring(1));
  }
}
