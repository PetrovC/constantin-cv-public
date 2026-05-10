export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string;
}

export interface TurnstileVerificationInput {
  token: string;
  remoteIp?: string;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type TurnstileVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      failureKind: 'siteverify_failed';
      errorCodes: string[];
      httpStatus: number;
    }
  | {
      ok: false;
      failureKind: 'siteverify_http_error';
      httpStatus: number;
    }
  | {
      ok: false;
      failureKind:
        | 'siteverify_fetch_exception'
        | 'siteverify_invalid_json'
        | 'siteverify_unexpected_response';
    };

export interface TurnstileVerifier<TEnv extends TurnstileEnv = TurnstileEnv> {
  verify(input: TurnstileVerificationInput, env: TEnv): Promise<TurnstileVerificationResult>;
}

export class CloudflareTurnstileVerifier<TEnv extends TurnstileEnv = TurnstileEnv>
  implements TurnstileVerifier<TEnv>
{
  constructor(private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {}

  async verify(
    input: TurnstileVerificationInput,
    env: TEnv
  ): Promise<TurnstileVerificationResult> {
    const secret = readRequiredSecret(env.TURNSTILE_SECRET_KEY);
    const requestBody: {
      secret: string;
      response: string;
      remoteip?: string;
    } = {
      secret,
      response: input.token
    };

    if (input.remoteIp) {
      requestBody.remoteip = input.remoteIp;
    }

    let response: Response;

    try {
      const fetcher = this.fetcher;

      response = await fetcher(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );
    } catch {
      return { ok: false, failureKind: 'siteverify_fetch_exception' };
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      return response.ok
        ? { ok: false, failureKind: 'siteverify_invalid_json' }
        : {
            ok: false,
            failureKind: 'siteverify_http_error',
            httpStatus: response.status
          };
    }

    if (!isSiteverifyResponse(responseBody)) {
      return response.ok
        ? { ok: false, failureKind: 'siteverify_unexpected_response' }
        : {
            ok: false,
            failureKind: 'siteverify_http_error',
            httpStatus: response.status
          };
    }

    return responseBody.success
      ? { ok: true }
      : {
          ok: false,
          failureKind: 'siteverify_failed',
          errorCodes: responseBody['error-codes'] ?? [],
          httpStatus: response.status
        };
  }
}

function readRequiredSecret(value: string | undefined): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured.');
  }

  return trimmedValue;
}

function isSiteverifyResponse(value: unknown): value is {
  success: boolean;
  'error-codes'?: string[];
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success?: unknown }).success === 'boolean' &&
    isOptionalStringArray((value as { 'error-codes'?: unknown })['error-codes'])
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}
