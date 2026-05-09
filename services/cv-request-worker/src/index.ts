import {
  createApprovalToken,
  verifyApprovalToken,
  type ApprovalAction
} from './approvalTokens';
import { ResendEmailSender, type EmailSender } from './email';
import { validateCvRequestPayload } from './validation';

export interface Env {
  CV_REQUESTS_DB: D1Database;
  RESEND_API_KEY: string;
  OWNER_NOTIFICATION_EMAIL: string;
  OWNER_NOTIFICATION_FROM_EMAIL: string;
  APPROVAL_TOKEN_SECRET: string;
  PUBLIC_SITE_URL?: string;
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

interface WorkerDependencies {
  emailSender?: EmailSender;
}

interface CvRequestWorker {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export function createWorker(dependencies: WorkerDependencies = {}): CvRequestWorker {
  const emailSender = dependencies.emailSender ?? new ResendEmailSender();

  return {
    async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const approvalRoute = readApprovalRoute(url.pathname);

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse({ status: 'ok' }, 200);
      }

      if (request.method === 'POST' && url.pathname === '/api/cv-requests') {
        return handleCvRequest(request, env, emailSender);
      }

      if (request.method === 'GET' && approvalRoute) {
        return handleApprovalAction(url, env, approvalRoute);
      }

      if (url.pathname === '/health' || url.pathname === '/api/cv-requests' || approvalRoute) {
        return jsonResponse({ status: 'method_not_allowed', message: 'Method not allowed.' }, 405);
      }

      return jsonResponse({ status: 'not_found', message: 'Not found.' }, 404);
    }
  };
}

const worker = createWorker();

export default worker;

async function handleCvRequest(
  request: Request,
  env: Env,
  emailSender: EmailSender
): Promise<Response> {
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
      400
    );
  }

  const validation = validateCvRequestPayload(parsedBody.body);

  if (!validation.ok) {
    return jsonResponse({ status: 'validation_error', errors: validation.errors }, 400);
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
      503
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
    return acceptedCvRequestResponse(requestId);
  }

  return acceptedCvRequestResponse(requestId);
}

function acceptedCvRequestResponse(requestId: string): Response {
  return jsonResponse(
    {
      requestId,
      status: 'pending',
      message: 'Your CV request was received and is pending review.'
    },
    202
  );
}

interface ApprovalRoute {
  requestId: string;
  action: ApprovalAction;
}

interface CvRequestStatusRow {
  id: string;
  status: string;
}

async function handleApprovalAction(
  url: URL,
  env: Env,
  route: ApprovalRoute
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

  let existingRequest: CvRequestStatusRow | null;

  try {
    existingRequest =
      (await env.CV_REQUESTS_DB.prepare(
        'SELECT id, status FROM cv_requests WHERE id = ?'
      )
        .bind(route.requestId)
        .first<CvRequestStatusRow>()) ?? null;
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

  return jsonResponse(
    {
      status: nextStatus,
      message:
        route.action === 'approve'
          ? 'CV request approved. No CV has been sent by this endpoint.'
          : 'CV request rejected. No requester email has been sent by this endpoint.'
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

function jsonResponse(body: JsonBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}
