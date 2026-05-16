import {
  createApprovalToken,
  verifyApprovalToken,
  type ApprovalAction
} from './approvalTokens';
import {
  createDeliveryToken,
  defaultDeliveryTokenTtlSeconds,
  verifyDeliveryToken
} from './deliveryTokens';
import { ResendEmailSender, type EmailSendResult, type EmailSender } from './email';
import { createD1RateLimiter, type RateLimiter } from './rateLimit';
import {
  CloudflareTurnstileVerifier,
  type TurnstileVerificationResult,
  type TurnstileVerifier
} from './turnstile';
import { validateCvRequestPayload } from './validation';

interface PrivateAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  CV_REQUESTS_DB: D1Database;
  CV_PRIVATE_ASSETS?: PrivateAssetsBinding;
  ALLOWED_ORIGINS?: string;
  RESEND_API_KEY: string;
  OWNER_NOTIFICATION_EMAIL: string;
  OWNER_NOTIFICATION_FROM_EMAIL: string;
  APPROVAL_TOKEN_SECRET: string;
  PUBLIC_SITE_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_API_TOKEN?: string;
  TURNSTILE_DEBUG?: string;
  CV_REQUEST_DEBUG?: string;
  CV_REQUEST_EMAIL_DEBUG?: string;
  CV_DELIVERY_ENABLED?: string;
  CV_DELIVERY_TOKEN_SECRET?: string;
  CV_DELIVERY_LINK_TTL_SECONDS?: string;
  CV_DELIVERY_MANIFEST_JSON?: string;
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

const htmlDecisionHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  vary: 'Accept'
} as const;

const negotiatedDecisionHeaders = {
  vary: 'Accept'
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
const adminRecentCvRequestsPath = '/api/admin/cv-requests/recent';
const defaultAdminRecentRequestsLimit = 20;
const maxAdminRecentRequestsLimit = 50;
const privateAssetOrigin = 'https://cv-private-assets.local';

type OwnerNotificationStatus = 'sent' | 'failed';

interface OwnerNotificationDebugFields {
  ownerNotificationStatus?: OwnerNotificationStatus;
  ownerNotificationFailureKind?: Exclude<EmailSendResult, { ok: true }>['failureKind'];
  resendHttpStatus?: number;
  resendErrorName?: string;
}

type AuditEventType =
  | 'request_created'
  | 'owner_notification_sent'
  | 'owner_notification_failed'
  | 'request_approved'
  | 'request_rejected'
  | 'requester_notification_sent'
  | 'requester_notification_failed'
  | 'cv_delivery_link_created'
  | 'cv_delivery_link_unavailable'
  | 'cv_download_succeeded'
  | 'cv_download_failed';

interface AuditEventMetadata {
  failureKind?: string;
  httpStatus?: number;
  resendErrorName?: string;
  requestedCvType?: string;
  requestedLanguage?: string;
}

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
  const rateLimiter = dependencies.rateLimiter ?? createD1RateLimiter<Env>();
  const turnstileVerifier =
    dependencies.turnstileVerifier ?? new CloudflareTurnstileVerifier<Env>();

  return {
    async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const approvalRoute = readApprovalRoute(url.pathname);
      const downloadRoute = readDownloadRoute(url.pathname);
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

      if (request.method === 'GET' && url.pathname === adminRecentCvRequestsPath) {
        return handleAdminRecentCvRequests(request, url, env);
      }

      if (request.method === 'GET' && downloadRoute) {
        return handleCvDownload(url, env, downloadRoute);
      }

      if (request.method === 'GET' && approvalRoute) {
        return handleApprovalAction(request, url, env, approvalRoute, emailSender);
      }

      if (url.pathname === adminRecentCvRequestsPath) {
        return methodNotAllowedResponse(url.pathname);
      }

      if (
        url.pathname === '/health' ||
        url.pathname === '/api/cv-requests' ||
        approvalRoute ||
        downloadRoute
      ) {
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

  let turnstileVerification: TurnstileVerificationResult;

  try {
    turnstileVerification = await turnstileVerifier.verify(
      {
        token: turnstileToken,
        remoteIp: readCfConnectingIp(request)
      },
      env
    );
  } catch {
    turnstileVerification = { ok: false, failureKind: 'siteverify_fetch_exception' };
  }

  if (!turnstileVerification.ok) {
    return turnstileVerificationFailedResponse(
      cors,
      readTurnstileDebugFields(env, turnstileVerification)
    );
  }

  const validation = validateCvRequestPayload(parsedBody.body);

  if (!validation.ok) {
    return jsonResponse({ status: 'validation_error', errors: validation.errors }, 400, cors);
  }

  if (!env.CV_REQUESTS_DB) {
    return serviceUnavailableResponse(
      cors,
      readPersistenceDebugFields(env, 'missing_d1_binding')
    );
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
    return serviceUnavailableResponse(
      cors,
      readPersistenceDebugFields(env, 'd1_insert_failed')
    );
  }

  await recordAuditEvent(env, requestId, 'request_created');

  let ownerNotificationStatus: OwnerNotificationStatus = 'sent';
  let ownerNotificationResult: EmailSendResult | undefined;
  let ownerNotificationAuditMetadata: AuditEventMetadata | undefined;

  try {
    const actionLinks = await createOwnerActionLinks(request.url, env, requestId);

    ownerNotificationResult = await emailSender.sendOwnerNotification(env, {
      requestId,
      payload: validation.payload,
      actionLinks
    });
    ownerNotificationStatus = ownerNotificationResult.ok ? 'sent' : 'failed';
    ownerNotificationAuditMetadata = readEmailFailureAuditMetadata(ownerNotificationResult);
  } catch {
    ownerNotificationStatus = 'failed';
    ownerNotificationAuditMetadata = { failureKind: 'exception' };
  }

  await recordAuditEvent(
    env,
    requestId,
    ownerNotificationStatus === 'sent'
      ? 'owner_notification_sent'
      : 'owner_notification_failed',
    ownerNotificationAuditMetadata
  );

  return acceptedCvRequestResponse(
    requestId,
    cors,
    readOwnerNotificationDebugFields(env, ownerNotificationStatus, ownerNotificationResult)
  );
}

function acceptedCvRequestResponse(
  requestId: string,
  cors?: CorsContext,
  debugFields: OwnerNotificationDebugFields = {}
): Response {
  const body: {
    requestId: string;
    status: string;
    message: string;
    ownerNotificationStatus?: OwnerNotificationStatus;
    ownerNotificationFailureKind?: Exclude<EmailSendResult, { ok: true }>['failureKind'];
    resendHttpStatus?: number;
    resendErrorName?: string;
  } = {
    requestId,
    status: 'pending',
    message: 'Your CV request was received and is pending review.'
  };

  if (debugFields.ownerNotificationStatus !== undefined) {
    body.ownerNotificationStatus = debugFields.ownerNotificationStatus;
  }

  if (debugFields.ownerNotificationFailureKind !== undefined) {
    body.ownerNotificationFailureKind = debugFields.ownerNotificationFailureKind;
  }

  if (debugFields.resendHttpStatus !== undefined) {
    body.resendHttpStatus = debugFields.resendHttpStatus;
  }

  if (debugFields.resendErrorName !== undefined) {
    body.resendErrorName = debugFields.resendErrorName;
  }

  return jsonResponse(body, 202, cors);
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

interface DownloadRoute {
  requestId: string;
}

interface CvRequestDownloadRow {
  id: string;
  status: string;
  requestedCvType: string;
  requestedLanguage: string;
}

interface DeliveryManifestEntry {
  assetPath: string;
  downloadFilename: string;
}

type DeliveryManifest = Record<string, Record<string, DeliveryManifestEntry>>;

interface AdminRecentCvRequestRow {
  requestId: string;
  status: string;
  requestedCvType: string;
  requestedLanguage: string;
  createdAt: string;
  updatedAt: string;
  eventType: string | null;
}

interface AdminRecentCvRequestSummary {
  requestId: string;
  status: string;
  requestedCvType: string;
  requestedLanguage: string;
  createdAt: string;
  updatedAt: string;
  eventTypes: string[];
}

async function handleAdminRecentCvRequests(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  const configuredToken = env.ADMIN_API_TOKEN?.trim();

  if (!configuredToken) {
    return adminConfigurationErrorResponse();
  }

  const submittedToken = readBearerToken(request.headers.get('authorization'));

  if (submittedToken === undefined) {
    return adminUnauthorizedResponse();
  }

  if (!constantTimeishEqual(submittedToken, configuredToken)) {
    return adminForbiddenResponse();
  }

  const limit = readAdminRecentRequestsLimit(url.searchParams.get('limit'));

  if (!limit.ok) {
    return jsonResponse(
      {
        status: 'validation_error',
        message: 'Use a positive integer limit no greater than 50.'
      },
      400
    );
  }

  if (!env.CV_REQUESTS_DB) {
    return adminServiceUnavailableResponse();
  }

  let rows: AdminRecentCvRequestRow[];

  try {
    const result = await env.CV_REQUESTS_DB.prepare(
      `SELECT
        r.id AS requestId,
        r.status AS status,
        r.requestedCvType AS requestedCvType,
        r.requestedLanguage AS requestedLanguage,
        r.createdAt AS createdAt,
        r.updatedAt AS updatedAt,
        e.eventType AS eventType
       FROM (
        SELECT id, status, requestedCvType, requestedLanguage, createdAt, updatedAt
        FROM cv_requests
        ORDER BY createdAt DESC
        LIMIT ?
       ) r
       LEFT JOIN cv_request_events e ON e.requestId = r.id
       ORDER BY r.createdAt DESC, e.createdAt ASC`
    )
      .bind(limit.value)
      .all<AdminRecentCvRequestRow>();

    rows = Array.isArray(result.results) ? result.results : [];
  } catch {
    return adminServiceUnavailableResponse();
  }

  return jsonResponse(
    {
      status: 'ok',
      limit: limit.value,
      requests: summarizeAdminRecentCvRequests(rows)
    },
    200
  );
}

function summarizeAdminRecentCvRequests(
  rows: AdminRecentCvRequestRow[]
): AdminRecentCvRequestSummary[] {
  const summaries: AdminRecentCvRequestSummary[] = [];
  const summariesByRequestId = new Map<string, AdminRecentCvRequestSummary>();

  for (const row of rows) {
    let summary = summariesByRequestId.get(row.requestId);

    if (!summary) {
      summary = {
        requestId: row.requestId,
        status: row.status,
        requestedCvType: row.requestedCvType,
        requestedLanguage: row.requestedLanguage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        eventTypes: []
      };
      summariesByRequestId.set(row.requestId, summary);
      summaries.push(summary);
    }

    if (row.eventType) {
      summary.eventTypes.push(row.eventType);
    }
  }

  return summaries;
}

function readAdminRecentRequestsLimit(
  rawLimit: string | null
): { ok: true; value: number } | { ok: false } {
  if (rawLimit === null) {
    return { ok: true, value: defaultAdminRecentRequestsLimit };
  }

  const trimmedLimit = rawLimit.trim();

  if (!/^[1-9][0-9]*$/u.test(trimmedLimit)) {
    return { ok: false };
  }

  const parsedLimit = Number(trimmedLimit);

  if (!Number.isSafeInteger(parsedLimit)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: Math.min(parsedLimit, maxAdminRecentRequestsLimit)
  };
}

function readBearerToken(authorizationHeader: string | null): string | undefined {
  const authorization = authorizationHeader?.trim();

  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  const token = match?.[1]?.trim();

  return token ? token : undefined;
}

function constantTimeishEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

async function handleApprovalAction(
  request: Request,
  url: URL,
  env: Env,
  route: ApprovalRoute,
  emailSender: EmailSender
): Promise<Response> {
  const responseFormat = readDecisionResponseFormat(request.headers.get('accept'));
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return invalidApprovalLinkResponse(responseFormat, 401);
  }

  let verification;

  try {
    verification = await verifyApprovalToken(token, env.APPROVAL_TOKEN_SECRET);
  } catch {
    return invalidApprovalLinkResponse(responseFormat, 401);
  }

  if (!verification.ok) {
    return verification.reason === 'expired'
      ? expiredApprovalLinkResponse(responseFormat)
      : invalidApprovalLinkResponse(responseFormat, 401);
  }

  if (
    verification.payload.action !== route.action ||
    verification.payload.requestId !== route.requestId
  ) {
    return invalidApprovalLinkResponse(responseFormat, 403);
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
    return decisionServiceUnavailableResponse(responseFormat);
  }

  if (!existingRequest) {
    return decisionResponse(
      'not_found',
      {
        status: 'not_found',
        message: 'CV request was not found.'
      },
      404,
      responseFormat
    );
  }

  if (existingRequest.status !== 'pending') {
    return alreadyFinalizedResponse(responseFormat);
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
      return alreadyFinalizedResponse(responseFormat);
    }
  } catch {
    return decisionServiceUnavailableResponse(responseFormat);
  }

  await recordAuditEvent(
    env,
    route.requestId,
    route.action === 'approve' ? 'request_approved' : 'request_rejected'
  );

  const deliveryLink =
    nextStatus === 'approved'
      ? await createRequesterDeliveryLink(request.url, env, existingRequest)
      : undefined;

  if (deliveryLink) {
    await recordAuditEvent(
      env,
      route.requestId,
      deliveryLink.auditEventType,
      deliveryLink.auditMetadata
    );
  }

  try {
    const requesterNotificationResult = await emailSender.sendRequesterDecisionNotification(env, {
      requestId: existingRequest.id,
      requesterName: existingRequest.fullName,
      requesterEmail: existingRequest.requesterEmail,
      requestedCvType: existingRequest.requestedCvType,
      requestedLanguage: existingRequest.requestedLanguage,
      decision: nextStatus,
      ...(deliveryLink?.downloadUrl ? { downloadLink: deliveryLink.downloadUrl } : {})
    });

    if (!requesterNotificationResult.ok) {
      await recordAuditEvent(
        env,
        route.requestId,
        'requester_notification_failed',
        readEmailFailureAuditMetadata(requesterNotificationResult)
      );
      return requesterNotificationFailedResponse(nextStatus, responseFormat);
    }
  } catch {
    await recordAuditEvent(env, route.requestId, 'requester_notification_failed', {
      failureKind: 'exception'
    });
    return requesterNotificationFailedResponse(nextStatus, responseFormat);
  }

  await recordAuditEvent(env, route.requestId, 'requester_notification_sent');

  return decisionResponse(
    nextStatus,
    {
      status: nextStatus,
      message:
        route.action === 'approve'
          ? readApprovedDecisionMessage(Boolean(deliveryLink?.downloadUrl))
          : 'CV request rejected. The requester was notified.'
    },
    200,
    responseFormat
  );
}

interface DeliveryLinkResult {
  downloadUrl?: string;
  auditEventType: Extract<
    AuditEventType,
    'cv_delivery_link_created' | 'cv_delivery_link_unavailable'
  >;
  auditMetadata: AuditEventMetadata;
}

async function createRequesterDeliveryLink(
  requestUrl: string,
  env: Env,
  cvRequest: CvRequestDecisionRow
): Promise<DeliveryLinkResult> {
  const auditMetadata = readDeliveryAuditMetadata(cvRequest);

  try {
    if (env.CV_DELIVERY_ENABLED !== 'true') {
      return deliveryLinkUnavailable('delivery_disabled', auditMetadata);
    }

    const secret = readOptionalConfig(env.CV_DELIVERY_TOKEN_SECRET);

    if (!secret) {
      return deliveryLinkUnavailable('missing_token_secret', auditMetadata);
    }

    if (!env.CV_PRIVATE_ASSETS) {
      return deliveryLinkUnavailable('missing_assets_binding', auditMetadata);
    }

    const ttlSeconds = readDeliveryLinkTtlSeconds(env.CV_DELIVERY_LINK_TTL_SECONDS);

    if (!ttlSeconds.ok) {
      return deliveryLinkUnavailable('invalid_ttl', auditMetadata);
    }

    const manifest = readDeliveryManifest(env.CV_DELIVERY_MANIFEST_JSON);

    if (!manifest.ok) {
      return deliveryLinkUnavailable(manifest.failureKind, auditMetadata);
    }

    if (!readDeliveryManifestEntry(manifest.value, cvRequest)) {
      return deliveryLinkUnavailable('manifest_entry_missing', auditMetadata);
    }

    const token = await createDeliveryToken({
      requestId: cvRequest.id,
      requestedCvType: cvRequest.requestedCvType,
      requestedLanguage: cvRequest.requestedLanguage,
      secret,
      ttlSeconds: ttlSeconds.value
    });

    return {
      downloadUrl: createDownloadUrl(requestUrl, cvRequest.id, token),
      auditEventType: 'cv_delivery_link_created',
      auditMetadata
    };
  } catch {
    return deliveryLinkUnavailable('delivery_link_exception', auditMetadata);
  }
}

function deliveryLinkUnavailable(
  failureKind: string,
  auditMetadata: AuditEventMetadata
): DeliveryLinkResult {
  return {
    auditEventType: 'cv_delivery_link_unavailable',
    auditMetadata: {
      ...auditMetadata,
      failureKind
    }
  };
}

function readApprovedDecisionMessage(hasDeliveryLink: boolean): string {
  return hasDeliveryLink
    ? 'CV request approved. The requester was notified with a temporary download link.'
    : 'CV request approved. The requester was notified that CV delivery will happen in a later follow-up. No CV file or download link was sent.';
}

async function handleCvDownload(
  url: URL,
  env: Env,
  route: DownloadRoute
): Promise<Response> {
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    await recordDownloadFailure(env, route.requestId, 'missing_token');
    return invalidDownloadLinkResponse(401);
  }

  const secret = readOptionalConfig(env.CV_DELIVERY_TOKEN_SECRET);

  if (!secret) {
    await recordDownloadFailure(env, route.requestId, 'missing_token_secret');
    return downloadServiceUnavailableResponse();
  }

  let verification;

  try {
    verification = await verifyDeliveryToken(token, secret);
  } catch {
    await recordDownloadFailure(env, route.requestId, 'token_verification_exception');
    return invalidDownloadLinkResponse(401);
  }

  if (!verification.ok) {
    await recordDownloadFailure(
      env,
      route.requestId,
      verification.reason === 'expired' ? 'expired_token' : 'invalid_token'
    );

    return verification.reason === 'expired'
      ? expiredDownloadLinkResponse()
      : invalidDownloadLinkResponse(401);
  }

  const tokenPayload = verification.payload;
  const tokenAuditMetadata = readDeliveryAuditMetadata(tokenPayload);

  if (tokenPayload.requestId !== route.requestId) {
    await recordDownloadFailure(env, route.requestId, 'request_id_mismatch', tokenAuditMetadata);
    return invalidDownloadLinkResponse(403);
  }

  if (env.CV_DELIVERY_ENABLED !== 'true') {
    await recordDownloadFailure(env, route.requestId, 'delivery_disabled', tokenAuditMetadata);
    return downloadServiceUnavailableResponse();
  }

  if (!env.CV_PRIVATE_ASSETS) {
    await recordDownloadFailure(env, route.requestId, 'missing_assets_binding', tokenAuditMetadata);
    return downloadServiceUnavailableResponse();
  }

  let existingRequest: CvRequestDownloadRow | null;

  try {
    existingRequest =
      (await env.CV_REQUESTS_DB.prepare(
        `SELECT id, status, requestedCvType, requestedLanguage
         FROM cv_requests
         WHERE id = ?`
      )
        .bind(route.requestId)
        .first<CvRequestDownloadRow>()) ?? null;
  } catch {
    await recordDownloadFailure(env, route.requestId, 'd1_read_failed', tokenAuditMetadata);
    return downloadServiceUnavailableResponse();
  }

  if (!existingRequest) {
    await recordDownloadFailure(env, route.requestId, 'request_not_found', tokenAuditMetadata);
    return downloadNotAvailableResponse(404);
  }

  if (existingRequest.status !== 'approved') {
    await recordDownloadFailure(env, route.requestId, 'request_not_approved', {
      requestedCvType: existingRequest.requestedCvType,
      requestedLanguage: existingRequest.requestedLanguage
    });
    return downloadNotAvailableResponse(403);
  }

  if (
    existingRequest.requestedCvType !== tokenPayload.requestedCvType ||
    existingRequest.requestedLanguage !== tokenPayload.requestedLanguage
  ) {
    await recordDownloadFailure(env, route.requestId, 'token_request_mismatch', {
      requestedCvType: existingRequest.requestedCvType,
      requestedLanguage: existingRequest.requestedLanguage
    });
    return invalidDownloadLinkResponse(403);
  }

  const manifest = readDeliveryManifest(env.CV_DELIVERY_MANIFEST_JSON);

  if (!manifest.ok) {
    await recordDownloadFailure(env, route.requestId, manifest.failureKind, tokenAuditMetadata);
    return downloadServiceUnavailableResponse();
  }

  const manifestEntry = readDeliveryManifestEntry(manifest.value, tokenPayload);

  if (!manifestEntry) {
    await recordDownloadFailure(env, route.requestId, 'manifest_entry_missing', tokenAuditMetadata);
    return downloadNotAvailableResponse(404);
  }

  let assetResponse: Response;

  try {
    assetResponse = await env.CV_PRIVATE_ASSETS.fetch(createPrivateAssetRequest(manifestEntry));
  } catch {
    await recordDownloadFailure(env, route.requestId, 'asset_fetch_failed', tokenAuditMetadata);
    return downloadServiceUnavailableResponse();
  }

  if (!assetResponse.ok || !assetResponse.body) {
    await recordDownloadFailure(env, route.requestId, 'asset_missing', tokenAuditMetadata);
    return downloadNotAvailableResponse(404);
  }

  await recordAuditEvent(env, route.requestId, 'cv_download_succeeded', tokenAuditMetadata);

  return new Response(assetResponse.body, {
    status: 200,
    headers: createHeaders({
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${manifestEntry.downloadFilename}"`,
      'cache-control': 'no-store'
    })
  });
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

function readDownloadRoute(pathname: string): DownloadRoute | undefined {
  const match = /^\/api\/cv-requests\/([^/]+)\/download$/u.exec(pathname);

  if (!match) {
    return undefined;
  }

  try {
    return {
      requestId: decodeURIComponent(match[1])
    };
  } catch {
    return undefined;
  }
}

function readChangedRowCount(result: D1Result): number | undefined {
  const changes = result.meta?.changes;
  return typeof changes === 'number' ? changes : undefined;
}

function createDownloadUrl(requestUrl: string, requestId: string, token: string): string {
  const downloadUrl = new URL(
    `/api/cv-requests/${encodeURIComponent(requestId)}/download`,
    requestUrl
  );
  downloadUrl.searchParams.set('token', token);

  return downloadUrl.toString();
}

function readDeliveryLinkTtlSeconds(
  value: string | undefined
): { ok: true; value: number } | { ok: false } {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return { ok: true, value: defaultDeliveryTokenTtlSeconds };
  }

  if (!/^[1-9][0-9]*$/u.test(trimmedValue)) {
    return { ok: false };
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue > 31_536_000) {
    return { ok: false };
  }

  return { ok: true, value: parsedValue };
}

function readDeliveryManifest(
  rawManifest: string | undefined
):
  | { ok: true; value: DeliveryManifest }
  | { ok: false; failureKind: 'missing_manifest' | 'invalid_manifest' } {
  const trimmedManifest = rawManifest?.trim();

  if (!trimmedManifest) {
    return { ok: false, failureKind: 'missing_manifest' };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedManifest);
  } catch {
    return { ok: false, failureKind: 'invalid_manifest' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, failureKind: 'invalid_manifest' };
  }

  const manifest: DeliveryManifest = {};

  for (const [requestedCvType, languageEntries] of Object.entries(parsed)) {
    if (!isSafeManifestKey(requestedCvType) || !isRecord(languageEntries)) {
      return { ok: false, failureKind: 'invalid_manifest' };
    }

    manifest[requestedCvType] = {};

    for (const [requestedLanguage, entry] of Object.entries(languageEntries)) {
      if (!isSafeLanguageKey(requestedLanguage) || !isRecord(entry)) {
        return { ok: false, failureKind: 'invalid_manifest' };
      }

      const assetPath = entry.assetPath;
      const downloadFilename = entry.downloadFilename;

      if (!isSafeAssetPath(assetPath) || !isSafeDownloadFilename(downloadFilename)) {
        return { ok: false, failureKind: 'invalid_manifest' };
      }

      manifest[requestedCvType][requestedLanguage] = {
        assetPath,
        downloadFilename
      };
    }
  }

  return { ok: true, value: manifest };
}

function readDeliveryManifestEntry(
  manifest: DeliveryManifest,
  request: {
    requestedCvType: string;
    requestedLanguage: string;
  }
): DeliveryManifestEntry | undefined {
  return manifest[request.requestedCvType]?.[request.requestedLanguage];
}

function createPrivateAssetRequest(manifestEntry: DeliveryManifestEntry): Request {
  return new Request(new URL(manifestEntry.assetPath, privateAssetOrigin), {
    method: 'GET'
  });
}

function readDeliveryAuditMetadata(request: {
  requestedCvType: string;
  requestedLanguage: string;
}): AuditEventMetadata {
  return {
    requestedCvType: request.requestedCvType,
    requestedLanguage: request.requestedLanguage
  };
}

async function recordDownloadFailure(
  env: Env,
  requestId: string,
  failureKind: string,
  metadata: AuditEventMetadata = {}
): Promise<void> {
  await recordAuditEvent(env, requestId, 'cv_download_failed', {
    ...metadata,
    failureKind
  });
}

async function recordAuditEvent(
  env: Env,
  requestId: string,
  eventType: AuditEventType,
  metadata?: AuditEventMetadata
): Promise<void> {
  try {
    await env.CV_REQUESTS_DB.prepare(
      `INSERT INTO cv_request_events (
        id,
        requestId,
        eventType,
        createdAt,
        metadataJson
      ) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        requestId,
        eventType,
        new Date().toISOString(),
        createAuditMetadataJson(metadata)
      )
      .run();
  } catch {
    // Audit writes are intentionally best-effort and must not expose internal errors.
  }
}

function readEmailFailureAuditMetadata(
  result: EmailSendResult | undefined
): AuditEventMetadata | undefined {
  if (!result || result.ok) {
    return undefined;
  }

  const metadata: AuditEventMetadata = {
    failureKind: result.failureKind
  };

  if ('httpStatus' in result && typeof result.httpStatus === 'number') {
    metadata.httpStatus = result.httpStatus;
  }

  if (result.failureKind === 'resend_http_error' && result.errorName !== undefined) {
    metadata.resendErrorName = result.errorName;
  }

  return metadata;
}

function createAuditMetadataJson(metadata: AuditEventMetadata | undefined): string | null {
  if (!metadata) {
    return null;
  }

  const safeMetadata: AuditEventMetadata = {};

  if (metadata.failureKind && /^[a-z0-9_:-]{1,80}$/u.test(metadata.failureKind)) {
    safeMetadata.failureKind = metadata.failureKind;
  }

  if (
    typeof metadata.httpStatus === 'number' &&
    Number.isInteger(metadata.httpStatus) &&
    metadata.httpStatus >= 100 &&
    metadata.httpStatus <= 599
  ) {
    safeMetadata.httpStatus = metadata.httpStatus;
  }

  if (
    metadata.resendErrorName &&
    /^[A-Za-z0-9._:-]{1,120}$/u.test(metadata.resendErrorName)
  ) {
    safeMetadata.resendErrorName = metadata.resendErrorName;
  }

  if (metadata.requestedCvType && /^[a-z][a-z0-9-]{0,40}$/u.test(metadata.requestedCvType)) {
    safeMetadata.requestedCvType = metadata.requestedCvType;
  }

  if (metadata.requestedLanguage && /^[a-z]{2,8}$/u.test(metadata.requestedLanguage)) {
    safeMetadata.requestedLanguage = metadata.requestedLanguage;
  }

  return Object.keys(safeMetadata).length > 0 ? JSON.stringify(safeMetadata) : null;
}

type DecisionResponseFormat = 'html' | 'json';

type DecisionPageKind =
  | 'approved'
  | 'rejected'
  | 'approved_notification_failed'
  | 'rejected_notification_failed'
  | 'already_finalized'
  | 'invalid_token'
  | 'expired_token'
  | 'not_found'
  | 'service_unavailable';

interface DecisionResponseBody {
  status: string;
  message: string;
}

interface DecisionPageContent {
  title: string;
  badge: string;
  explanation: string;
  tone: 'success' | 'notice' | 'warning' | 'error';
}

const decisionPageContent: Record<DecisionPageKind, DecisionPageContent> = {
  approved: {
    title: 'CV Request Approved',
    badge: 'Approved',
    explanation:
      'The decision has been recorded and the requester was notified. No CV file or download link was sent from this page.',
    tone: 'success'
  },
  rejected: {
    title: 'CV Request Rejected',
    badge: 'Rejected',
    explanation: 'The decision has been recorded and the requester was notified.',
    tone: 'notice'
  },
  approved_notification_failed: {
    title: 'Approval Recorded',
    badge: 'Notification failed',
    explanation:
      'The approval was saved, but the requester notification could not be sent right now. No CV file or download link was sent from this page.',
    tone: 'warning'
  },
  rejected_notification_failed: {
    title: 'Rejection Recorded',
    badge: 'Notification failed',
    explanation:
      'The rejection was saved, but the requester notification could not be sent right now.',
    tone: 'warning'
  },
  already_finalized: {
    title: 'Request Already Finalized',
    badge: 'Already finalized',
    explanation: 'This decision link has already been used, or the request was finalized earlier.',
    tone: 'notice'
  },
  invalid_token: {
    title: 'Invalid Decision Link',
    badge: 'Invalid link',
    explanation: 'This decision link could not be verified. No decision was changed.',
    tone: 'error'
  },
  expired_token: {
    title: 'Expired Decision Link',
    badge: 'Expired link',
    explanation: 'This decision link has expired. No decision was changed.',
    tone: 'error'
  },
  not_found: {
    title: 'Request Not Found',
    badge: 'Not found',
    explanation: 'The decision link is valid, but the request could not be found.',
    tone: 'error'
  },
  service_unavailable: {
    title: 'Service Temporarily Unavailable',
    badge: 'Service error',
    explanation: 'The decision could not be processed right now. Try again later.',
    tone: 'error'
  }
};

function invalidApprovalLinkResponse(
  responseFormat: DecisionResponseFormat,
  status: 401 | 403
): Response {
  return decisionResponse(
    'invalid_token',
    {
      status: 'invalid_token',
      message: 'The approval link is invalid.'
    },
    status,
    responseFormat
  );
}

function expiredApprovalLinkResponse(responseFormat: DecisionResponseFormat): Response {
  return decisionResponse(
    'expired_token',
    {
      status: 'expired_token',
      message: 'The approval link has expired.'
    },
    401,
    responseFormat
  );
}

function invalidDownloadLinkResponse(status: 401 | 403): Response {
  return jsonResponse(
    {
      status: 'invalid_token',
      message: 'The download link is invalid.'
    },
    status
  );
}

function expiredDownloadLinkResponse(): Response {
  return jsonResponse(
    {
      status: 'expired_token',
      message: 'The download link has expired.'
    },
    401
  );
}

function downloadNotAvailableResponse(status: 403 | 404): Response {
  return jsonResponse(
    {
      status: 'not_available',
      message: 'The requested CV is not available.'
    },
    status
  );
}

function alreadyFinalizedResponse(responseFormat: DecisionResponseFormat): Response {
  return decisionResponse(
    'already_finalized',
    {
      status: 'already_finalized',
      message: 'This CV request has already been finalized.'
    },
    409,
    responseFormat
  );
}

type PersistenceFailureKind = 'missing_d1_binding' | 'd1_insert_failed';

interface PersistenceFailureDebugFields {
  persistenceFailureKind?: PersistenceFailureKind;
}

function serviceUnavailableResponse(
  cors?: CorsContext,
  debugFields: PersistenceFailureDebugFields = {}
): Response {
  const body: {
    status: string;
    message: string;
    persistenceFailureKind?: PersistenceFailureKind;
  } = {
    status: 'service_unavailable',
    message: 'The CV request service is temporarily unavailable. Try again later.'
  };

  if (debugFields.persistenceFailureKind !== undefined) {
    body.persistenceFailureKind = debugFields.persistenceFailureKind;
  }

  return jsonResponse(body, 503, cors);
}

function adminConfigurationErrorResponse(): Response {
  return jsonResponse(
    {
      status: 'configuration_error',
      message: 'The admin CV request service is not configured right now.'
    },
    503
  );
}

function adminUnauthorizedResponse(): Response {
  return jsonResponse(
    {
      status: 'unauthorized',
      message: 'Admin authorization is required.'
    },
    401,
    undefined,
    { 'www-authenticate': 'Bearer' }
  );
}

function adminForbiddenResponse(): Response {
  return jsonResponse(
    {
      status: 'forbidden',
      message: 'Admin authorization was rejected.'
    },
    403
  );
}

function adminServiceUnavailableResponse(): Response {
  return jsonResponse(
    {
      status: 'service_unavailable',
      message: 'The admin CV request service is temporarily unavailable. Try again later.'
    },
    503
  );
}

function downloadServiceUnavailableResponse(): Response {
  return jsonResponse(
    {
      status: 'service_unavailable',
      message: 'The CV delivery service is temporarily unavailable. Try again later.'
    },
    503
  );
}

function decisionServiceUnavailableResponse(responseFormat: DecisionResponseFormat): Response {
  return decisionResponse(
    'service_unavailable',
    {
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.'
    },
    503,
    responseFormat
  );
}

function requesterNotificationFailedResponse(
  status: 'approved' | 'rejected',
  responseFormat: DecisionResponseFormat
): Response {
  return decisionResponse(
    status === 'approved' ? 'approved_notification_failed' : 'rejected_notification_failed',
    {
      status,
      message:
        'The decision was recorded, but requester notification could not be sent right now. No CV file or download link was sent.'
    },
    200,
    responseFormat
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

type TurnstileVerificationFailureResult = Extract<TurnstileVerificationResult, { ok: false }>;

type TurnstileFailureKind = TurnstileVerificationFailureResult['failureKind'];

interface TurnstileFailureDebugFields {
  siteverifyHttpStatus?: number;
  turnstileErrorCodes?: string[];
  turnstileFailureKind?: TurnstileFailureKind;
}

function turnstileVerificationFailedResponse(
  cors?: CorsContext,
  debugFields: TurnstileFailureDebugFields = {}
): Response {
  const body: {
    status: string;
    message: string;
    siteverifyHttpStatus?: number;
    turnstileErrorCodes?: string[];
    turnstileFailureKind?: TurnstileFailureKind;
  } = {
    status: 'turnstile_verification_failed',
    message: 'The anti-spam check failed. Try again.'
  };

  if (debugFields.siteverifyHttpStatus !== undefined) {
    body.siteverifyHttpStatus = debugFields.siteverifyHttpStatus;
  }

  if (debugFields.turnstileErrorCodes !== undefined) {
    body.turnstileErrorCodes = debugFields.turnstileErrorCodes;
  }

  if (debugFields.turnstileFailureKind !== undefined) {
    body.turnstileFailureKind = debugFields.turnstileFailureKind;
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

function readTurnstileDebugFields(
  env: Env,
  result: TurnstileVerificationFailureResult
): TurnstileFailureDebugFields {
  if (env.TURNSTILE_DEBUG !== 'true') {
    return {};
  }

  if (result.failureKind === 'siteverify_failed') {
    return {
      turnstileFailureKind: result.failureKind,
      turnstileErrorCodes: result.errorCodes,
      siteverifyHttpStatus: result.httpStatus
    };
  }

  if (result.failureKind === 'siteverify_http_error') {
    return {
      turnstileFailureKind: result.failureKind,
      siteverifyHttpStatus: result.httpStatus
    };
  }

  return {
    turnstileFailureKind: result.failureKind
  };
}

function readPersistenceDebugFields(
  env: Env,
  failureKind: PersistenceFailureKind
): PersistenceFailureDebugFields {
  return env.CV_REQUEST_DEBUG === 'true' ? { persistenceFailureKind: failureKind } : {};
}

function readOwnerNotificationDebugFields(
  env: Env,
  status: OwnerNotificationStatus,
  result: EmailSendResult | undefined
): OwnerNotificationDebugFields {
  if (env.CV_REQUEST_EMAIL_DEBUG !== 'true') {
    return {};
  }

  const debugFields: OwnerNotificationDebugFields = {
    ownerNotificationStatus: status
  };

  if (status === 'failed' && result && !result.ok) {
    debugFields.ownerNotificationFailureKind = result.failureKind;

    if ('httpStatus' in result && result.httpStatus !== undefined) {
      debugFields.resendHttpStatus = result.httpStatus;
    }

    if (result.failureKind === 'resend_http_error' && result.errorName !== undefined) {
      debugFields.resendErrorName = result.errorName;
    }
  }

  return debugFields;
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

function readOptionalConfig(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeManifestKey(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,40}$/u.test(value);
}

function isSafeLanguageKey(value: string): boolean {
  return /^[a-z]{2,8}$/u.test(value);
}

function isSafeAssetPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\/[A-Za-z0-9/_-]+\.pdf$/u.test(value) &&
    !value.includes('//') &&
    !value.includes('/../') &&
    !value.includes('/./')
  );
}

function isSafeDownloadFilename(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9._-]{1,160}\.pdf$/u.test(value) &&
    !value.includes('..')
  );
}

function isJsonContentType(contentType: string | null): boolean {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

function decisionResponse(
  pageKind: DecisionPageKind,
  body: DecisionResponseBody,
  status: number,
  responseFormat: DecisionResponseFormat
): Response {
  if (responseFormat === 'html') {
    return htmlDecisionResponse(pageKind, status);
  }

  return jsonResponse(body, status, undefined, negotiatedDecisionHeaders);
}

function htmlDecisionResponse(pageKind: DecisionPageKind, status: number): Response {
  return new Response(renderDecisionPage(decisionPageContent[pageKind]), {
    status,
    headers: createHeaders(htmlDecisionHeaders)
  });
}

function renderDecisionPage(page: DecisionPageContent): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #182230;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f6f7f9;
    }

    main {
      width: min(100%, 560px);
      padding: 32px;
      border: 1px solid #d7dde5;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 18px 50px rgba(16, 24, 40, 0.08);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .success {
      border-color: #abefc6;
      background: #ecfdf3;
      color: #05603a;
    }

    .notice {
      border-color: #b9d6fe;
      background: #eff6ff;
      color: #1849a9;
    }

    .warning {
      border-color: #fedf89;
      background: #fffaeb;
      color: #93370d;
    }

    .error {
      border-color: #fecaca;
      background: #fef2f2;
      color: #991b1b;
    }

    h1 {
      margin: 20px 0 12px;
      font-size: 1.75rem;
      line-height: 1.2;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: #475467;
      font-size: 1rem;
      line-height: 1.6;
    }

    .close {
      margin-top: 24px;
      color: #667085;
      font-size: 0.9375rem;
    }
  </style>
</head>
<body>
  <main aria-labelledby="decision-title">
    <span class="badge ${escapeHtml(page.tone)}">${escapeHtml(page.badge)}</span>
    <h1 id="decision-title">${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.explanation)}</p>
    <p class="close">You may close this page.</p>
  </main>
</body>
</html>`;
}

function readDecisionResponseFormat(acceptHeader: string | null): DecisionResponseFormat {
  const accept = acceptHeader?.trim();

  if (!accept) {
    return 'json';
  }

  const htmlPreference = readMediaPreference(accept, 'text/html');
  const jsonPreference = readMediaPreference(accept, 'application/json');

  if (
    jsonPreference &&
    (!htmlPreference || isSameOrHigherMediaPreference(jsonPreference, htmlPreference))
  ) {
    return 'json';
  }

  return htmlPreference ? 'html' : 'json';
}

interface MediaPreference {
  q: number;
  index: number;
}

function readMediaPreference(accept: string, mediaType: string): MediaPreference | undefined {
  let preference: MediaPreference | undefined;

  accept.split(',').forEach((rawItem, index) => {
    const [rawMediaType, ...rawParameters] = rawItem.split(';');
    const itemMediaType = rawMediaType?.trim().toLowerCase();

    if (itemMediaType !== mediaType) {
      return;
    }

    const q = readMediaQuality(rawParameters);

    if (q <= 0) {
      return;
    }

    if (!preference || q > preference.q || (q === preference.q && index < preference.index)) {
      preference = { q, index };
    }
  });

  return preference;
}

function readMediaQuality(parameters: string[]): number {
  for (const parameter of parameters) {
    const [name, value] = parameter.split('=', 2);

    if (name?.trim().toLowerCase() !== 'q') {
      continue;
    }

    const q = Number(value?.trim());
    return Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0;
  }

  return 1;
}

function isSameOrHigherMediaPreference(left: MediaPreference, right: MediaPreference): boolean {
  return left.q > right.q || (left.q === right.q && left.index < right.index);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
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
