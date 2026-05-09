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
