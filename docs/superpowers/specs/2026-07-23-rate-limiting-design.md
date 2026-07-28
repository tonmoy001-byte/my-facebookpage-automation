# Rate Limiting Design

## Overview

Replace the current hardcoded in-memory rate limiter with a tiered, configurable system featuring exponential backoff on authentication routes. All thresholds are configurable via environment variables.

## Current State

- `src/lib/rate-limit.ts`: Simple in-memory Map with `checkRateLimit(key, limit, windowMs)` returning boolean
- Rate limiting exists on 5 routes: login, register, AI caption/hashtags/image-analyze
- 25+ routes have no rate limiting at all
- No exponential backoff, no configurable thresholds

## Design

### Approach: Tiered Wrapper Pattern

Each route calls `checkRateLimit(request, tier)` with a tier string. Tiers map to preconfigured limits via a config file. Exponential backoff is centralized in the rate limiter.

### Rate Limit Tiers

| Tier | Env Prefix | Limit | Window | Backoff | Max Backoff | Use Case |
|------|-----------|-------|--------|---------|-------------|----------|
| `auth` | `RL_AUTH_*` | 5 | 60s | 2x | 15min | Login, register |
| `auth_sensitive` | `RL_AUTH_SENS_*` | 3 | 60s | 2x | 30min | Password change, profile update |
| `authenticated` | `RL_AUTHENTICATED_*` | 60 | 60s | none | — | Posts, rules, comments, brand-voices, schedule, Facebook, upload, analytics, notifications |
| `ai` | `RL_AI_*` | 10 | 60s | none | — | AI caption, hashtags, image analyze |
| `public` | `RL_PUBLIC_*` | 30 | 60s | none | — | Any unauthenticated endpoint (currently unused) |

### Environment Variables

All optional with defaults:

```
RL_AUTH_LIMIT=5
RL_AUTH_WINDOW_MS=60000
RL_AUTH_BACKOFF_MULTIPLIER=2
RL_AUTH_MAX_BACKOFF_MS=900000

RL_AUTH_SENS_LIMIT=3
RL_AUTH_SENS_WINDOW_MS=60000
RL_AUTH_SENS_BACKOFF_MULTIPLIER=2
RL_AUTH_SENS_MAX_BACKOFF_MS=1800000

RL_AUTHENTICATED_LIMIT=60
RL_AUTHENTICATED_WINDOW_MS=60000

RL_AI_LIMIT=10
RL_AI_WINDOW_MS=60000

RL_PUBLIC_LIMIT=30
RL_PUBLIC_WINDOW_MS=60000
```

### Core Rate Limiter (`src/lib/rate-limit.ts`)

Replaces existing implementation.

**Interface:**
```ts
interface RateLimitConfig {
  limit: number;
  windowMs: number;
  backoffMultiplier?: number;  // undefined = no backoff
  maxBackoffMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining: number;
}

function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult
function markAuthFailed(key: string, config: RateLimitConfig): void
function resetBackoff(key: string): void
```

**Internal state per key:**
```ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
  consecutiveFailures: number;
  backoffUntil: number;
}
```

**Backoff logic:**
- `markAuthFailed()` increments `consecutiveFailures`, calculates `backoffUntil = now + (windowMs * backoffMultiplier ^ consecutiveFailures)`, capped at `maxBackoffMs`
- `checkRateLimit()` checks both window limit AND `backoffUntil`
- `resetBackoff()` sets `consecutiveFailures = 0` and `backoffUntil = 0` (on successful auth)
- Backoff only applies when `backoffMultiplier` is provided in config

**Response headers** on rate-limited requests:
- `Retry-After: <seconds>`
- `X-RateLimit-Remaining: 0`

**Auto-cleanup:** Expired entries cleaned every 60 seconds (unchanged).

### Config File (`src/lib/rate-limit-config.ts`)

Single source of truth for all thresholds:
```ts
export const rateLimitConfig = {
  auth: { limit, windowMs, backoffMultiplier, maxBackoffMs },
  auth_sensitive: { limit, windowMs, backoffMultiplier, maxBackoffMs },
  authenticated: { limit, windowMs },
  ai: { limit, windowMs },
  public: { limit, windowMs },
};
```

### Route Integration

**Tier assignments:**

| Route | Tier | Key Pattern | Auth |
|-------|------|-------------|------|
| `POST /api/auth/login` | `auth` | `login:{ip}` | None |
| `POST /api/auth/register` | `auth` | `register:{ip}` | None |
| `PUT /api/auth/password` | `auth_sensitive` | `password:{userId}` | JWT |
| `PUT /api/auth/profile` | `auth_sensitive` | `profile:{userId}` | JWT |
| `GET /api/auth/me` | `authenticated` | `me:{tenantId}` | JWT |
| `POST /api/ai/caption` | `ai` | `ai:caption:{tenantId}` | JWT |
| `POST /api/ai/hashtags` | `ai` | `ai:hashtags:{tenantId}` | JWT |
| `POST /api/ai/image/analyze` | `ai` | `ai:image:{tenantId}` | JWT |
| `GET/POST /api/posts` | `authenticated` | `posts:{tenantId}` | JWT |
| `GET/PUT/DELETE /api/posts/[id]` | `authenticated` | `posts:{tenantId}` | JWT |
| `GET /api/comments` | `authenticated` | `comments:{tenantId}` | JWT |
| `POST /api/comments/[id]/reply` | `authenticated` | `reply:{tenantId}` | JWT |
| `GET/POST /api/rules` | `authenticated` | `rules:{tenantId}` | JWT |
| `GET/PUT/DELETE /api/rules/[id]` | `authenticated` | `rules:{tenantId}` | JWT |
| `GET/POST /api/brand-voices` | `authenticated` | `brand-voices:{tenantId}` | JWT |
| `GET/PUT/DELETE /api/brand-voices/[id]` | `authenticated` | `brand-voices:{tenantId}` | JWT |
| `GET/POST /api/schedule` | `authenticated` | `schedule:{tenantId}` | JWT |
| `GET/PUT/DELETE /api/schedule/[id]` | `authenticated` | `schedule:{tenantId}` | JWT |
| `POST /api/facebook/publish` | `authenticated` | `publish:{tenantId}` | JWT |
| `POST /api/facebook/connect` | `authenticated` | `fb-connect:{tenantId}` | JWT |
| `GET /api/facebook/pages` | `authenticated` | `fb-pages:{tenantId}` | JWT |
| `GET /api/facebook/[pageId]` | `authenticated` | `fb-page:{tenantId}` | JWT |
| `POST /api/upload` | `authenticated` | `upload:{tenantId}` | JWT |
| `GET /api/analytics` | `authenticated` | `analytics:{tenantId}` | JWT |
| `GET /api/analytics/summary` | `authenticated` | `analytics:{tenantId}` | JWT |
| `GET /api/analytics/by-day` | `authenticated` | `analytics:{tenantId}` | JWT |
| `GET /api/analytics/top-posts` | `authenticated` | `analytics:{tenantId}` | JWT |
| `POST /api/notifications/send` | `authenticated` | `notif:{tenantId}` | JWT |

**Excluded from rate limiting** (have their own auth):
- `GET/POST /api/facebook/webhook` — Facebook signature verification
- `GET/POST /api/analytics/collect` — CRON_SECRET bearer auth
- `GET/POST /api/schedule/process` — CRON_SECRET bearer auth

**Integration pattern:**
```ts
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

// At start of handler:
const rl = checkRateLimit(`login:${ip}`, rateLimitConfig.auth);
if (!rl.allowed) {
  return NextResponse.json(
    { success: false, error: { code: 'RATE_LIMITED', message: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs! / 1000)} seconds.` } },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs! / 1000)), 'X-RateLimit-Remaining': String(rl.remaining) } }
  );
}

// After failed auth:
markAuthFailed(`login:${ip}`, rateLimitConfig.auth);

// After successful auth:
resetBackoff(`login:${ip}`);
```

### Auth Backoff Integration Pattern

Only `auth` and `auth_sensitive` tiers use backoff. The route handler is responsible for calling `markAuthFailed()` and `resetBackoff()` because it knows whether auth succeeded or failed.

**Login route flow:**
1. Check rate limit: `const rl = checkRateLimit(key, config)`
2. If `!rl.allowed` → return 429 with `Retry-After` header
3. Attempt authentication
4. If auth **fails** → call `markAuthFailed(key, config)` → return 401
5. If auth **succeeds** → call `resetBackoff(key)` → return 200

**Password change / profile update flow:**
1. User is already authenticated (JWT verified first)
2. Check rate limit: `const rl = checkRateLimit(key, config)`
3. If `!rl.allowed` → return 429
4. Perform operation
5. If operation **fails validation** (wrong current password) → call `markAuthFailed(key, config)`
6. If operation **succeeds** → call `resetBackoff(key)`

This keeps the rate limiter pure (no auth logic) and the route handlers own the success/failure decision.

### Error Response Format

All rate-limited responses follow the API envelope:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many attempts. Try again in 45 seconds."
  }
}
```

### Files Changed

| File | Action |
|------|--------|
| `src/lib/rate-limit.ts` | Rewrite — add backoff, config-based limits |
| `src/lib/rate-limit-config.ts` | New — env-based tier configuration |
| `src/app/api/auth/login/route.ts` | Add backoff integration |
| `src/app/api/auth/register/route.ts` | Update to use config |
| `src/app/api/auth/password/route.ts` | Add rate limiting |
| `src/app/api/auth/profile/route.ts` | Add rate limiting |
| `src/app/api/auth/me/route.ts` | Add rate limiting |
| `src/app/api/posts/route.ts` | Add rate limiting |
| `src/app/api/posts/[id]/route.ts` | Add rate limiting |
| `src/app/api/comments/route.ts` | Add rate limiting |
| `src/app/api/comments/[id]/reply/route.ts` | Add rate limiting |
| `src/app/api/rules/route.ts` | Add rate limiting |
| `src/app/api/rules/[id]/route.ts` | Add rate limiting |
| `src/app/api/brand-voices/route.ts` | Add rate limiting |
| `src/app/api/brand-voices/[id]/route.ts` | Add rate limiting |
| `src/app/api/schedule/route.ts` | Add rate limiting |
| `src/app/api/schedule/[id]/route.ts` | Add rate limiting |
| `src/app/api/facebook/publish/route.ts` | Add rate limiting |
| `src/app/api/facebook/connect/route.ts` | Add rate limiting |
| `src/app/api/facebook/pages/route.ts` | Add rate limiting |
| `src/app/api/facebook/[pageId]/route.ts` | Add rate limiting |
| `src/app/api/upload/route.ts` | Add rate limiting |
| `src/app/api/analytics/route.ts` | Add rate limiting |
| `src/app/api/analytics/summary/route.ts` | Add rate limiting |
| `src/app/api/analytics/by-day/route.ts` | Add rate limiting |
| `src/app/api/analytics/top-posts/route.ts` | Add rate limiting |
| `src/app/api/notifications/send/route.ts` | Add rate limiting |
| `src/app/api/ai/caption/route.ts` | Update to use config |
| `src/app/api/ai/hashtags/route.ts` | Update to use config |
| `src/app/api/ai/image/analyze/route.ts` | Update to use config |

### Testing

1. **Unit:** Test `checkRateLimit`, `markAuthFailed`, `resetBackoff` in isolation
2. **Auth backoff:** Hit login 5x with wrong password, verify 6th request is delayed with Retry-After header, then succeed and verify backoff clears
3. **Tier isolation:** Verify `auth` tier limits don't affect `authenticated` tier
4. **Config override:** Set env vars, verify limits change without code changes
5. **Build:** `npm run build` must pass with 39/39 routes
