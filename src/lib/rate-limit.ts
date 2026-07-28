import { RateLimitConfig } from './rate-limit-config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  consecutiveFailures: number;
  backoffUntil: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt && now > entry.backoffUntil) {
      store.delete(key);
    }
  }
}, 60_000);

function getOrCreate(key: string, now: number, windowMs: number): RateLimitEntry {
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs, consecutiveFailures: 0, backoffUntil: 0 };
    store.set(key, entry);
  }
  return entry;
}

/**
 * Check rate limit for a key against a tier config.
 * Returns whether the request is allowed, retry-after ms, and remaining count.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = getOrCreate(key, now, config.windowMs);

  // Check backoff
  if (entry.backoffUntil > now) {
    return { allowed: false, retryAfterMs: entry.backoffUntil - now, remaining: 0 };
  }

  // Check window limit
  if (entry.count >= config.limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: config.limit - entry.count };
}

/**
 * Record a failed auth attempt and apply exponential backoff.
 * Only meaningful for tiers with backoffMultiplier configured.
 */
export function markAuthFailed(key: string, config: RateLimitConfig): void {
  if (!config.backoffMultiplier || !config.maxBackoffMs) return;

  const now = Date.now();
  const entry = getOrCreate(key, now, config.windowMs);

  entry.consecutiveFailures++;
  const delay = Math.min(
    config.windowMs * Math.pow(config.backoffMultiplier, entry.consecutiveFailures - 1),
    config.maxBackoffMs
  );
  entry.backoffUntil = now + delay;
}

/**
 * Reset backoff after successful auth.
 */
export function resetBackoff(key: string): void {
  const entry = store.get(key);
  if (entry) {
    entry.consecutiveFailures = 0;
    entry.backoffUntil = 0;
  }
}

/**
 * Legacy wrapper — matches old checkRateLimit(key, limit, windowMs) signature.
 * Returns boolean for backward compatibility during migration.
 */
export function checkRateLimitLegacy(key: string, limit: number, windowMs: number): boolean {
  return checkRateLimit(key, { limit, windowMs }).allowed;
}
