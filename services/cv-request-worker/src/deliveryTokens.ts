export const defaultDeliveryTokenTtlSeconds = 7 * 24 * 60 * 60;

interface DeliveryTokenPayload {
  requestId: string;
  requestedCvType: string;
  requestedLanguage: string;
  expiresAt: number;
}

interface CreateDeliveryTokenInput {
  requestId: string;
  requestedCvType: string;
  requestedLanguage: string;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}

export type DeliveryTokenVerificationResult =
  | {
      ok: true;
      payload: DeliveryTokenPayload;
    }
  | {
      ok: false;
      reason: 'invalid' | 'expired';
    };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function createDeliveryToken({
  requestId,
  requestedCvType,
  requestedLanguage,
  secret,
  now = Date.now(),
  ttlSeconds = defaultDeliveryTokenTtlSeconds
}: CreateDeliveryTokenInput): Promise<string> {
  const payload: DeliveryTokenPayload = {
    requestId,
    requestedCvType,
    requestedLanguage,
    expiresAt: now + ttlSeconds * 1000
  };
  const encodedPayload = base64UrlEncodeBytes(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(encodedPayload, secret);

  return `${encodedPayload}.${base64UrlEncodeBytes(signature)}`;
}

export async function verifyDeliveryToken(
  token: string,
  secret: string,
  now = Date.now()
): Promise<DeliveryTokenVerificationResult> {
  const parts = token.split('.');

  if (parts.length !== 2) {
    return { ok: false, reason: 'invalid' };
  }

  const [encodedPayload, encodedSignature] = parts;
  const providedSignature = base64UrlDecodeBytes(encodedSignature);

  if (!encodedPayload || !providedSignature) {
    return { ok: false, reason: 'invalid' };
  }

  const expectedSignature = await signPayload(encodedPayload, secret);

  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: 'invalid' };
  }

  const payload = readPayload(encodedPayload);

  if (!payload) {
    return { ok: false, reason: 'invalid' };
  }

  if (payload.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

function readPayload(encodedPayload: string): DeliveryTokenPayload | undefined {
  const payloadBytes = base64UrlDecodeBytes(encodedPayload);

  if (!payloadBytes) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<DeliveryTokenPayload>;

    if (
      typeof parsed.requestId === 'string' &&
      isSafeCvType(parsed.requestedCvType) &&
      isSafeLanguage(parsed.requestedLanguage) &&
      typeof parsed.expiresAt === 'number' &&
      Number.isFinite(parsed.expiresAt)
    ) {
      return {
        requestId: parsed.requestId,
        requestedCvType: parsed.requestedCvType,
        requestedLanguage: parsed.requestedLanguage,
        expiresAt: parsed.expiresAt
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function signPayload(encodedPayload: string, secret: string): Promise<Uint8Array> {
  const trimmedSecret = secret.trim();

  if (!trimmedSecret) {
    throw new Error('CV_DELIVERY_TOKEN_SECRET is not configured.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(trimmedSecret),
    {
      name: 'HMAC',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(encodedPayload));

  return new Uint8Array(signature);
}

function isSafeCvType(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,40}$/u.test(value);
}

function isSafeLanguage(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2,8}$/u.test(value);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlDecodeBytes(value: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return undefined;
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  try {
    const binary = atob(paddedBase64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}
