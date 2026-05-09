import { describe, expect, it } from 'vitest';

import worker from '../src/index';
import type { Env } from '../src/index';
import type { CvRequestPayload } from '../src/types';

const workerOrigin = 'https://cv-request-worker.example.test';
const executionContext = {} as ExecutionContext;

const validPayload: CvRequestPayload = {
  fullName: 'Alex Martin',
  requesterEmail: 'alex.martin@example.com',
  company: 'Example Consulting',
  profileUrl: 'https://www.example.com/profile/alex-martin',
  requestedCvType: 'full-dev',
  requestedLanguage: 'en',
  reason: 'Reviewing a senior software engineering opportunity.'
};

describe('cv request worker', () => {
  it('returns 200 for the health endpoint', async () => {
    const { fetchWorker } = createWorkerHarness();
    const response = await fetchWorker('/health');

    await expectJson(response, 200, { status: 'ok' });
  });

  it('persists a valid request and returns 202', async () => {
    const { db, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest(validPayload);
    const body = (await response.json()) as {
      requestId: string;
      status: string;
      message: string;
    };

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      status: 'pending',
      message: 'Your CV request was received and is pending review.'
    });
    expect(body).toHaveProperty('requestId');
    expect(String(body.requestId)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({
      id: body.requestId,
      fullName: validPayload.fullName,
      requesterEmail: validPayload.requesterEmail,
      company: validPayload.company,
      profileUrl: validPayload.profileUrl,
      requestedCvType: validPayload.requestedCvType,
      requestedLanguage: validPayload.requestedLanguage,
      reason: validPayload.reason,
      status: 'pending'
    });
    expect(db.inserts[0].createdAt).toBe(db.inserts[0].updatedAt);
    expect(Date.parse(db.inserts[0].createdAt)).not.toBeNaN();
  });

  it('returns 503 when persistence fails', async () => {
    const { db, postCvRequest } = createWorkerHarness({ failWrites: true });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 503, {
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.'
    });
    expect(db.inserts).toHaveLength(0);
  });

  it('accepts a valid email address', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      requesterEmail: 'alex.martin+cv@example.co.uk'
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: 'pending' });
  });

  it('accepts a valid payload without an optional profile URL', async () => {
    const { db, postCvRequest } = createWorkerHarness();
    const { profileUrl: _profileUrl, ...payloadWithoutProfileUrl } = validPayload;
    const response = await postCvRequest(payloadWithoutProfileUrl);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: 'pending' });
    expect(db.inserts[0].profileUrl).toBeNull();
  });

  it('returns 400 when required fields are missing', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({});
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ status: 'validation_error' });
    expect(errorCodes(body)).toEqual(
      expect.arrayContaining([
        ['fullName', 'required'],
        ['requesterEmail', 'required'],
        ['company', 'required'],
        ['requestedCvType', 'required'],
        ['requestedLanguage', 'required'],
        ['reason', 'required']
      ])
    );
  });

  it('does not persist validation failures', async () => {
    const { db, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({});

    expect(response.status).toBe(400);
    expect(db.inserts).toHaveLength(0);
  });

  it('returns 400 for an invalid email address', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      requesterEmail: 'alex.example.com'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requesterEmail', 'invalid_email']);
  });

  it('returns 400 for malformed email shapes', async () => {
    const { postCvRequest } = createWorkerHarness();
    const malformedEmails = [
      'alex@@example.com',
      '@example.com',
      'alex@',
      'alex@example',
      'alex@example..com',
      'alex@-example.com',
      'alex @example.com',
      'alex@exa mple.com',
      'alex@exam_ple.com'
    ];

    for (const requesterEmail of malformedEmails) {
      const response = await postCvRequest({
        ...validPayload,
        requesterEmail
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(errorCodes(body)).toContainEqual(['requesterEmail', 'invalid_email']);
    }
  });

  it('rejects pathological long email-like input without regex backtracking', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      requesterEmail: `${'a'.repeat(5000)}@${'b'.repeat(5000)}.com`
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toEqual(
      expect.arrayContaining([
        ['requesterEmail', 'too_long'],
        ['requesterEmail', 'invalid_email']
      ])
    );
  });

  it('returns 400 for an invalid profile URL', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      profileUrl: 'http://www.example.com/profile/alex-martin'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['profileUrl', 'invalid_url']);
  });

  it('returns 400 when a field exceeds its maximum length', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      reason: 'x'.repeat(2001)
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['reason', 'too_long']);
  });

  it('returns 400 for an invalid requested CV type', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      requestedCvType: 'complete'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requestedCvType', 'unsupported_cv_type']);
  });

  it('returns 400 for an invalid requested language', async () => {
    const { postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({
      ...validPayload,
      requestedLanguage: 'nl'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requestedLanguage', 'unsupported_language']);
  });
});

interface InsertedCvRequest {
  id: string;
  fullName: string;
  requesterEmail: string;
  company: string;
  profileUrl: string | null;
  requestedCvType: string;
  requestedLanguage: string;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface HarnessOptions {
  failWrites?: boolean;
}

class FakeD1Database {
  readonly inserts: InsertedCvRequest[] = [];

  constructor(private readonly options: HarnessOptions = {}) {}

  prepare(_query: string) {
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (this.options.failWrites) {
            throw new Error('D1 write failed');
          }

          const [
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
          ] = values;

          this.inserts.push({
            id: String(id),
            fullName: String(fullName),
            requesterEmail: String(requesterEmail),
            company: String(company),
            profileUrl: profileUrl === null ? null : String(profileUrl),
            requestedCvType: String(requestedCvType),
            requestedLanguage: String(requestedLanguage),
            reason: String(reason),
            status: String(status),
            createdAt: String(createdAt),
            updatedAt: String(updatedAt)
          });

          return {
            success: true,
            meta: {},
            results: []
          };
        }
      })
    };
  }
}

function createWorkerHarness(options: HarnessOptions = {}): {
  db: FakeD1Database;
  fetchWorker: (path: string, init?: RequestInit) => Promise<Response>;
  postCvRequest: (payload: unknown) => Promise<Response>;
} {
  const db = new FakeD1Database(options);
  const env: Env = {
    CV_REQUESTS_DB: db as unknown as D1Database
  };

  const fetchWorker = (path: string, init?: RequestInit): Promise<Response> =>
    worker.fetch(new Request(`${workerOrigin}${path}`, init), env, executionContext);

  const postCvRequest = (payload: unknown): Promise<Response> =>
    fetchWorker('/api/cv-requests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

  return { db, fetchWorker, postCvRequest };
}

async function expectJson(
  response: Response,
  status: number,
  expectedBody: Record<string, unknown>
): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual(expectedBody);
}

function errorCodes(body: unknown): Array<[string, string]> {
  if (!isValidationErrorBody(body)) {
    return [];
  }

  return body.errors.map((error) => [error.field, error.code]);
}

function isValidationErrorBody(body: unknown): body is {
  errors: Array<{
    field: string;
    code: string;
  }>;
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'errors' in body &&
    Array.isArray((body as { errors?: unknown }).errors)
  );
}
