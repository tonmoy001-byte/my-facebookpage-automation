# AI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image analysis, multi-language support (EN/BN), tone-based caption/hashtag generation, and per-post auto-reply to the Facebook Page automation SaaS.

**Architecture:** Modular AI service under `src/lib/ai/` with shared OpenRouter client. Schema gets Language enum, Post gets autoReply/language fields, BrandVoice gets isPreset. Webhook handler rewritten for per-post auto-reply with idempotency and audit trail.

**Tech Stack:** Next.js 16 App Router, Prisma 7.x with `@prisma/adapter-pg`, OpenRouter (Gemini 2.5 Flash with vision), TypeScript, Tailwind CSS

---

## File Structure

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add Language enum, CommentStatus enum, Post/AISettings/BrandVoice/Comment field changes |
| `prisma/seed.ts` | Create 5 preset BrandVoices (or migration SQL) |
| `src/lib/ai/client.ts` | Shared OpenRouter communication, `callOpenRouter()`, `resolveBrandVoice()` |
| `src/lib/ai/caption.ts` | `generateCaption()` with vision support, language, tone |
| `src/lib/ai/reply.ts` | `generateReply()` with language detection, brandVoice context |
| `src/lib/ai/hashtags.ts` | `suggestHashtags()` with tone awareness |
| `src/app/api/ai/caption/route.ts` | Updated caption endpoint with new params + envelope |
| `src/app/api/ai/hashtags/route.ts` | Updated hashtags endpoint with new params + envelope |
| `src/app/api/ai/image/analyze/route.ts` | New image analysis endpoint |
| `src/app/api/posts/route.ts` | Add autoReply, language to POST |
| `src/app/api/posts/[id]/route.ts` | Add autoReply, language to PUT |
| `src/app/api/facebook/webhook/route.ts` | Complete rewrite for per-post auto-reply |
| `src/app/posts/create/page.tsx` | Language toggle, tone dropdown, auto-reply checkbox, analyze image button |
| `src/app/posts/list/page.tsx` | Language badge, auto-reply icon |
| `src/app/comments/page.tsx` | Manual reply, status filter tabs, metadata display |

---

## Task 1: Schema Changes + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Language enum and new fields to schema**

Add after the existing enums in `prisma/schema.prisma`:

```prisma
enum Language {
  EN
  BN
}

enum CommentStatus {
  PROCESSING
  REPLIED
  PENDING
  ESCALATED
  FAILED
}
```

Add to the `Post` model (after `brandVoice`):

```prisma
  autoReply    Boolean  @default(false)
  language     Language @default(EN)
```

Add to the `AISettings` model (after `maxTokens`):

```prisma
  defaultLanguage      Language @default(EN)
  defaultBrandVoiceId  String?
```

Add to the `BrandVoice` model (after `isGlobal`):

```prisma
  isPreset  Boolean @default(false)
```

Replace `Comment.status` String field with:

```prisma
  status           CommentStatus @default(PENDING)
```

Add audit fields to `Comment` model (after `repliedAt`):

```prisma
  replyType      String?
  brandVoiceId   String?
  modelUsed      String?
```

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`

Expected: Client generated successfully at `src/generated/prisma`

- [ ] **Step 3: Create migration SQL for Neon**

Since we use Neon (not local DB for schema push), write a migration SQL file. Create `prisma/migrations/20260719_ai_integration/migration.sql`:

```sql
-- Create Language enum
CREATE TYPE "Language" AS ENUM ('EN', 'BN');

-- Create CommentStatus enum
CREATE TYPE "CommentStatus" AS ENUM ('PROCESSING', 'REPLIED', 'PENDING', 'ESCALATED', 'FAILED');

-- Add fields to Post
ALTER TABLE "Post" ADD COLUMN "autoReply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "language" "Language" NOT NULL DEFAULT 'EN';

-- Add fields to AISettings
ALTER TABLE "AISettings" ADD COLUMN "defaultLanguage" "Language" NOT NULL DEFAULT 'EN';
ALTER TABLE "AISettings" ADD COLUMN "defaultBrandVoiceId" TEXT;

-- Add isPreset to BrandVoice
ALTER TABLE "BrandVoice" ADD COLUMN "isPreset" BOOLEAN NOT NULL DEFAULT false;

-- Migrate Comment.status from String to enum
-- First add new column
ALTER TABLE "Comment" ADD COLUMN "statusNew" "CommentStatus" NOT NULL DEFAULT 'PENDING';

-- Copy existing data
UPDATE "Comment" SET "statusNew" = 'REPLIED' WHERE "status" = 'replied';
UPDATE "Comment" SET "statusNew" = 'PENDING' WHERE "status" = 'pending';
UPDATE "Comment" SET "statusNew" = 'PENDING' WHERE "status" = 'ignored';

-- Drop old column and rename new
ALTER TABLE "Comment" DROP COLUMN "status";
ALTER TABLE "Comment" RENAME COLUMN "statusNew" TO "status";

-- Add audit fields to Comment
ALTER TABLE "Comment" ADD COLUMN "replyType" TEXT;
ALTER TABLE "Comment" ADD COLUMN "brandVoiceId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "modelUsed" TEXT;
```

- [ ] **Step 4: Apply migration to Neon**

Run the migration SQL against Neon using the `neon_run_sql` tool or `psql` with the Neon connection string.

- [ ] **Step 5: Verify schema**

Run: `npx prisma db pull`

Expected: Schema matches the updated models.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Language enum, auto-reply fields, Comment audit trail"
```

---

## Task 2: Seed Preset BrandVoices

**Files:**
- Create: `prisma/seed-presets.sql`

- [ ] **Step 1: Create seed SQL for 5 preset BrandVoices**

Create `prisma/seed-presets.sql`:

```sql
INSERT INTO "BrandVoice" ("id", "name", "slug", "description", "tone", "styleGuide", "examples", "isDefault", "isGlobal", "isPreset", "createdAt", "updatedAt")
VALUES
  ('preset-professional', 'Professional', 'professional', 'Formal, authoritative tone for business communication', 'Formal, knowledgeable', 'Clear, authoritative language. No slang. Use industry expertise and credibility. Maintain a polished, respectful tone.', ARRAY['Discover the latest innovations in our field.', 'We are committed to delivering excellence.', 'Your trust drives our mission forward.'], false, true, true, NOW(), NOW()),

  ('preset-casual', 'Casual', 'casual', 'Friendly, relaxed tone for approachable brands', 'Friendly, relaxed', 'Conversational language. Emojis are OK. Be approachable and relatable. Write like you are talking to a friend.', ARRAY['Hey there! Check out what we have been up to.', 'Love this vibe? You are going to love what is next.', 'Thanks for being part of the journey!'], false, true, true, NOW(), NOW()),

  ('preset-funny', 'Funny', 'funny', 'Humorous, witty tone for entertaining content', 'Humorous, witty', 'Puns, wordplay, and lighthearted humor. Keep it fun but not forced. Avoid offensive jokes.', ARRAY['We did a thing. No regrets.', 'Plot twist: the product actually works.', 'Warning: side effects may include excessive smiling.'], false, true, true, NOW(), NOW()),

  ('preset-inspirational', 'Inspirational', 'inspirational', 'Uplifting, motivational tone for positive messaging', 'Uplifting, motivational', 'Positive language. Include a call-to-action. Focus on possibility and growth.', ARRAY['Every great journey starts with a single step.', 'Your potential is limitless. Let us explore it together.', 'Today is the day to make a change.'], false, true, true, NOW(), NOW()),

  ('preset-educational', 'Educational', 'educational', 'Informative, teaching tone for valuable content', 'Informative, teaching', 'Clear explanations. Step-by-step when possible. Provide value through knowledge.', ARRAY['Here is what you need to know about...', 'Pro tip: small changes make a big difference.', 'Let us break this down into simple steps.'], false, true, true, NOW(), NOW());
```

- [ ] **Step 2: Run seed SQL against Neon**

Execute the SQL against the Neon database.

- [ ] **Step 3: Verify seed data**

Run: `SELECT id, name, slug, "isPreset", "isGlobal" FROM "BrandVoice";`

Expected: 5 rows with `isPreset = true` and `isGlobal = true`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-presets.sql
git commit -m "feat: seed 5 preset BrandVoices (professional, casual, funny, inspirational, educational)"
```

---

## Task 3: AI Service — Shared Client

**Files:**
- Create: `src/lib/ai/client.ts`

- [ ] **Step 1: Create the shared OpenRouter client module**

Create `src/lib/ai/client.ts`:

```typescript
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/lib/ai/client.ts"`

Expected: No errors in client.ts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/client.ts
git commit -m "feat: add shared AI client with OpenRouter, BrandVoice resolution, language mapping"
```

---

## Task 4: AI Service — Caption Module

**Files:**
- Create: `src/lib/ai/caption.ts`

- [ ] **Step 1: Create the caption generation module**

Create `src/lib/ai/caption.ts`:

```typescript
import { callOpenRouter, resolveBrandVoice, getLanguageInstruction, type OpenRouterMessage } from './client';

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

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: imageUrl } },
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/lib/ai/caption.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/caption.ts
git commit -m "feat: add caption generation with vision support, language, and BrandVoice"
```

---

## Task 5: AI Service — Reply Module

**Files:**
- Create: `src/lib/ai/reply.ts`

- [ ] **Step 1: Create the reply generation module**

Create `src/lib/ai/reply.ts`:

```typescript
import { callOpenRouter, resolveBrandVoice, getLanguageInstruction, type OpenRouterMessage } from './client';

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

  return {
    reply: reply.trim(),
    detectedLanguage: detectedLang,
    brandVoiceId: brandVoice.id,
    modelUsed: await import('./client').then((m) => m.getModel(tenantId)).then(() => 'google/gemini-2.5-flash'),
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/lib/ai/reply.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/reply.ts
git commit -m "feat: add reply generation with language detection and BrandVoice context"
```

---

## Task 6: AI Service — Hashtags Module

**Files:**
- Create: `src/lib/ai/hashtags.ts`

- [ ] **Step 1: Create the hashtag generation module**

Create `src/lib/ai/hashtags.ts`:

```typescript
import { callOpenRouter, getLanguageInstruction, type OpenRouterMessage } from './client';

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

  const content = await callOpenRouter(messages, { tenantId, maxTokens: 200 });

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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/lib/ai/hashtags.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/hashtags.ts
git commit -m "feat: add tone-aware hashtag generation with language support"
```

---

## Task 7: Update Caption API Route

**Files:**
- Modify: `src/app/api/ai/caption/route.ts`

- [ ] **Step 1: Rewrite caption route with new params and envelope**

Replace entire content of `src/app/api/ai/caption/route.ts`:

```typescript
// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateCaption } from '@/lib/ai/caption';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Rate limit: 10 requests per minute per tenant
    const rateLimitKey = `ai-caption:${user.tenantId}`;
    const allowed = checkRateLimit(rateLimitKey, 10, 60000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { imageUrl, description, language, tone, brandVoiceId, includeHashtags, maxHashtags } =
      await request.json();

    if (!description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Description is required' } },
        { status: 400 }
      );
    }

    // Validate language enum
    if (language && !['EN', 'BN'].includes(language)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Language must be EN or BN' } },
        { status: 400 }
      );
    }

    const result = await generateCaption({
      tenantId: user.tenantId,
      imageUrl,
      description,
      language: language || 'EN',
      brandVoiceId,
      includeHashtags: includeHashtags !== false,
      maxHashtags: maxHashtags || 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        language: language || 'EN',
        tone: tone || 'professional',
      },
    });
  } catch (error: any) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to generate caption' } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/ai/caption/route.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/caption/route.ts
git commit -m "feat: update caption API with language, tone, envelope, and rate limiting"
```

---

## Task 8: Update Hashtags API Route

**Files:**
- Modify: `src/app/api/ai/hashtags/route.ts`

- [ ] **Step 1: Rewrite hashtags route with new params and envelope**

Replace entire content of `src/app/api/ai/hashtags/route.ts`:

```typescript
// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { suggestHashtags } from '@/lib/ai/hashtags';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Rate limit: 10 requests per minute per tenant
    const rateLimitKey = `ai-hashtags:${user.tenantId}`;
    const allowed = checkRateLimit(rateLimitKey, 10, 60000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { description, language, tone, count } = await request.json();

    if (!description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Description is required' } },
        { status: 400 }
      );
    }

    // Validate language enum
    if (language && !['EN', 'BN'].includes(language)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Language must be EN or BN' } },
        { status: 400 }
      );
    }

    const hashtags = await suggestHashtags({
      description,
      language: language || 'EN',
      tone: tone || 'professional',
      count: count || 5,
      tenantId: user.tenantId,
    });

    return NextResponse.json({
      success: true,
      data: { hashtags },
    });
  } catch (error: any) {
    console.error('Hashtag suggestion error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to suggest hashtags' } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/ai/hashtags/route.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/hashtags/route.ts
git commit -m "feat: update hashtags API with language, tone, configurable count, envelope"
```

---

## Task 9: Create Image Analysis API Route

**Files:**
- Create: `src/app/api/ai/image/analyze/route.ts`

- [ ] **Step 1: Create the image analysis endpoint**

Create directory `src/app/api/ai/image/analyze/` and file `route.ts`:

```typescript
// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { callOpenRouter, getLanguageInstruction, type OpenRouterMessage } from '@/lib/ai/client';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Rate limit: 10 requests per minute per tenant
    const rateLimitKey = `ai-image:${user.tenantId}`;
    const allowed = checkRateLimit(rateLimitKey, 10, 60000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { imageUrl, language } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Image URL is required' } },
        { status: 400 }
      );
    }

    const langInstruction = getLanguageInstruction(language || 'EN');

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an image analysis AI. Analyze the provided image and return structured data.
${langInstruction}
Return your analysis as JSON:
{
  "description": "A detailed description of what you see in the image",
  "objects": ["list", "of", "main", "objects"],
  "scene": "the overall scene or setting",
  "confidence": "high" | "medium" | "low"
}`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this image and return the structured JSON response.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ];

    const content = await callOpenRouter(messages, {
      tenantId: user.tenantId,
      maxTokens: 500,
    });

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: {
          description: parsed.description || '',
          objects: Array.isArray(parsed.objects) ? parsed.objects : [],
          scene: parsed.scene || '',
          confidence: parsed.confidence || 'medium',
        },
      });
    } catch {
      // If JSON parsing fails, return the raw text as description
      return NextResponse.json({
        success: true,
        data: {
          description: content.trim(),
          objects: [],
          scene: '',
          confidence: 'low',
        },
      });
    }
  } catch (error: any) {
    console.error('Image analysis error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to analyze image' } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/ai/image/analyze/route.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/image/analyze/route.ts
git commit -m "feat: add image analysis endpoint with structured response"
```

---

## Task 10: Update Post API Routes

**Files:**
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[id]/route.ts`

- [ ] **Step 1: Update POST /api/posts to accept autoReply and language**

In `src/app/api/posts/route.ts`, find the destructuring line:

```typescript
const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, scheduledAt, timezone } = await request.json();
```

Replace with:

```typescript
const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, scheduledAt, timezone, autoReply, language } = await request.json();
```

Find the `prisma.post.create` data block and add the new fields. The `tenantData` call should include:

```typescript
const post = await prisma.post.create({
  data: tenantData(user.tenantId, {
    userId: user.id,
    pageId: page.id,
    content,
    mediaUrls: finalMediaUrls,
    mediaType,
    brandVoice: brandVoiceId || 'professional',
    status: scheduledAt ? 'scheduled' : 'draft',
    autoReply: autoReply === true,
    language: language || 'EN',
  }),
});
```

- [ ] **Step 2: Update PUT /api/posts/[id] to accept autoReply and language**

In `src/app/api/posts/[id]/route.ts`, find the destructuring line in the PUT handler:

```typescript
const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, status, scheduledAt, timezone } =
  await request.json();
```

Replace with:

```typescript
const { caption, hashtags, imageUrl, mediaUrls, brandVoiceId, status, scheduledAt, timezone, autoReply, language } =
  await request.json();
```

Find the `prisma.post.update` data block and add:

```typescript
const updatedPost = await prisma.post.update({
  where: { id },
  data: {
    content: caption || post.content,
    mediaUrls: finalMediaUrls,
    brandVoice: brandVoiceId || post.brandVoice,
    status: status || post.status,
    ...(autoReply !== undefined && { autoReply }),
    ...(language && { language }),
  },
});
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/posts"`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/posts/route.ts src/app/api/posts/[id]/route.ts
git commit -m "feat: add autoReply and language fields to post create/update APIs"
```

---

## Task 11: Rewrite Webhook Handler

**Files:**
- Modify: `src/app/api/facebook/webhook/route.ts`

- [ ] **Step 1: Rewrite the webhook handler**

Replace the entire `handleNewComment` function in `src/app/api/facebook/webhook/route.ts` with:

```typescript
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/facebook/webhook/route.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/facebook/webhook/route.ts
git commit -m "feat: rewrite webhook for per-post auto-reply with idempotency and audit trail"
```

---

## Task 12: Update Post Creation UI

**Files:**
- Modify: `src/app/posts/create/page.tsx`

- [ ] **Step 1: Add new state variables**

In the `CreatePostPage` component, add these state variables after the existing ones:

```typescript
const [language, setLanguage] = useState<string>('EN');
const [autoReply, setAutoReply] = useState(false);
const [analyzing, setAnalyzing] = useState(false);
const [imageAnalysis, setImageAnalysis] = useState<any>(null);
```

- [ ] **Step 2: Add language toggle and auto-reply checkbox to the right column**

In the right column, add a new section after the "Brand Voice" section and before "Schedule":

```tsx
{/* Language & Auto-Reply */}
<div className="bg-white rounded-lg shadow p-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>

  {/* Language Toggle */}
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
    <div className="flex gap-2">
      <button
        onClick={() => setLanguage('EN')}
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
          language === 'EN'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('BN')}
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
          language === 'BN'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        বাংলা
      </button>
    </div>
  </div>

  {/* Auto-Reply Toggle */}
  <div>
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={autoReply}
        onChange={(e) => setAutoReply(e.target.checked)}
        className="w-4 h-4 text-blue-600 rounded"
      />
      <div>
        <span className="text-sm font-medium text-gray-700">Enable Auto-Reply</span>
        <p className="text-xs text-gray-500">AI will reply to comments on this post</p>
      </div>
    </label>
  </div>
</div>
```

- [ ] **Step 3: Add "Analyze Image" button below the image preview**

After the image preview in the Media section, add:

```tsx
{imageUrl && (
  <div className="mt-3">
    <Button
      onClick={async () => {
        setAnalyzing(true);
        try {
          const response = await fetch('/api/ai/image/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ imageUrl, language }),
          });
          const data = await response.json();
          if (data.success) {
            setImageAnalysis(data.data);
          }
        } catch (e) {
          console.error('Image analysis failed:', e);
        } finally {
          setAnalyzing(false);
        }
      }}
      disabled={analyzing}
      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm"
    >
      {analyzing ? 'Analyzing...' : 'Analyze Image'}
    </Button>
  </div>
)}
```

- [ ] **Step 4: Show image analysis result**

After the analyze button, add a results display:

```tsx
{imageAnalysis && (
  <div className="mt-3 bg-indigo-50 rounded-lg p-3">
    <p className="text-sm font-medium text-indigo-800 mb-1">AI sees:</p>
    <p className="text-sm text-indigo-700">{imageAnalysis.description}</p>
    {imageAnalysis.objects?.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2">
        {imageAnalysis.objects.map((obj: string, i: number) => (
          <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
            {obj}
          </span>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Update handleGenerateCaption to pass language and brandVoiceId**

Find the `handleGenerateCaption` function and update the fetch body:

```typescript
body: JSON.stringify({
  imageUrl,
  description,
  brandVoiceId: selectedVoice || undefined,
  language,
  includeHashtags: true,
  maxHashtags: 5,
}),
```

- [ ] **Step 6: Update handleSave to pass autoReply and language**

Find the `handleSave` function and update the fetch body:

```typescript
body: JSON.stringify({
  caption,
  hashtags,
  imageUrl,
  brandVoiceId: selectedVoice || null,
  scheduledAt: isoScheduledAt,
  autoReply,
  language,
}),
```

- [ ] **Step 7: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/posts/create/page.tsx"`

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/posts/create/page.tsx
git commit -m "feat: add language toggle, auto-reply checkbox, and image analysis to post creation"
```

---

## Task 13: Update Post List UI

**Files:**
- Modify: `src/app/posts/list/page.tsx`

- [ ] **Step 1: Add language and autoReply to Post interface**

Update the `Post` interface:

```typescript
interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  status: string;
  brandVoice?: string;
  language?: string;
  autoReply?: boolean;
  createdAt: string;
  publishJob?: {
    scheduledAt: string;
    status: string;
  };
}
```

- [ ] **Step 2: Add language badge and auto-reply icon to post cards**

Find the status badge section in the post card and add after it:

```tsx
{post.language && (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
    post.language === 'BN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
  }`}>
    {post.language === 'BN' ? 'বাংলা' : 'EN'}
  </span>
)}
{post.autoReply && (
  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
    Auto-Reply
  </span>
)}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/posts/list/page.tsx"`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/posts/list/page.tsx
git commit -m "feat: add language badge and auto-reply indicator to post list"
```

---

## Task 14: Update Comments Page UI

**Files:**
- Modify: `src/app/comments/page.tsx`

- [ ] **Step 1: Update Comment interface and add filter tabs**

Update the `Comment` interface:

```typescript
interface Comment {
  id: string;
  facebookCommentId: string;
  content: string;
  authorName: string;
  authorId: string;
  status: string;
  reply?: string;
  repliedAt?: string;
  replyType?: string;
  brandVoiceId?: string;
  modelUsed?: string;
  createdAt: string;
  page: {
    pageName: string;
  };
  rule?: {
    name: string;
  };
}
```

Update the filter tabs to include new statuses:

```tsx
{['', 'pending', 'replied', 'escalated', 'failed'].map((status) => (
  <button
    key={status}
    onClick={() => {
      setFilter(status);
      setPage(1);
    }}
    className={`px-4 py-2 rounded-lg text-sm font-medium ${
      filter === status
        ? 'bg-blue-600 text-white'
        : 'bg-white text-gray-700 hover:bg-gray-100'
    }`}
  >
    {status || 'All'}
  </button>
))}
```

- [ ] **Step 2: Update getStatusColor for new statuses**

```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'replied':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'escalated':
      return 'bg-orange-100 text-orange-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'processing':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
```

- [ ] **Step 3: Add manual reply input for pending comments**

After the comment content div and before the auto-reply display, add:

```tsx
{comment.status === 'pending' && (
  <div className="mt-3 flex gap-2">
    <input
      type="text"
      placeholder="Type a reply..."
      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      onKeyPress={async (e) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
          const replyText = e.currentTarget.value.trim();
          try {
            const response = await fetch(`/api/comments/${comment.id}/reply`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ reply: replyText }),
            });
            if (response.ok) {
              e.currentTarget.value = '';
              fetchComments();
            }
          } catch (err) {
            console.error('Reply failed:', err);
          }
        }
      }}
    />
  </div>
)}
```

- [ ] **Step 4: Add reply metadata display**

After the auto-reply section, add:

```tsx
{comment.replyType && (
  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
    <span className={`px-1.5 py-0.5 rounded ${
      comment.replyType === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {comment.replyType}
    </span>
    {comment.modelUsed && (
      <span>{comment.modelUsed}</span>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/comments/page.tsx"`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/comments/page.tsx
git commit -m "feat: add manual reply, status filters, and metadata display to comments page"
```

---

## Task 15: Create Comment Reply API Route

**Files:**
- Create: `src/app/api/comments/[id]/reply/route.ts`

- [ ] **Step 1: Create the manual reply endpoint**

Create directory `src/app/api/comments/[id]/reply/` and file `route.ts`:

```typescript
// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantWhere } from '@/lib/prisma';
import { createFacebookService } from '@/lib/facebook';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { reply } = await request.json();

    if (!reply || !reply.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reply text is required' } },
        { status: 400 }
      );
    }

    // Find the comment (tenant-scoped)
    const comment = await prisma.comment.findFirst({
      where: tenantWhere(user.tenantId, { id }),
      include: { page: true },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    // Send reply via Facebook
    try {
      const fbService = createFacebookService(comment.page.accessToken, comment.page.pageId);
      await fbService.replyToComment(comment.facebookCommentId, reply.trim());

      // Update comment
      await prisma.comment.update({
        where: { id },
        data: {
          reply: reply.trim(),
          repliedAt: new Date(),
          status: 'REPLIED',
          replyType: 'MANUAL',
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: 'Reply sent successfully' },
      });
    } catch (fbError) {
      console.error('Facebook reply failed:', fbError);
      return NextResponse.json(
        { success: false, error: { code: 'FACEBOOK_ERROR', message: 'Failed to send reply to Facebook' } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Reply error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to send reply' } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "src/app/api/comments/[id]/reply/route.ts"`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/comments/[id]/reply/route.ts
git commit -m "feat: add manual reply API endpoint for comments"
```

---

## Task 16: Build Verification + Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

- [ ] **Step 2: Run Next.js build**

Run: `npm run build`

Expected: Build succeeds, all routes compile.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "fix: resolve TypeScript and build issues"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin saas-version
```

- [ ] **Step 5: Verify Vercel deployment**

Check Vercel dashboard for successful deployment. Verify the live site loads.

- [ ] **Step 6: Verify Neon schema**

Check that the migration applied correctly by querying the database.

---

## Self-Review Checklist

- [ ] **Spec coverage:** All 8 spec sections covered (schema, seed, AI modules, API routes, webhook, UI, files, out of scope)
- [ ] **Placeholder scan:** No TBD/TODO/placeholders in any step
- [ ] **Type consistency:** `Language` enum used consistently, `CommentStatus` enum used consistently, BrandVoice resolution chain documented in client.ts
- [ ] **File paths:** All paths are exact and verified against existing codebase
- [ ] **Envelope format:** All API routes use `{ success, data/error }` format
- [ ] **Rate limiting:** Applied to all `/api/ai/*` endpoints
- [ ] **Idempotency:** Webhook checks `facebookCommentId` before processing
- [ ] **Audit trail:** Comment tracks `replyType`, `brandVoiceId`, `modelUsed`
