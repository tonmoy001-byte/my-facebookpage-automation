# AI Integration Design — Image Analysis, Multi-Language, Tone-Based Captions & Auto-Reply

**Date:** 2026-07-19
**Status:** Approved
**Approach:** Modular AI service (Approach B)

---

## 1. Overview

Enhance the Facebook Page automation SaaS with three interconnected AI features:

1. **Image analysis → caption generation** — AI actually "sees" uploaded images via Gemini vision API
2. **Multi-language support** — Per-post English/Bangla toggle with proper enum typing
3. **Tone-based caption & hashtag generation** — 5 preset tones via unified BrandVoice system
4. **Per-post auto-reply** — Opt-in auto-reply on posts, governed by ReplyRules with AI or template responses

---

## 2. Schema Changes

### 2.1 New Enum: `Language`

```prisma
enum Language {
  EN
  BN
}
```

Maps to prompt instructions: `EN → "Respond in English"`, `BN → "উত্তর দিন বাংলায়"`.

### 2.2 Post Model — Add Fields

```prisma
autoReply    Boolean  @default(false)
language     Language @default(EN)
```

- `autoReply` — When true, comments on this post get AI replies governed by matching ReplyRules
- `language` — Caption/hashtag generation language for this post

**Note:** The existing `Post.brandVoice String` field continues to store the BrandVoice DB ID (or null). It is separate from `language`. The AI service resolves brand voice via the chain: `Post.brandVoice` → `AISettings.defaultBrandVoiceId` → `"professional"` preset.

### 2.3 AISettings Model — Add Fields

```prisma
defaultLanguage      Language @default(EN)
defaultBrandVoiceId  String?
```

- `defaultLanguage` — Pre-selected language on post creation page
- `defaultBrandVoiceId` — Fallback BrandVoice when user doesn't select one

### 2.4 BrandVoice Model — Add Field

```prisma
isPreset  Boolean @default(false)
```

Already has: `slug String @unique`, `isGlobal Boolean @default(false)`, `tone String`, `styleGuide String`, `examples String[]`.

- `isPreset` — Prevents accidental editing/deletion of built-in tones

### 2.5 Comment Model — Extend Status

```prisma
enum CommentStatus {
  PROCESSING
  REPLIED
  PENDING
  ESCALATED
  FAILED
}
```

**Migration note:** Current `Comment.status` is a `String @default("pending")`. Converting to enum requires: (1) add new enum column, (2) copy existing values, (3) drop old column, (4) rename new column. Existing string values (`"pending"`, `"replied"`, `"ignored"`) map to enum values (`PENDING`, `REPLIED`, `PENDING`). The `"ignored"` status is deprecated — use `ESCALATED` or `PENDING` instead.

Add audit fields to Comment:

```prisma
replyType      String?    // AI, TEMPLATE, MANUAL
brandVoiceId   String?
modelUsed      String?    // e.g. "google/gemini-2.5-flash"
```

### 2.6 Seed Data — 5 Preset BrandVoices

| slug | tone | styleGuide | isGlobal | isPreset |
|------|------|------------|----------|----------|
| `professional` | Formal, knowledgeable | Clear, authoritative, no slang | true | true |
| `casual` | Friendly, relaxed | Conversational, emojis OK | true | true |
| `funny` | Humorous, witty | Puns, wordplay, lighthearted | true | true |
| `inspirational` | Uplifting, motivational | Positive language, call-to-action | true | true |
| `educational` | Informative, teaching | Clear explanations, step-by-step | true | true |

---

## 3. AI Service Modules

New files under `src/lib/ai/`:

### 3.1 `src/lib/ai/client.ts` — Shared OpenRouter Communication

- `callOpenRouter(messages, options)` — Handles API calls, error handling, retries
- Uses `getApiKey(tenantId)` and `getModel(tenantId)` from existing code
- `resolveBrandVoice(brandVoiceId?, tenantId)` — Fetches from DB, falls back to tenant's `defaultBrandVoiceId`, falls back to `"professional"` preset

### 3.2 `src/lib/ai/caption.ts` — Caption + Image Analysis

```
generateCaption({ imageUrl, description, language, tone, brandVoice, tenantId })
```

- If `imageUrl` present: sends image as base64 in multimodal message to Gemini vision
- If no image: text-only prompt
- Returns `{ caption: string, hashtags: string[] }`
- Language maps to prompt instruction: `EN → "Respond in English"`, `BN → "উত্তর দিন বাংলায়"`
- Tone/brandVoice feeds into the system prompt
- Uses `includeHashtags` flag to optionally skip hashtag generation

### 3.3 `src/lib/ai/reply.ts` — Comment Reply Generation

```
generateReply({ comment, postContent, language, brandVoice, tenantId, pageName, businessType })
```

- Detects comment language via heuristic (Bangla Unicode range >30% → BN, ASCII-only → EN, else ask AI)
- Uses brandVoice `styleGuide` + `examples` if available
- Returns plain text reply (under 200 chars)

### 3.4 `src/lib/ai/hashtags.ts` — Standalone Hashtag Generation

```
suggestHashtags({ description, language, tone, count, tenantId })
```

- Tone-aware: professional → industry hashtags; funny → playful hashtags
- Returns `string[]`

---

## 4. API Routes

### 4.1 Standard Response Envelope

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

### 4.2 Endpoints

| Endpoint | Method | Params | Notes |
|----------|--------|--------|-------|
| `/api/ai/caption` | POST | `description, imageUrl?, language, tone, brandVoiceId?, includeHashtags` | `includeHashtags` controls response |
| `/api/ai/hashtags` | POST | `description, language, tone, count` | Configurable count |
| `/api/ai/image/analyze` | POST | `imageUrl` | Returns `{ description, objects[], scene, confidence }` |
| `/api/posts` | POST | + `autoReply, language` | Server-side enum validation |
| `/api/posts/[id]` | PUT | + `autoReply, language` | Same validation |

### 4.3 Rate Limiting

Apply per-tenant rate limits on all `/api/ai/*` endpoints using existing `src/lib/rate-limit.ts`.

---

## 5. Auto-Reply Flow

### 5.1 Complete Pipeline

```
Webhook
  ↓
Verify Meta signature
  ↓
Idempotency check (facebookCommentId exists?)
  ↓
Create Comment (status: PROCESSING)
  ↓
Find Post
  ↓
Post exists? → No → Return 200 (ignore)
  ↓
Tenant active? → No → status: PENDING, stop
  ↓
Auto Reply enabled on post? → No → status: PENDING, stop
  ↓
Rule matching:
  1. Filter by tenantId, isActive = true
  2. Sort by priority (descending)
  3. For each rule:
     - Check schedule (daysOfWeek, startTime, endTime)
     - Check keyword match (OR logic — any keyword matches)
     - Check sentiment match (positive/negative/neutral/any)
     - First matching rule wins
  ↓
Action:
  ├─ ESCALATE → status: ESCALATED, stop
  ├─ TEMPLATE → replyTemplate with {name}, {comment}, {postTitle}, {pageName}
  ├─ AI_REPLY → generateReply() with comment, postContent, language, brandVoice, pageName
  └─ No match → status: PENDING, stop
  ↓
Send Facebook reply (retry once on transient failure)
  ↓
Update Comment:
  status (REPLIED / FAILED)
  reply text
  replyType (AI / TEMPLATE / MANUAL)
  ruleId
  brandVoiceId
  modelUsed (if AI)
  repliedAt
  updatedAt
```

### 5.2 Comment Statuses

```
PROCESSING → REPLIED | PENDING | ESCALATED | FAILED
```

### 5.3 Language Detection Heuristic

```
Bangla Unicode (\u0980-\u09FF) > 30%? → BN
ASCII only? → EN
Otherwise → Ask AI to detect language
```

### 5.4 Template Variables

```
{name}       — Comment author's name
{comment}    — Comment text
{postTitle}  — Post caption (truncated)
{pageName}   — Facebook page name
```

### 5.5 Idempotency

Before processing, check if `Comment` with this `facebookCommentId` already exists. If yes, return 200 immediately.

### 5.6 Human Override

If a comment is manually replied to before automation runs, the automation detects `status: 'replied'` and skips.

---

## 6. UI Changes

### 6.1 Post Creation Page (`/posts/create`)

- **Language toggle** — Two-button toggle (EN/BN), default from `AISettings.defaultLanguage`
- **Tone dropdown** — Populated from BrandVoices (show name + tone), default from `AISettings.defaultBrandVoiceId`
- **Auto-reply toggle** — Checkbox, saved to Post
- **"Analyze Image" button** — Appears when image uploaded, calls `/api/ai/image/analyze`, shows structured result (objects, scene) below image
- AI caption generation uses selected language + tone

### 6.2 Post List Page (`/posts/list`)

- Language badge (EN/BN) on each post card
- Auto-reply icon (✓/✗) on each post card

### 6.3 Comments Page (`/comments`)

- Manual reply input — Text field + "Reply" button for pending comments
- Status filter tabs: All | Pending | Replied | Escalated
- Show which rule matched (if any)
- Show detected language of comment
- Show reply metadata (replyType, brandVoice, model)

---

## 7. Files to Create/Modify

| Area | Files |
|------|-------|
| Schema | `prisma/schema.prisma` |
| Seed | `prisma/seed.ts` or migration SQL |
| AI Service | `src/lib/ai/client.ts`, `caption.ts`, `reply.ts`, `hashtags.ts` |
| API Routes | `src/app/api/ai/caption/route.ts`, `hashtags/route.ts`, `image/analyze/route.ts` |
| Post API | `src/app/api/posts/route.ts`, `[id]/route.ts` |
| Webhook | `src/app/api/facebook/webhook/route.ts` |
| UI | `src/app/posts/create/page.tsx`, `posts/list/page.tsx`, `comments/page.tsx` |

---

## 8. Out of Scope

- SendGrid email notifications (skipped)
- Messenger/DM handling
- Post deletion from Facebook
- Webhook event deduplication beyond comment ID
- `AISettings.maxTokens` wiring (deferred)
- Settings page AI configuration tab (deferred)
