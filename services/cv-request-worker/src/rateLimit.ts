export type RateLimitDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

export interface RateLimiter<TEnv> {
  check(request: Request, env: TEnv): Promise<RateLimitDecision>;
}

export function createInactiveRateLimiter<TEnv>(): RateLimiter<TEnv> {
  return {
    async check(): Promise<RateLimitDecision> {
      return { allowed: true };
    }
  };
}

interface RateLimitEnv {
  CV_REQUESTS_DB?: D1Database;
}

interface RateLimitRow {
  windowStartedAt: string;
  requestCount: number;
}

export interface D1RateLimiterOptions {
  windowSeconds?: number;
  maxRequests?: number;
  now?: () => number;
}

const defaultWindowSeconds = 600;
const defaultMaxRequests = 5;

export function createD1RateLimiter<TEnv extends RateLimitEnv>(
  options: D1RateLimiterOptions = {}
): RateLimiter<TEnv> {
  const windowSeconds = options.windowSeconds ?? defaultWindowSeconds;
  const maxRequests = options.maxRequests ?? defaultMaxRequests;
  const now = options.now ?? ((): number => Date.now());
  const windowMs = windowSeconds * 1000;

  return {
    async check(request: Request, env: TEnv): Promise<RateLimitDecision> {
      const db = env.CV_REQUESTS_DB;

      if (!db) {
        return { allowed: true };
      }

      try {
        const clientKey = await hashClientKey(readClientIp(request));
        const nowMs = now();

        // Best-effort cleanup keeps the table bounded; lexicographic
        // comparison is valid because every value is a UTC toISOString().
        await db
          .prepare('DELETE FROM cv_request_rate_limits WHERE windowStartedAt < ?')
          .bind(new Date(nowMs - windowMs).toISOString())
          .run();

        const existing = await db
          .prepare(
            'SELECT windowStartedAt, requestCount FROM cv_request_rate_limits WHERE clientKey = ?'
          )
          .bind(clientKey)
          .first<RateLimitRow>();

        const windowStartedAtMs = existing ? Date.parse(existing.windowStartedAt) : Number.NaN;
        const withinWindow =
          existing !== null &&
          Number.isFinite(windowStartedAtMs) &&
          nowMs - windowStartedAtMs < windowMs;

        if (!withinWindow) {
          await db
            .prepare(
              `INSERT INTO cv_request_rate_limits (clientKey, windowStartedAt, requestCount)
               VALUES (?, ?, 1)
               ON CONFLICT(clientKey)
               DO UPDATE SET windowStartedAt = excluded.windowStartedAt, requestCount = 1`
            )
            .bind(clientKey, new Date(nowMs).toISOString())
            .run();

          return { allowed: true };
        }

        if (existing!.requestCount >= maxRequests) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((windowMs - (nowMs - windowStartedAtMs)) / 1000)
          );

          return { allowed: false, retryAfterSeconds };
        }

        await db
          .prepare(
            'UPDATE cv_request_rate_limits SET requestCount = requestCount + 1 WHERE clientKey = ?'
          )
          .bind(clientKey)
          .run();

        return { allowed: true };
      } catch {
        // Fail-open: a rate-limiter outage must not take down the request form.
        return { allowed: true };
      }
    }
  };
}

function readClientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

async function hashClientKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
