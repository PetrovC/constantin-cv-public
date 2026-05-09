import { validateCvRequestPayload } from './validation';

export interface Env {
  CV_REQUESTS_DB: D1Database;
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

const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok' }, 200);
    }

    if (request.method === 'POST' && url.pathname === '/api/cv-requests') {
      return handleCvRequest(request, env);
    }

    if (url.pathname === '/health' || url.pathname === '/api/cv-requests') {
      return jsonResponse({ status: 'method_not_allowed', message: 'Method not allowed.' }, 405);
    }

    return jsonResponse({ status: 'not_found', message: 'Not found.' }, 404);
  }
};

export default worker;

async function handleCvRequest(request: Request, env: Env): Promise<Response> {
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

  return jsonResponse(
    {
      requestId,
      status: 'pending',
      message: 'Your CV request was received and is pending review.'
    },
    202
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
