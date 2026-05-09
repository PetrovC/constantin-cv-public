import { validateCvRequestPayload } from './validation';

export interface Env {}

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
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok' }, 200);
    }

    if (request.method === 'POST' && url.pathname === '/api/cv-requests') {
      return handleCvRequest(request);
    }

    if (url.pathname === '/health' || url.pathname === '/api/cv-requests') {
      return jsonResponse({ status: 'method_not_allowed', message: 'Method not allowed.' }, 405);
    }

    return jsonResponse({ status: 'not_found', message: 'Not found.' }, 404);
  }
};

export default worker;

async function handleCvRequest(request: Request): Promise<Response> {
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

  return jsonResponse(
    {
      status: 'workflow_not_active',
      message: 'CV request validation passed, but the approval workflow is not active yet.'
    },
    501
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
