import { describe, expect, it } from 'vitest';

import worker from '../src/index';
import type { CvRequestPayload } from '../src/types';

const workerOrigin = 'https://cv-request-worker.example.test';
const env = {};
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
    const response = await fetchWorker('/health');

    await expectJson(response, 200, { status: 'ok' });
  });

  it('accepts a valid payload but reports the workflow is not active', async () => {
    const response = await postCvRequest(validPayload);
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toEqual({
      status: 'workflow_not_active',
      message: 'CV request validation passed, but the approval workflow is not active yet.'
    });
  });

  it('accepts a valid payload without an optional profile URL', async () => {
    const { profileUrl: _profileUrl, ...payloadWithoutProfileUrl } = validPayload;
    const response = await postCvRequest(payloadWithoutProfileUrl);
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({ status: 'workflow_not_active' });
  });

  it('returns 400 when required fields are missing', async () => {
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

  it('returns 400 for an invalid email address', async () => {
    const response = await postCvRequest({
      ...validPayload,
      requesterEmail: 'alex.example.com'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requesterEmail', 'invalid_email']);
  });

  it('returns 400 for an invalid profile URL', async () => {
    const response = await postCvRequest({
      ...validPayload,
      profileUrl: 'http://www.example.com/profile/alex-martin'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['profileUrl', 'invalid_url']);
  });

  it('returns 400 when a field exceeds its maximum length', async () => {
    const response = await postCvRequest({
      ...validPayload,
      reason: 'x'.repeat(2001)
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['reason', 'too_long']);
  });

  it('returns 400 for an invalid requested CV type', async () => {
    const response = await postCvRequest({
      ...validPayload,
      requestedCvType: 'complete'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requestedCvType', 'unsupported_cv_type']);
  });

  it('returns 400 for an invalid requested language', async () => {
    const response = await postCvRequest({
      ...validPayload,
      requestedLanguage: 'nl'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(errorCodes(body)).toContainEqual(['requestedLanguage', 'unsupported_language']);
  });
});

async function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`${workerOrigin}${path}`, init), env, executionContext);
}

async function postCvRequest(payload: unknown): Promise<Response> {
  return fetchWorker('/api/cv-requests', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
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
