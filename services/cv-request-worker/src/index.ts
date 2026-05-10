import {
  createApprovalToken,
  verifyApprovalToken,
  type ApprovalAction
} from './approvalTokens';
import { ResendEmailSender, type EmailSender } from './email';
import { createInactiveRateLimiter, type RateLimiter } from './rateLimit';
import { CloudflareTurnstileVerifier, type TurnstileVerifier } from './turnstile';
import { validateCvRequestPayload } from './validation';

export interface Env {
  CV_REQUESTS_DB: D1Database;
  ALLOWED_ORIGINS?: string;
  RESEND_API_KEY: string;
  OWNER_NOTIFICATION_EMAIL: string;
  OWNER_NOTIFICATION_FROM_EMAIL: string;
  APPROVAL_TOKEN_SECRET: string;
  PUBLIC_SITE_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_DEBUG?: string;
}

type JsonBody =
  | Record<string, unknown>
  | {
      status: string;
      errors?: unknown[];
      message?: string;
    };

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const;

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
} as const;

const cvRequestsAllowedMethods = 'POST, OPTIONS';
const cvRequestsAllowedHeaders = 'content-type';
const preflightMaxAgeSeconds = '600';

interface WorkerDependencies {
  emailSender?: EmailSender;
  rateLimiter?: RateLimiter<Env>;
  turnstileVerifier?: TurnstileVerifier<Env>;
}

interface CvRequestWorker {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export function createWorker(dependencies: WorkerDependencies = {}): CvRequestWorker {
  const emailSender = dependencies.emailSender ?? new ResendEmailSender();
  const rateLimiter = dependencies.rateLimiter ?? createInactiveRateLimiter<Env>();
  const turnstileVerifier =
    dependencies.turnstileVerifier ?? new CloudflareTurnstileVerifier<Env>();

  return {
    async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const approvalRoute = readApprovalRoute(url.pathname);
      const cors = readCorsContext(request, env);

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse({ status: 'ok' }, 200);
      }

      if (request.method === 'OPTIONS' && url.pathname === '/api/cv-requests') {
        return handleCvRequestPreflight(request, cors);
      }

      if (request.method === 'POST' && url.pathname === '/api/cv-requests') {
        return handleCvRequest(request, env, emailSender, rateLimiter, turnstileVerifier, cors);
      }

      if (request.method === 'GET' && approvalRoute) {
        return handleApprovalAction(url, env, approvalRoute, emailSender);
      }

      if (url.pathname === '/health' || url.pathname === '/api/cv-requests' || approvalRoute) {
        return methodNotAllowedResponse(url.pathname, cors);
      }

      return jsonResponse({ status: 'not_found', message: 'Not found.' }, 404);
    }
  };
}

const worker = createWorker();

export default worker;

interface CorsContext {
  origin?: string;
  allowedOrigin?: string;
}

function handleCvRequestPreflight(request: Request, cors: CorsContext): Response {
  if (cors.origin && !cors.allowedOrigin) {
    return disallowedOriginResponse();
  }

  if (!cors.origin) {
    return jsonResponse(
      {
        status: 'disallowed_origin',
        message: 'This origin is not allowed to access the CV request API.'
      },
      403
    );
  }

  const requestedMethod = request.headers.get('access-control-request-method')?.trim();

  if (requestedMethod?.toUpperCase() !== 'POST') {
    return jsonResponse(
      { status: 'method_not_allowed', message: 'Method not allowed.' },
      405,
      cors,
      { allow: cvRequestsAllowedMethods }
    );
  }

  return new Response(null, {
    status: 204,
    headers: createHeaders(undefined, cors, {
      'access-control-allow-methods': cvRequestsAllowedMethods,
      'access-control-allow-headers': cvRequestsAllowedHeaders,
      'access-control-max-age': preflightMaxAgeSeconds
    })
  });
}

async function handleCvRequest(
  request: Request,
  env: Env,
  emailSender: EmailSender,
  rateLimiter: RateLimiter<Env>,
  turnstileVerifier: TurnstileVerifier<Env>,
  cors: CorsContext
): Promise<Response> {
  if (cors.origin && !cors.allowedOrigin) {
    return disallowedOriginResponse();
  }

  if (!isJsonContentType(request.headers.get('content-type'))) {
    return jsonResponse(
      {
        status: 'unsupported_content_type',
        message: 'Send the request with Content-Type: application/json.'
      },
      415,
      cors
    );
  }

  const rateLimit = await rateLimiter.check(request, env);

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds, cors);
  }

  const parsedBody = await readJsonBody(request);

  if (!parsedBody.ok) {
    return jsonResponse(
      {
        status: 'validation_error',
        errors: [
          {
            field: 'body',
            code: 'invalid_json',
            message: 'Send a valid JSON request body.'
          }
        ]
      },
      400,
      cors
    );
  }

  const turnstileToken = readTurnstileToken(parsedBody.body);

  if (!turnstileToken) {
    return missingTurnstileTokenResponse(cors);
  }

  if (!env.TURNSTILE_SECRET_KEY?.trim()) {
    return turnstileConfigurationErrorResponse(cors);
  }

  let turnstileVerification;

  try {
    turnstileVerification = await turnstileVerifier.verify(
      {
        token: turnstileToken,
        remoteIp: readCfConnectingIp(request)
      },
      env
    );
  } catch {
    return turnstileVerificationFailedResponse(cors);
  }

  if (!turnstileVerification.ok) {
    return turnstileVerificationFailedResponse(
      cors,
      readTurnstileDebugErrorCodes(env, turnstileVerification.errorCodes)
    );
  }

  const validation = validateCvRequestPayload(parsedBody.body);

  if (!validation.ok) {
    return jsonResponse({ status: 'validation_error', errors: validation.errors }, 400, cors);
  }

  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await env.CV_REQUESTS_DB.prepare(
      `INSERT INTO cv_requests (
        id,
        fullName,
        requesterEmail,
        company,
        profileUrl,
        requestedCvType,
        requestedLanguage,
        reason,
        status,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        requestId,
        validation.payload.fullName,
        validation.payload.requesterEmail,
        validation.payload.company,
        validation.payload.profileUrl ?? null,
        validation.payload.requestedCvType,
        validation.payload.requestedLanguage,
        validation.payload.reason,
        'pending',
        now,
        now
      )
      .run();
  } catch {
    return jsonResponse(
      {
        status: 'service_unavailable',
        message: 'The CV request service is temporarily unavailable. Try again later.'
      },
      503,
      cors
    );
  }

  try {
    const actionLinks = await createOwnerActionLinks(request.url, env, requestId);

    await emailSender.sendOwnerNotification(env, {
      requestId,
      payload: validation.payload,
      actionLinks
    });
  } catch {
    return acceptedCvRequestResponse(requestId, cors);
  }

  return acceptedCvRequestResponse(requestId, cors);
}

function acceptedCvRequestResponse(requestId: string, cors?: CorsContext): Response {
  return jsonResponse(
    {
      requestId,
      status: 'pending',
      message: 'Your CV request was received and is pending review.'
    },
    202,
    cors
  );
}

interface ApprovalRoute {
  requestId: string;
  action: ApprovalAction;
}

interface CvRequestDecisionRow {
  id: string;
  status: string;
  fullName: string;
  requesterEmail: string;
  requestedCvType: 'one-page' | 'full-dev';
  requestedLanguage: 'fr' | 'en' | 'de';
}

async function handleApprovalAction(
  url: URL,
  env: Env,
  route: ApprovalRoute,
  emailSender: EmailSender
): Promise<Response> {
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return invalidApprovalLinkResponse(401);
  }

  let verification;

  try {
    verification = await verifyApprovalToken(token, env.APPROVAL_TOKEN_SECRET);
  } catch {
    return invalidApprovalLinkResponse(401);
  }

  if (!verification.ok) {
    return invalidApprovalLinkResponse(401);
  }

  if (
    verification.payload.action !== route.action ||
    verification.payload.requestId !== route.requestId
  ) {
    return invalidApprovalLinkResponse(403);
  }

  let existingRequest: CvRequestDecisionRow | null;

  try {
    existingRequest =
      (await env.CV_REQUESTS_DB.prepare(
        `SELECT id, status, fullName, requesterEmail, requestedCvType, requestedLanguage
         FROM cv_requests
         WHERE id = ?`
      )
        .bind(route.requestId)
        .first<CvRequestDecisionRow>()) ?? null;
  } catch {
    return serviceUnavailableResponse();
  }

  if (!existingRequest) {
    return jsonResponse(
      {
        status: 'not_found',
        message: 'CV request was not found.'
      },
      404
    );
  }

  if (existingRequest.status !== 'pending') {
    return alreadyFinalizedResponse();
  }

  const nextStatus = route.action === 'approve' ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  try {
    const result = await env.CV_REQUESTS_DB.prepare(
      `UPDATE cv_requests
       SET status = ?, updatedAt = ?
       WHERE id = ? AND status = 'pending'`
    )
      .bind(nextStatus, now, route.requestId)
      .run();

    if (readChangedRowCount(result) === 0) {
      return alreadyFinalizedResponse();
    }
  } catch {
    return serviceUnavailableResponse();
  }

  try {
    await emailSender.sendRequesterDecisionNotification(env, {
      requestId: existingRequest.id,
      requesterName: existingRequest.fullName,
      requesterEmail: existingRequest.requesterEmail,
      requestedCvType: existingRequest.requestedCvType,
      requestedLanguage: existingRequest.requestedLanguage,
      decision: nextStatus
    });
  } catch {
    return requesterNotificationFailedResponse(nextStatus);
  }

  return jsonResponse(
    {
      status: nextStatus,
      message:
        route.action === 'approve'
          ? 'CV request approved. The requester was notified that CV delivery will happen in a later follow-up. No CV file or download link was sent.'
          : 'CV request rejected. The requester was notified.'
    },
    200
  );
}

async function createOwnerActionLinks(
  requestUrl: string,
  env: Env,
  requestId: string
): Promise<{ approve: string; reject: string }> {
  const [approveToken, rejectToken] = await Promise.all([
    createApprovalToken({
      requestId,
      action: 'approve',
      secret: env.APPROVAL_TOKEN_SECRET
    }),
    createApprovalToken({
      requestId,
      action: 'reject',
      secret: env.APPROVAL_TOKEN_SECRET
    })
  ]);

  return {
    approve: createOwnerActionUrl(requestUrl, requestId, 'approve', approveToken),
    reject: createOwnerActionUrl(requestUrl, requestId, 'reject', rejectToken)
  };
}

function createOwnerActionUrl(
  requestUrl: string,
  requestId: string,
  action: ApprovalAction,
  token: string
): string {
  const actionUrl = new URL(
    `/api/cv-requests/${encodeURIComponent(requestId)}/${action}`,
    requestUrl
  );
  actionUrl.searchParams.set('token', token);

  return actionUrl.toString();
}

function readApprovalRoute(pathname: string): ApprovalRoute | undefined {
  const match = /^\/api\/cv-requests\/([^/]+)\/(approve|reject)$/u.exec(pathname);

  if (!match) {
    return undefined;
  }

  try {
    return {
      requestId: decodeURIComponent(match[1]),
      action: match[2] as ApprovalAction
    };
  } catch {
    return undefined;
  }
}

function readChangedRowCount(result: D1Result): number | undefined {
  const changes = result.meta?.changes;
  return typeof changes === 'number' ? changes : undefined;
}

function invalidApprovalLinkResponse(status: 401 | 403): Response {
  return jsonResponse(
    {
      status: 'invalid_token',
      message: 'The approval link is invalid or expired.'
    },
    status
  );
}

function alreadyFinalizedResponse(): Response {
  return jsonResponse(
    {
      status: 'already_finalized',
      message: 'This CV request has already been finalized.'
    },
    409
  );
}

function serviceUnavailableResponse(): Response {
  return jsonResponse(
    {
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.'
    },
    503
  );
}

function requesterNotificationFailedResponse(status: 'approved' | 'rejected'): Response {
  return jsonResponse(
    {
      status,
      message:
        'The decision was recorded, but requester notification could not be sent right now. No CV file or download link was sent.'
    },
    200
  );
}

function disallowedOriginResponse(): Response {
  return jsonResponse(
    {
      status: 'disallowed_origin',
      message: 'This origin is not allowed to access the CV request API.'
    },
    403
  );
}

function rateLimitedResponse(retryAfterSeconds: number, cors?: CorsContext): Response {
  return jsonResponse(
    {
      status: 'rate_limited',
      retryAfterSeconds,
      message: 'Too many requests. Try again later.'
    },
    429,
    cors,
    { 'retry-after': String(retryAfterSeconds) }
  );
}

function missingTurnstileTokenResponse(cors?: CorsContext): Response {
  return jsonResponse(
    {
      status: 'validation_error',
      errors: [
        {
          field: 'turnstileToken',
          code: 'required',
          message: 'Complete the anti-spam check.'
        }
      ]
    },
    400,
    cors
  );
}

function turnstileConfigurationErrorResponse(cors?: CorsContext): Response {
  return jsonResponse(
    {
      status: 'configuration_error',
      message: 'The CV request service is not configured to accept submissions right now.'
    },
    503,
    cors
  );
}

function turnstileVerificationFailedResponse(
  cors?: CorsContext,
  errorCodes?: string[]
): Response {
  const body: {
    status: string;
    message: string;
    turnstileErrorCodes?: string[];
  } = {
    status: 'turnstile_verification_failed',
    message: 'The anti-spam check failed. Try again.'
  };

  if (errorCodes) {
    body.turnstileErrorCodes = errorCodes;
  }

  return jsonResponse(body, 403, cors);
}

function methodNotAllowedResponse(pathname: string, cors?: CorsContext): Response {
  const allowedMethods = pathname === '/api/cv-requests' ? cvRequestsAllowedMethods : 'GET';

  return jsonResponse(
    { status: 'method_not_allowed', message: 'Method not allowed.' },
    405,
    cors,
    { allow: allowedMethods }
  );
}

async function readJsonBody(request: Request): Promise<
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
    }
> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

function readTurnstileToken(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }

  const token = (body as { turnstileToken?: unknown }).turnstileToken;
  const trimmedToken = typeof token === 'string' ? token.trim() : '';

  return trimmedToken ? trimmedToken : undefined;
}

function readTurnstileDebugErrorCodes(
  env: Env,
  errorCodes: string[] | undefined
): string[] | undefined {
  return env.TURNSTILE_DEBUG === 'true' ? (errorCodes ?? []) : undefined;
}

function readCfConnectingIp(request: Request): string | undefined {
  const remoteIp = request.headers.get('cf-connecting-ip')?.trim();
  return remoteIp ? remoteIp : undefined;
}

function readCorsContext(request: Request, env: Env): CorsContext {
  const rawOrigin = request.headers.get('origin')?.trim();

  if (!rawOrigin) {
    return {};
  }

  const origin = normalizeOrigin(rawOrigin);

  if (!origin) {
    return { origin: rawOrigin };
  }

  return {
    origin,
    allowedOrigin: readAllowedOrigins(env.ALLOWED_ORIGINS).has(origin) ? origin : undefined
  };
}

function readAllowedOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();

  for (const part of value?.split(',') ?? []) {
    const origin = normalizeOrigin(part);

    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
}

function normalizeOrigin(value: string | null | undefined): string | undefined {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    const url = new URL(trimmedValue);
    return url.origin;
  } catch {
    return undefined;
  }
}

function isJsonContentType(contentType: string | null): boolean {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

function jsonResponse(
  body: JsonBody,
  status: number,
  cors?: CorsContext,
  extraHeaders?: HeadersInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: createHeaders(jsonHeaders, cors, extraHeaders)
  });
}

function createHeaders(
  baseHeaders?: HeadersInit,
  cors?: CorsContext,
  extraHeaders?: HeadersInit
): Headers {
  const headers = new Headers(securityHeaders);

  mergeHeaders(headers, baseHeaders);
  mergeHeaders(headers, extraHeaders);

  if (cors?.allowedOrigin) {
    headers.set('access-control-allow-origin', cors.allowedOrigin);
    headers.append('vary', 'Origin');
  }

  return headers;
}

function mergeHeaders(headers: Headers, values?: HeadersInit): void {
  if (!values) {
    return;
  }

  new Headers(values).forEach((value, key) => {
    headers.set(key, value);
  });
}
