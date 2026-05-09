export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string;
}

export interface TurnstileVerificationInput {
  token: string;
  remoteIp?: string;
}

export type TurnstileVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
    };

export interface TurnstileVerifier<TEnv extends TurnstileEnv = TurnstileEnv> {
  verify(input: TurnstileVerificationInput, env: TEnv): Promise<TurnstileVerificationResult>;
}

export class CloudflareTurnstileVerifier<TEnv extends TurnstileEnv = TurnstileEnv>
  implements TurnstileVerifier<TEnv>
{
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async verify(
    input: TurnstileVerificationInput,
    env: TEnv
  ): Promise<TurnstileVerificationResult> {
    const secret = readRequiredSecret(env.TURNSTILE_SECRET_KEY);
    const form = new URLSearchParams();

    form.set('secret', secret);
    form.set('response', input.token);

    if (input.remoteIp) {
      form.set('remoteip', input.remoteIp);
    }

    const response = await this.fetcher(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: form
      }
    );

    if (!response.ok) {
      return { ok: false };
    }

    const body = await response.json();

    if (!isSiteverifyResponse(body)) {
      return { ok: false };
    }

    return body.success ? { ok: true } : { ok: false };
  }
}

function readRequiredSecret(value: string | undefined): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured.');
  }

  return trimmedValue;
}

function isSiteverifyResponse(value: unknown): value is { success: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success?: unknown }).success === 'boolean'
  );
}
