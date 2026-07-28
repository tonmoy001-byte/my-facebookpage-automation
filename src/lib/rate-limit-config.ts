export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export const rateLimitConfig = {
  auth: {
    limit: envInt('RL_AUTH_LIMIT', 5),
    windowMs: envInt('RL_AUTH_WINDOW_MS', 60_000),
    backoffMultiplier: envInt('RL_AUTH_BACKOFF_MULTIPLIER', 2),
    maxBackoffMs: envInt('RL_AUTH_MAX_BACKOFF_MS', 900_000),
  } satisfies RateLimitConfig,
  auth_sensitive: {
    limit: envInt('RL_AUTH_SENS_LIMIT', 3),
    windowMs: envInt('RL_AUTH_SENS_WINDOW_MS', 60_000),
    backoffMultiplier: envInt('RL_AUTH_SENS_BACKOFF_MULTIPLIER', 2),
    maxBackoffMs: envInt('RL_AUTH_SENS_MAX_BACKOFF_MS', 1_800_000),
  } satisfies RateLimitConfig,
  authenticated: {
    limit: envInt('RL_AUTHENTICATED_LIMIT', 60),
    windowMs: envInt('RL_AUTHENTICATED_WINDOW_MS', 60_000),
  } satisfies RateLimitConfig,
  ai: {
    limit: envInt('RL_AI_LIMIT', 10),
    windowMs: envInt('RL_AI_WINDOW_MS', 60_000),
  } satisfies RateLimitConfig,
  public: {
    limit: envInt('RL_PUBLIC_LIMIT', 30),
    windowMs: envInt('RL_PUBLIC_WINDOW_MS', 60_000),
  } satisfies RateLimitConfig,
} as const;
