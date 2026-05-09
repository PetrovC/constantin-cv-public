export const approvalActions = ['approve', 'reject'] as const;

export type ApprovalAction = (typeof approvalActions)[number];

export const approvalTokenTtlSeconds = 7 * 24 * 60 * 60;

interface ApprovalTokenPayload {
  requestId: string;
  action: ApprovalAction;
  expiresAt: number;
}

interface CreateApprovalTokenInput {
  requestId: string;
  action: ApprovalAction;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}

export type ApprovalTokenVerificationResult =
  | {
      ok: true;
      payload: ApprovalTokenPayload;
    }
  | {
      ok: false;
      reason: 'invalid' | 'expired';
    };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function createApprovalToken({
  requestId,
  action,
  secret,
  now = Date.now(),
  ttlSeconds = approvalTokenTtlSeconds
}: CreateApprovalTokenInput): Promise<string> {
  const payload: ApprovalTokenPayload = {
    requestId,
    action,
    expiresAt: now + ttlSeconds * 1000
  };
  const encodedPayload = base64UrlEncodeBytes(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(encodedPayload, secret);

  return `${encodedPayload}.${base64UrlEncodeBytes(signature)}`;
}

export async function verifyApprovalToken(
  token: string,
  secret: string,
  now = Date.now()
): Promise<ApprovalTokenVerificationResult> {
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

function readPayload(encodedPayload: string): ApprovalTokenPayload | undefined {
  const payloadBytes = base64UrlDecodeBytes(encodedPayload);

  if (!payloadBytes) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<ApprovalTokenPayload>;

    if (
      typeof parsed.requestId === 'string' &&
      isApprovalAction(parsed.action) &&
      typeof parsed.expiresAt === 'number' &&
      Number.isFinite(parsed.expiresAt)
    ) {
      return {
        requestId: parsed.requestId,
        action: parsed.action,
        expiresAt: parsed.expiresAt
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isApprovalAction(value: unknown): value is ApprovalAction {
  return typeof value === 'string' && approvalActions.includes(value as ApprovalAction);
}

async function signPayload(encodedPayload: string, secret: string): Promise<Uint8Array> {
  const trimmedSecret = secret.trim();

  if (!trimmedSecret) {
    throw new Error('APPROVAL_TOKEN_SECRET is not configured.');
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
