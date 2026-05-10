import { describe, expect, it } from 'vitest';

import { createApprovalToken, type ApprovalAction } from '../src/approvalTokens';
import { createWorker } from '../src/index';
import {
  ResendEmailSender,
  type EmailEnv,
  type EmailSender,
  type EmailSendResult,
  type OwnerNotificationEmail,
  type RequesterDecisionEmail
} from '../src/email';
import type { Env } from '../src/index';
import type { CvRequestPayload } from '../src/types';
import {
  CloudflareTurnstileVerifier,
  type TurnstileVerificationInput,
  type TurnstileVerifier
} from '../src/turnstile';

const workerOrigin = 'https://cv-request-worker.example.test';
const allowedOrigin = 'https://portfolio.example.test';
const disallowedOrigin = 'https://not-allowed.example.test';
const approvalTokenSecret = 'test-approval-token-secret';
const turnstileSecret = 'test-turnstile-secret';
const validTurnstileToken = 'test-turnstile-token';
const turnstileErrorCodes = ['invalid-input-response', 'timeout-or-duplicate'];
const d1DatabaseId = 'test-d1-database-id';
const executionContext = {} as ExecutionContext;
const browserAccept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const jsonAccept = 'application/json, text/html;q=0.8';

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

  it('posts Turnstile verification to Cloudflare Siteverify', async () => {
    let siteverifyUrl: string | undefined;
    let siteverifyInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      siteverifyUrl = String(input);
      siteverifyInit = init;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    };
    const verifier = new CloudflareTurnstileVerifier(fetcher);
    const result = await verifier.verify(
      {
        token: 'site-token',
        remoteIp: '203.0.113.10'
      },
      {
        TURNSTILE_SECRET_KEY: 'site-secret'
      }
    );
    const siteverifyBody = parseSiteverifyRequestBody(siteverifyInit?.body);

    expect(result).toEqual({ ok: true });
    expect(siteverifyUrl).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(siteverifyInit?.method).toBe('POST');
    expect(new Headers(siteverifyInit?.headers).get('content-type')).toBe(
      'application/json'
    );
    expect(siteverifyBody).toEqual({
      secret: 'site-secret',
      response: 'site-token',
      remoteip: '203.0.113.10'
    });
  });

  it('binds the default Siteverify fetch to globalThis', async () => {
    const originalFetch = globalThis.fetch;
    let fetchThis: unknown;

    globalThis.fetch = async function (this: unknown) {
      fetchThis = this;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    } as typeof fetch;

    try {
      const verifier = new CloudflareTurnstileVerifier();
      const result = await verifier.verify(
        {
          token: 'site-token'
        },
        {
          TURNSTILE_SECRET_KEY: 'site-secret'
        }
      );

      expect(result).toEqual({ ok: true });
      expect(fetchThis).toBe(globalThis);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('omits the Siteverify remoteip field when no remote IP is present', async () => {
    let siteverifyInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      siteverifyInit = init;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    };
    const verifier = new CloudflareTurnstileVerifier(fetcher);
    const result = await verifier.verify(
      {
        token: 'site-token'
      },
      {
        TURNSTILE_SECRET_KEY: 'site-secret'
      }
    );
    const siteverifyBody = parseSiteverifyRequestBody(siteverifyInit?.body);

    expect(result).toEqual({ ok: true });
    expect(siteverifyBody).toEqual({
      secret: 'site-secret',
      response: 'site-token'
    });
    expect(siteverifyBody).not.toHaveProperty('remoteip');
  });

  it('reads Cloudflare Siteverify error codes from failed Turnstile verification', async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ success: false, 'error-codes': turnstileErrorCodes }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    const verifier = new CloudflareTurnstileVerifier(fetcher);
    const result = await verifier.verify(
      {
        token: 'site-token'
      },
      {
        TURNSTILE_SECRET_KEY: 'site-secret'
      }
    );

    expect(result).toEqual({
      ok: false,
      failureKind: 'siteverify_failed',
      errorCodes: turnstileErrorCodes,
      httpStatus: 200
    });
  });

  it('handles OPTIONS preflight for an allowed origin', async () => {
    const { fetchWorker } = createWorkerHarness();
    const response = await fetchWorker('/api/cv-requests', {
      method: 'OPTIONS',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type');
    expect(response.headers.get('access-control-max-age')).toBe('600');
    expect(response.headers.get('vary')).toContain('Origin');
    expect(await response.text()).toBe('');
  });

  it('rejects OPTIONS preflight for a disallowed origin', async () => {
    const { fetchWorker } = createWorkerHarness();
    const response = await fetchWorker('/api/cv-requests', {
      method: 'OPTIONS',
      headers: {
        origin: disallowedOrigin,
        'access-control-request-method': 'POST'
      }
    });

    await expectJson(response, 403, {
      status: 'disallowed_origin',
      message: 'This origin is not allowed to access the CV request API.'
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows a POST from a configured origin through the normal request path', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest(validPayload, {
      headers: {
        origin: allowedOrigin
      }
    });
    const body = (await response.json()) as { requestId: string; status: string };

    expect(response.status).toBe(202);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(body).toMatchObject({ status: 'pending' });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0].id).toBe(body.requestId);
    expect(emailSender.notifications).toHaveLength(1);
  });

  it('rejects a POST from a disallowed origin before persistence', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest(validPayload, {
      headers: {
        origin: disallowedOrigin
      }
    });

    await expectJson(response, 403, {
      status: 'disallowed_origin',
      message: 'This origin is not allowed to access the CV request API.'
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('rejects missing or invalid content types', async () => {
    const { fetchWorker } = createWorkerHarness();
    const missingContentTypeResponse = await fetchWorker('/api/cv-requests', {
      method: 'POST',
      body: JSON.stringify(validPayload)
    });
    const invalidContentTypeResponse = await fetchWorker('/api/cv-requests', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: JSON.stringify(validPayload)
    });
    const expectedBody = {
      status: 'unsupported_content_type',
      message: 'Send the request with Content-Type: application/json.'
    };

    await expectJson(missingContentTypeResponse, 415, expectedBody);
    await expectJson(invalidContentTypeResponse, 415, expectedBody);
  });

  it('rejects invalid JSON before validation', async () => {
    const { fetchWorker } = createWorkerHarness();
    const response = await fetchWorker('/api/cv-requests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{'
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ status: 'validation_error' });
    expect(errorCodes(body)).toContainEqual(['body', 'invalid_json']);
  });

  it('returns 400 when the Turnstile token is missing', async () => {
    const { db, emailSender, postCvRequest, turnstileVerifier } = createWorkerHarness();
    const response = await postCvRequest(validPayload, {
      body: JSON.stringify(validPayload)
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ status: 'validation_error' });
    expect(errorCodes(body)).toContainEqual(['turnstileToken', 'required']);
    expect(turnstileVerifier.verifications).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns 503 when TURNSTILE_SECRET_KEY is missing', async () => {
    const { db, emailSender, postCvRequest, turnstileVerifier } = createWorkerHarness({
      omitTurnstileSecret: true
    });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 503, {
      status: 'configuration_error',
      message: 'The CV request service is not configured to accept submissions right now.'
    });
    expect(turnstileVerifier.verifications).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns 403 when Turnstile verification fails', async () => {
    const { postCvRequest, turnstileVerifier } = createWorkerHarness({
      failTurnstile: true
    });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 403, {
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.'
    });
    expect(turnstileVerifier.verifications).toHaveLength(1);
  });

  it('omits Turnstile debug diagnostics when TURNSTILE_DEBUG is disabled', async () => {
    const { postCvRequest } = createWorkerHarness({
      failTurnstile: true,
      turnstileErrorCodes
    });
    const response = await postCvRequest(validPayload);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.'
    });
    expect(body).not.toHaveProperty('siteverifyHttpStatus');
    expect(body).not.toHaveProperty('turnstileErrorCodes');
    expect(body).not.toHaveProperty('turnstileFailureKind');
    expect(body).not.toHaveProperty('errorCodes');
  });

  it('includes Turnstile error codes and failure kind when TURNSTILE_DEBUG is true', async () => {
    const { postCvRequest } = createWorkerHarness({
      failTurnstile: true,
      turnstileDebug: true,
      turnstileErrorCodes
    });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 403, {
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 200,
      turnstileErrorCodes,
      turnstileFailureKind: 'siteverify_failed'
    });
  });

  it('returns Siteverify failure codes from the real verifier path in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-failed-submitted-token';
    const { db, emailSender, postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response(JSON.stringify({ success: false, 'error-codes': turnstileErrorCodes }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 200,
      turnstileErrorCodes,
      turnstileFailureKind: 'siteverify_failed'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns Siteverify error codes from a non-OK Siteverify JSON response in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-non-ok-failed-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response(JSON.stringify({ success: false, 'error-codes': turnstileErrorCodes }), {
        status: 400,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 400,
      turnstileErrorCodes,
      turnstileFailureKind: 'siteverify_failed'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('returns the Siteverify fetch exception failure kind from the real verifier path in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-fetch-exception-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async (_input, init) => {
      const siteverifyBody = parseSiteverifyRequestBody(init?.body);

      throw new Error(
        `Private fetch detail: token=${siteverifyBody.response}; secret=${siteverifyBody.secret}`
      );
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      turnstileFailureKind: 'siteverify_fetch_exception'
    });
    expect(responseText).not.toContain('Private fetch detail');
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('returns the Siteverify HTTP error failure kind for a non-OK invalid JSON response in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-http-error-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response(`token=${submittedTurnstileToken}; secret=${turnstileSecret}`, {
        status: 503,
        headers: {
          'content-type': 'text/plain'
        }
      })
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 503,
      turnstileFailureKind: 'siteverify_http_error'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('returns the Siteverify HTTP error failure kind for a non-OK unexpected JSON response in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-http-unexpected-response-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response(
        JSON.stringify({
          success: 'false',
          token: submittedTurnstileToken,
          secret: turnstileSecret
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 400,
      turnstileFailureKind: 'siteverify_http_error'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('returns the Siteverify invalid JSON failure kind from the real verifier path in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-invalid-json-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response('{', {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      turnstileFailureKind: 'siteverify_invalid_json'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('returns the Siteverify unexpected response failure kind from the real verifier path in debug mode', async () => {
    const submittedTurnstileToken = 'siteverify-unexpected-response-submitted-token';
    const { postCvRequest } = createSiteverifyWorkerHarness(async () =>
      new Response(
        JSON.stringify({
          success: 'false',
          token: submittedTurnstileToken,
          secret: turnstileSecret
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      turnstileFailureKind: 'siteverify_unexpected_response'
    });
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('includes an empty Turnstile error code list when TURNSTILE_DEBUG is true and no codes are available', async () => {
    const { postCvRequest } = createWorkerHarness({
      failTurnstile: true,
      turnstileDebug: true
    });
    const response = await postCvRequest(validPayload);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      siteverifyHttpStatus: 200,
      turnstileErrorCodes: [],
      turnstileFailureKind: 'siteverify_failed'
    });
    expect(body).not.toHaveProperty('errorCodes');
  });

  it('keeps thrown verifier details private when TURNSTILE_DEBUG is true', async () => {
    const submittedTurnstileToken = 'exception-submitted-turnstile-token';
    const { postCvRequest } = createWorkerHarness({
      throwTurnstile: true,
      turnstileDebug: true
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(responseText)).toEqual({
      status: 'turnstile_verification_failed',
      message: 'The anti-spam check failed. Try again.',
      turnstileFailureKind: 'siteverify_fetch_exception'
    });
    expect(responseText).not.toContain('Raw Turnstile exception details');
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('never returns the submitted Turnstile token in a failed verification response', async () => {
    const submittedTurnstileToken = 'submitted-turnstile-token';
    const { postCvRequest } = createWorkerHarness({
      failTurnstile: true,
      turnstileDebug: true,
      turnstileErrorCodes
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expectFailedTurnstileResponseNotToLeak(responseText, submittedTurnstileToken);
  });

  it('does not persist or send email when Turnstile verification fails', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness({
      failTurnstile: true
    });
    const response = await postCvRequest(validPayload);

    expect(response.status).toBe(403);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('continues the normal request flow after successful Turnstile verification', async () => {
    const { db, emailSender, postCvRequest, turnstileVerifier } = createWorkerHarness();
    const response = await postCvRequest(validPayload, {
      headers: {
        'cf-connecting-ip': '203.0.113.9'
      }
    });

    expect(response.status).toBe(202);
    expect(turnstileVerifier.verifications).toHaveLength(1);
    expect(turnstileVerifier.verifications[0].input).toEqual({
      token: validTurnstileToken,
      remoteIp: '203.0.113.9'
    });
    expect(db.inserts).toHaveLength(1);
    expect(emailSender.notifications).toHaveLength(1);
  });

  it('adds security headers to API responses', async () => {
    const { fetchWorker } = createWorkerHarness();
    const response = await fetchWorker('/health');

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
  });

  it('persists a valid request, sends the owner notification, and returns 202', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness();
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

    expect(emailSender.notifications).toHaveLength(1);
    expect(emailSender.notifications[0].env).toEqual(
      expect.objectContaining({
        RESEND_API_KEY: 'test-resend-api-key',
        OWNER_NOTIFICATION_EMAIL: 'owner@example.com',
        OWNER_NOTIFICATION_FROM_EMAIL: 'cv-requests@example.com',
        PUBLIC_SITE_URL: 'https://www.example.com'
      })
    );
    expect(emailSender.notifications[0].notification).toMatchObject({
      requestId: body.requestId,
      payload: validPayload
    });
    expectOwnerActionLink(
      emailSender.notifications[0].notification.actionLinks.approve,
      body.requestId,
      'approve'
    );
    expectOwnerActionLink(
      emailSender.notifications[0].notification.actionLinks.reject,
      body.requestId,
      'reject'
    );
  });

  it('keeps the request persisted and returns 202 when owner notification fails', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness({ failEmail: true });
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
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0].id).toBe(body.requestId);
    expect(emailSender.notifications).toHaveLength(1);
    expect(emailSender.notifications[0].notification).toMatchObject({
      requestId: body.requestId,
      payload: validPayload,
      actionLinks: {
        approve: expect.any(String),
        reject: expect.any(String)
      }
    });
  });

  it('returns ownerNotificationStatus sent when email debug is true and owner notification succeeds', async () => {
    const { postCvRequest } = createWorkerHarness({ cvRequestEmailDebug: true });
    const response = await postCvRequest(validPayload);
    const body = (await response.json()) as {
      ownerNotificationStatus?: string;
    };
    const { postCvRequest: postCvRequestWithoutDebug } = createWorkerHarness();
    const responseWithoutDebug = await postCvRequestWithoutDebug(validPayload);
    const bodyWithoutDebug = await responseWithoutDebug.json();

    expect(response.status).toBe(202);
    expect(body.ownerNotificationStatus).toBe('sent');
    expect(responseWithoutDebug.status).toBe(202);
    expect(bodyWithoutDebug).not.toHaveProperty('ownerNotificationStatus');
  });

  it('returns ownerNotificationStatus failed when email debug is true and owner notification fails', async () => {
    const { postCvRequest } = createWorkerHarness({
      cvRequestEmailDebug: true,
      failEmail: true
    });
    const response = await postCvRequest(validPayload);
    const body = (await response.json()) as {
      ownerNotificationStatus?: string;
    };

    expect(response.status).toBe(202);
    expect(body.ownerNotificationStatus).toBe('failed');
  });

  it('keeps the current POST response shape when email debug is disabled', async () => {
    const { postCvRequest } = createWorkerHarness({ failEmail: true });
    const response = await postCvRequest(validPayload);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({
      requestId: expect.any(String),
      status: 'pending',
      message: 'Your CV request was received and is pending review.'
    });
  });

  it('keeps owner email debug responses free of emails, API keys, tokens, and private request data', async () => {
    const submittedTurnstileToken = 'owner-email-debug-submitted-turnstile-token';
    const { emailSender, postCvRequest } = createWorkerHarness({
      cvRequestEmailDebug: true,
      failEmail: true
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();
    const body = JSON.parse(responseText) as { ownerNotificationStatus?: string };
    const notification = emailSender.notifications[0].notification;
    const approvalTokens = [
      new URL(notification.actionLinks.approve).searchParams.get('token'),
      new URL(notification.actionLinks.reject).searchParams.get('token')
    ].filter((token): token is string => token !== null);

    expect(response.status).toBe(202);
    expect(body.ownerNotificationStatus).toBe('failed');
    expectOwnerNotificationDebugResponseNotToLeak(
      responseText,
      submittedTurnstileToken,
      approvalTokens
    );
  });

  it.each([
    ['invalid_api_key', { name: 'invalid_api_key' }],
    ['validation_error', { code: 'validation_error' }]
  ])(
    'returns safe Resend 403 %s owner notification diagnostics only when email debug is true',
    async (resendErrorName, resendErrorBody) => {
      const rawResendErrorMessage =
        `Raw Resend error message: key=test-resend-api-key; to=owner@example.com; ` +
        `from=cv-requests@example.com; requester=${validPayload.requesterEmail}; name=${validPayload.fullName}.`;

      await expectResendOwnerNotificationFailureDebug({
        fetcher: createResendJsonResponseFetcher(403, {
          ...resendErrorBody,
          message: rawResendErrorMessage
        }),
        expectedDebugFields: {
          ownerNotificationFailureKind: 'resend_http_error',
          resendHttpStatus: 403,
          resendErrorName
        },
        rawPrivateValues: [rawResendErrorMessage]
      });
    }
  );

  it('returns safe Resend 422 invalid_from_address owner notification diagnostics only when email debug is true', async () => {
    const rawResendErrorMessage =
      `Raw Resend invalid sender message: from=cv-requests@example.com; ` +
      `requester=${validPayload.requesterEmail}; name=${validPayload.fullName}.`;

    await expectResendOwnerNotificationFailureDebug({
      fetcher: createResendJsonResponseFetcher(422, {
        type: 'invalid_from_address',
        message: rawResendErrorMessage
      }),
      expectedDebugFields: {
        ownerNotificationFailureKind: 'resend_http_error',
        resendHttpStatus: 422,
        resendErrorName: 'invalid_from_address'
      },
      rawPrivateValues: [rawResendErrorMessage]
    });
  });

  it('returns resend_fetch_exception when the Resend owner notification request throws', async () => {
    const rawFetchExceptionMessage =
      `Raw Resend fetch exception: key=test-resend-api-key; requester=${validPayload.requesterEmail}; ` +
      `name=${validPayload.fullName}.`;

    await expectResendOwnerNotificationFailureDebug({
      fetcher: async () => {
        throw new Error(rawFetchExceptionMessage);
      },
      expectedDebugFields: {
        ownerNotificationFailureKind: 'resend_fetch_exception'
      },
      rawPrivateValues: [rawFetchExceptionMessage]
    });
  });

  it('adds approve and reject links to the owner notification', async () => {
    const { emailSender, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest(validPayload);
    const body = (await response.json()) as { requestId: string };
    const notification = emailSender.notifications[0].notification;

    expectOwnerActionLink(notification.actionLinks.approve, body.requestId, 'approve');
    expectOwnerActionLink(notification.actionLinks.reject, body.requestId, 'reject');
  });

  it('approves a pending request with a valid approve link and notifies the requester', async () => {
    const harness = createWorkerHarness();
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(approveUrl, {
      headers: {
        accept: jsonAccept
      }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual({
      status: 'approved',
      message:
        'CV request approved. The requester was notified that CV delivery will happen in a later follow-up. No CV file or download link was sent.'
    });
    expect(harness.db.find(requestId)).toMatchObject({
      id: requestId,
      status: 'approved'
    });
    expect(Date.parse(harness.db.find(requestId)?.updatedAt ?? '')).not.toBeNaN();
    expectRequesterDecisionNotification(harness.emailSender, requestId, 'approved');
  });

  it('returns a safe HTML approval page for browser Accept headers', async () => {
    const harness = createWorkerHarness();
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(approveUrl, {
      headers: {
        accept: browserAccept
      }
    });
    const responseText = await expectDecisionHtml(response, 200, [
      'CV Request Approved',
      'Approved',
      'You may close this page.'
    ]);

    expect(harness.db.find(requestId)?.status).toBe('approved');
    expectDecisionPageNotToLeak(responseText, {
      requestId,
      approvalTokens: [readActionToken(approveUrl)]
    });
  });

  it('rejects a pending request with a valid reject link and notifies the requester', async () => {
    const harness = createWorkerHarness();
    const { requestId, rejectUrl } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(rejectUrl);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'rejected',
      message: 'CV request rejected. The requester was notified.'
    });
    expect(harness.db.find(requestId)).toMatchObject({
      id: requestId,
      status: 'rejected'
    });
    expectRequesterDecisionNotification(harness.emailSender, requestId, 'rejected');
  });

  it('returns a safe HTML rejection page for browser Accept headers', async () => {
    const harness = createWorkerHarness();
    const { requestId, rejectUrl } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(rejectUrl, {
      headers: {
        accept: browserAccept
      }
    });
    const responseText = await expectDecisionHtml(response, 200, [
      'CV Request Rejected',
      'Rejected',
      'You may close this page.'
    ]);

    expect(harness.db.find(requestId)?.status).toBe('rejected');
    expectDecisionPageNotToLeak(responseText, {
      requestId,
      approvalTokens: [readActionToken(rejectUrl)]
    });
  });

  it('keeps the request approved when requester notification fails', async () => {
    const harness = createWorkerHarness({ failRequesterEmail: true });
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(approveUrl);

    await expectJson(response, 200, {
      status: 'approved',
      message:
        'The decision was recorded, but requester notification could not be sent right now. No CV file or download link was sent.'
    });
    expect(harness.db.find(requestId)).toMatchObject({
      id: requestId,
      status: 'approved'
    });
    expectRequesterDecisionNotification(harness.emailSender, requestId, 'approved');
  });

  it('returns safe HTML notification failure pages for approve and reject decisions', async () => {
    for (const scenario of [
      {
        decision: 'approved' as const,
        expectedTitle: 'Approval Recorded',
        readUrl: (links: { approveUrl: string; rejectUrl: string }) => links.approveUrl
      },
      {
        decision: 'rejected' as const,
        expectedTitle: 'Rejection Recorded',
        readUrl: (links: { approveUrl: string; rejectUrl: string }) => links.rejectUrl
      }
    ]) {
      const harness = createWorkerHarness({ failRequesterEmail: true });
      const links = await createPendingRequest(harness);
      const actionUrl = scenario.readUrl(links);
      const response = await harness.fetchWorker(actionUrl, {
        headers: {
          accept: browserAccept
        }
      });
      const responseText = await expectDecisionHtml(response, 200, [
        scenario.expectedTitle,
        'Notification failed',
        'You may close this page.'
      ]);

      expect(harness.db.find(links.requestId)?.status).toBe(scenario.decision);
      expectDecisionPageNotToLeak(responseText, {
        requestId: links.requestId,
        approvalTokens: [readActionToken(actionUrl)]
      });
    }
  });

  it('rejects an invalid approval token', async () => {
    const harness = createWorkerHarness();
    const { requestId } = await createPendingRequest(harness);
    const response = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=not-a-token`
    );

    await expectJson(response, 401, {
      status: 'invalid_token',
      message: 'The approval link is invalid.'
    });
    expect(harness.db.find(requestId)?.status).toBe('pending');
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('rejects an expired approval token', async () => {
    const harness = createWorkerHarness();
    const { requestId } = await createPendingRequest(harness);
    const expiredToken = await createApprovalToken({
      requestId,
      action: 'approve',
      secret: approvalTokenSecret,
      now: Date.now() - 60_000,
      ttlSeconds: 1
    });
    const response = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=${expiredToken}`
    );

    await expectJson(response, 401, {
      status: 'expired_token',
      message: 'The approval link has expired.'
    });
    expect(harness.db.find(requestId)?.status).toBe('pending');
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('returns safe HTML pages for invalid and expired approval tokens', async () => {
    const harness = createWorkerHarness();
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const invalidToken = 'not-a-token';
    const invalidResponse = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=${invalidToken}`,
      {
        headers: {
          accept: browserAccept
        }
      }
    );
    const invalidResponseText = await expectDecisionHtml(invalidResponse, 401, [
      'Invalid Decision Link',
      'Invalid link',
      'You may close this page.'
    ]);
    const expiredToken = await createApprovalToken({
      requestId,
      action: 'approve',
      secret: approvalTokenSecret,
      now: Date.now() - 60_000,
      ttlSeconds: 1
    });
    const expiredResponse = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=${expiredToken}`,
      {
        headers: {
          accept: browserAccept
        }
      }
    );
    const expiredResponseText = await expectDecisionHtml(expiredResponse, 401, [
      'Expired Decision Link',
      'Expired link',
      'You may close this page.'
    ]);

    expect(harness.db.find(requestId)?.status).toBe('pending');
    expectDecisionPageNotToLeak(invalidResponseText, {
      requestId,
      approvalTokens: [readActionToken(approveUrl), invalidToken]
    });
    expectDecisionPageNotToLeak(expiredResponseText, {
      requestId,
      approvalTokens: [readActionToken(approveUrl), expiredToken]
    });
  });

  it('rejects a token action mismatch', async () => {
    const harness = createWorkerHarness();
    const { requestId } = await createPendingRequest(harness);
    const rejectToken = await createApprovalToken({
      requestId,
      action: 'reject',
      secret: approvalTokenSecret
    });
    const response = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=${rejectToken}`
    );

    await expectJson(response, 403, {
      status: 'invalid_token',
      message: 'The approval link is invalid.'
    });
    expect(harness.db.find(requestId)?.status).toBe('pending');
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('rejects a token request id mismatch', async () => {
    const harness = createWorkerHarness();
    const { requestId } = await createPendingRequest(harness);
    const otherRequestId = '11111111-1111-4111-8111-111111111111';
    const tokenForOtherRequest = await createApprovalToken({
      requestId: otherRequestId,
      action: 'approve',
      secret: approvalTokenSecret
    });
    const response = await harness.fetchWorker(
      `/api/cv-requests/${requestId}/approve?token=${tokenForOtherRequest}`
    );

    await expectJson(response, 403, {
      status: 'invalid_token',
      message: 'The approval link is invalid.'
    });
    expect(harness.db.find(requestId)?.status).toBe('pending');
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('returns 404 when the signed request id does not exist', async () => {
    const harness = createWorkerHarness();
    const unknownRequestId = '22222222-2222-4222-8222-222222222222';
    const token = await createApprovalToken({
      requestId: unknownRequestId,
      action: 'approve',
      secret: approvalTokenSecret
    });
    const response = await harness.fetchWorker(
      `/api/cv-requests/${unknownRequestId}/approve?token=${token}`
    );

    await expectJson(response, 404, {
      status: 'not_found',
      message: 'CV request was not found.'
    });
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('returns a safe HTML page when the signed request id does not exist', async () => {
    const harness = createWorkerHarness();
    const unknownRequestId = '22222222-2222-4222-8222-222222222222';
    const token = await createApprovalToken({
      requestId: unknownRequestId,
      action: 'approve',
      secret: approvalTokenSecret
    });
    const response = await harness.fetchWorker(
      `/api/cv-requests/${unknownRequestId}/approve?token=${token}`,
      {
        headers: {
          accept: browserAccept
        }
      }
    );
    const responseText = await expectDecisionHtml(response, 404, [
      'Request Not Found',
      'Not found',
      'You may close this page.'
    ]);

    expectDecisionPageNotToLeak(responseText, {
      requestId: unknownRequestId,
      approvalTokens: [token]
    });
    expect(harness.emailSender.requesterNotifications).toHaveLength(0);
  });

  it('returns 409 when the request has already been finalized', async () => {
    const harness = createWorkerHarness();
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const firstResponse = await harness.fetchWorker(approveUrl);
    const secondResponse = await harness.fetchWorker(approveUrl);

    expect(firstResponse.status).toBe(200);
    await expectJson(secondResponse, 409, {
      status: 'already_finalized',
      message: 'This CV request has already been finalized.'
    });
    expect(harness.db.find(requestId)?.status).toBe('approved');
    expect(harness.emailSender.requesterNotifications).toHaveLength(1);
  });

  it('returns a safe HTML page when the request has already been finalized', async () => {
    const harness = createWorkerHarness();
    const { requestId, approveUrl } = await createPendingRequest(harness);
    const firstResponse = await harness.fetchWorker(approveUrl, {
      headers: {
        accept: jsonAccept
      }
    });
    const secondResponse = await harness.fetchWorker(approveUrl, {
      headers: {
        accept: browserAccept
      }
    });
    const responseText = await expectDecisionHtml(secondResponse, 409, [
      'Request Already Finalized',
      'Already finalized',
      'You may close this page.'
    ]);

    expect(firstResponse.status).toBe(200);
    expect(harness.db.find(requestId)?.status).toBe('approved');
    expectDecisionPageNotToLeak(responseText, {
      requestId,
      approvalTokens: [readActionToken(approveUrl)]
    });
    expect(harness.emailSender.requesterNotifications).toHaveLength(1);
  });

  it('returns a safe HTML page when a decision service error occurs', async () => {
    const { fetchWorker } = createWorkerHarness({ omitD1Binding: true });
    const requestId = '33333333-3333-4333-8333-333333333333';
    const token = await createApprovalToken({
      requestId,
      action: 'approve',
      secret: approvalTokenSecret
    });
    const response = await fetchWorker(`/api/cv-requests/${requestId}/approve?token=${token}`, {
      headers: {
        accept: browserAccept
      }
    });
    const responseText = await expectDecisionHtml(response, 503, [
      'Service Temporarily Unavailable',
      'Service error',
      'You may close this page.'
    ]);

    expectDecisionPageNotToLeak(responseText, {
      requestId,
      approvalTokens: [token]
    });
  });

  it('returns 503 when persistence fails', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness({ failWrites: true });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 503, {
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.'
    });
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns 503 without persistence debug when the D1 binding is missing', async () => {
    const { db, emailSender, postCvRequest } = createWorkerHarness({ omitD1Binding: true });
    const response = await postCvRequest(validPayload);

    await expectJson(response, 503, {
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.'
    });
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns missing_d1_binding only when CV_REQUEST_DEBUG is true', async () => {
    const submittedTurnstileToken = 'missing-d1-binding-submitted-token';
    const { db, emailSender, postCvRequest } = createWorkerHarness({
      omitD1Binding: true,
      cvRequestDebug: true
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(responseText)).toEqual({
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.',
      persistenceFailureKind: 'missing_d1_binding'
    });
    expectFailedPersistenceResponseNotToLeak(responseText, submittedTurnstileToken);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
  });

  it('returns d1_insert_failed only when CV_REQUEST_DEBUG is true', async () => {
    const submittedTurnstileToken = 'd1-insert-failed-submitted-token';
    const { db, emailSender, postCvRequest } = createWorkerHarness({
      failWrites: true,
      cvRequestDebug: true
    });
    const response = await postCvRequest({
      ...validPayload,
      turnstileToken: submittedTurnstileToken
    });
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(responseText)).toEqual({
      status: 'service_unavailable',
      message: 'The CV request service is temporarily unavailable. Try again later.',
      persistenceFailureKind: 'd1_insert_failed'
    });
    expectFailedPersistenceResponseNotToLeak(responseText, submittedTurnstileToken);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
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
    const { db, emailSender, postCvRequest } = createWorkerHarness();
    const response = await postCvRequest({});

    expect(response.status).toBe(400);
    expect(db.inserts).toHaveLength(0);
    expect(emailSender.notifications).toHaveLength(0);
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
  failEmail?: boolean;
  failRequesterEmail?: boolean;
  failTurnstile?: boolean;
  throwTurnstile?: boolean;
  omitD1Binding?: boolean;
  omitTurnstileSecret?: boolean;
  cvRequestDebug?: boolean;
  cvRequestEmailDebug?: boolean;
  turnstileDebug?: boolean;
  turnstileErrorCodes?: string[];
}

interface SentOwnerNotification {
  env: EmailEnv;
  notification: OwnerNotificationEmail;
}

interface SentRequesterNotification {
  env: EmailEnv;
  notification: RequesterDecisionEmail;
}

class FakeEmailSender implements EmailSender {
  readonly notifications: SentOwnerNotification[] = [];
  readonly requesterNotifications: SentRequesterNotification[] = [];

  constructor(private readonly options: HarnessOptions = {}) {}

  async sendOwnerNotification(
    env: EmailEnv,
    notification: OwnerNotificationEmail
  ): Promise<EmailSendResult> {
    this.notifications.push({ env, notification });

    if (this.options.failEmail) {
      return { ok: false, failureKind: 'resend_fetch_exception' };
    }

    return { ok: true };
  }

  async sendRequesterDecisionNotification(
    env: EmailEnv,
    notification: RequesterDecisionEmail
  ): Promise<EmailSendResult> {
    this.requesterNotifications.push({ env, notification });

    if (this.options.failRequesterEmail) {
      return { ok: false, failureKind: 'resend_fetch_exception' };
    }

    return { ok: true };
  }
}

interface TurnstileVerificationCall {
  input: TurnstileVerificationInput;
  env: Env;
}

class FakeTurnstileVerifier implements TurnstileVerifier<Env> {
  readonly verifications: TurnstileVerificationCall[] = [];

  constructor(private readonly options: HarnessOptions = {}) {}

  async verify(input: TurnstileVerificationInput, env: Env) {
    this.verifications.push({ input, env });

    if (this.options.throwTurnstile) {
      throw new Error(
        `Raw Turnstile exception details: token=${input.token}; secret=${turnstileSecret}`
      );
    }

    return this.options.failTurnstile
      ? {
          ok: false as const,
          failureKind: 'siteverify_failed' as const,
          errorCodes: this.options.turnstileErrorCodes ?? [],
          httpStatus: 200
        }
      : { ok: true as const };
  }
}

class FakeD1Database {
  readonly databaseId = d1DatabaseId;
  readonly inserts: InsertedCvRequest[] = [];

  constructor(private readonly options: HarnessOptions = {}) {}

  prepare(query: string) {
    const normalizedQuery = query.replace(/\s+/gu, ' ').trim().toLowerCase();

    return {
      bind: (...values: unknown[]) => ({
        run: async () => this.run(normalizedQuery, values),
        first: async <T>() => this.first<T>(normalizedQuery, values)
      })
    };
  }

  find(requestId: string): InsertedCvRequest | undefined {
    return this.inserts.find((insertedRequest) => insertedRequest.id === requestId);
  }

  private async run(query: string, values: unknown[]) {
    if (this.options.failWrites) {
      throw new Error(
        `D1 write failed for requester=${String(values[2])}; database=${d1DatabaseId}`
      );
    }

    if (query.startsWith('insert into cv_requests')) {
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

      return fakeD1Result(1);
    }

    if (query.startsWith('update cv_requests')) {
      const [status, updatedAt, id] = values;
      const request = this.find(String(id));

      if (!request || request.status !== 'pending') {
        return fakeD1Result(0);
      }

      request.status = String(status);
      request.updatedAt = String(updatedAt);

      return fakeD1Result(1);
    }

    return fakeD1Result(0);
  }

  private async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (
      query.startsWith(
        'select id, status, fullname, requesteremail, requestedcvtype, requestedlanguage from cv_requests'
      )
    ) {
      const request = this.find(String(values[0]));

      if (!request) {
        return null;
      }

      return {
        id: request.id,
        status: request.status,
        fullName: request.fullName,
        requesterEmail: request.requesterEmail,
        requestedCvType: request.requestedCvType,
        requestedLanguage: request.requestedLanguage
      } as T;
    }

    return null;
  }
}

function createWorkerHarness(options: HarnessOptions = {}): {
  db: FakeD1Database;
  emailSender: FakeEmailSender;
  turnstileVerifier: FakeTurnstileVerifier;
  fetchWorker: (path: string, init?: RequestInit) => Promise<Response>;
  postCvRequest: (payload: unknown, init?: RequestInit) => Promise<Response>;
} {
  const db = new FakeD1Database(options);
  const emailSender = new FakeEmailSender(options);
  const turnstileVerifier = new FakeTurnstileVerifier(options);
  const testWorker = createWorker({ emailSender, turnstileVerifier });
  const env = {
    ...(options.omitD1Binding ? {} : { CV_REQUESTS_DB: db as unknown as D1Database }),
    ALLOWED_ORIGINS: `${allowedOrigin}, https://secondary.example.test`,
    RESEND_API_KEY: 'test-resend-api-key',
    OWNER_NOTIFICATION_EMAIL: 'owner@example.com',
    OWNER_NOTIFICATION_FROM_EMAIL: 'cv-requests@example.com',
    APPROVAL_TOKEN_SECRET: approvalTokenSecret,
    PUBLIC_SITE_URL: 'https://www.example.com',
    TURNSTILE_SECRET_KEY: options.omitTurnstileSecret ? undefined : turnstileSecret,
    TURNSTILE_DEBUG: options.turnstileDebug ? 'true' : undefined,
    CV_REQUEST_DEBUG: options.cvRequestDebug ? 'true' : undefined,
    CV_REQUEST_EMAIL_DEBUG: options.cvRequestEmailDebug ? 'true' : undefined
  } as Env;

  const fetchWorker = (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${workerOrigin}${path}`;
    return testWorker.fetch(new Request(url, init), env, executionContext);
  };

  const postCvRequest = (payload: unknown, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('content-type', headers.get('content-type') ?? 'application/json');

    return fetchWorker('/api/cv-requests', {
      ...init,
      method: 'POST',
      headers,
      body: init.body ?? JSON.stringify(withTurnstileToken(payload))
    });
  };

  return { db, emailSender, turnstileVerifier, fetchWorker, postCvRequest };
}

function createSiteverifyWorkerHarness(
  fetcher: typeof fetch,
  options: HarnessOptions = {}
): {
  db: FakeD1Database;
  emailSender: FakeEmailSender;
  fetchWorker: (path: string, init?: RequestInit) => Promise<Response>;
  postCvRequest: (payload: unknown, init?: RequestInit) => Promise<Response>;
} {
  const db = new FakeD1Database(options);
  const emailSender = new FakeEmailSender(options);
  const testWorker = createWorker({
    emailSender,
    turnstileVerifier: new CloudflareTurnstileVerifier(fetcher)
  });
  const env: Env = {
    CV_REQUESTS_DB: db as unknown as D1Database,
    ALLOWED_ORIGINS: `${allowedOrigin}, https://secondary.example.test`,
    RESEND_API_KEY: 'test-resend-api-key',
    OWNER_NOTIFICATION_EMAIL: 'owner@example.com',
    OWNER_NOTIFICATION_FROM_EMAIL: 'cv-requests@example.com',
    APPROVAL_TOKEN_SECRET: approvalTokenSecret,
    PUBLIC_SITE_URL: 'https://www.example.com',
    TURNSTILE_SECRET_KEY: options.omitTurnstileSecret ? undefined : turnstileSecret,
    TURNSTILE_DEBUG: (options.turnstileDebug ?? true) ? 'true' : undefined
  };

  const fetchWorker = (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${workerOrigin}${path}`;
    return testWorker.fetch(new Request(url, init), env, executionContext);
  };

  const postCvRequest = (payload: unknown, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('content-type', headers.get('content-type') ?? 'application/json');

    return fetchWorker('/api/cv-requests', {
      ...init,
      method: 'POST',
      headers,
      body: init.body ?? JSON.stringify(withTurnstileToken(payload))
    });
  };

  return { db, emailSender, fetchWorker, postCvRequest };
}

function createResendWorkerHarness(
  fetcher: typeof fetch,
  options: HarnessOptions = {}
): {
  db: FakeD1Database;
  turnstileVerifier: FakeTurnstileVerifier;
  fetchWorker: (path: string, init?: RequestInit) => Promise<Response>;
  postCvRequest: (payload: unknown, init?: RequestInit) => Promise<Response>;
} {
  const db = new FakeD1Database(options);
  const turnstileVerifier = new FakeTurnstileVerifier(options);
  const testWorker = createWorker({
    emailSender: new ResendEmailSender(fetcher),
    turnstileVerifier
  });
  const env = {
    ...(options.omitD1Binding ? {} : { CV_REQUESTS_DB: db as unknown as D1Database }),
    ALLOWED_ORIGINS: `${allowedOrigin}, https://secondary.example.test`,
    RESEND_API_KEY: 'test-resend-api-key',
    OWNER_NOTIFICATION_EMAIL: 'owner@example.com',
    OWNER_NOTIFICATION_FROM_EMAIL: 'cv-requests@example.com',
    APPROVAL_TOKEN_SECRET: approvalTokenSecret,
    PUBLIC_SITE_URL: 'https://www.example.com',
    TURNSTILE_SECRET_KEY: options.omitTurnstileSecret ? undefined : turnstileSecret,
    TURNSTILE_DEBUG: options.turnstileDebug ? 'true' : undefined,
    CV_REQUEST_DEBUG: options.cvRequestDebug ? 'true' : undefined,
    CV_REQUEST_EMAIL_DEBUG: options.cvRequestEmailDebug ? 'true' : undefined
  } as Env;

  const fetchWorker = (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${workerOrigin}${path}`;
    return testWorker.fetch(new Request(url, init), env, executionContext);
  };

  const postCvRequest = (payload: unknown, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('content-type', headers.get('content-type') ?? 'application/json');

    return fetchWorker('/api/cv-requests', {
      ...init,
      method: 'POST',
      headers,
      body: init.body ?? JSON.stringify(withTurnstileToken(payload))
    });
  };

  return { db, turnstileVerifier, fetchWorker, postCvRequest };
}

function withTurnstileToken(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return payload;
  }

  if ('turnstileToken' in payload) {
    return payload;
  }

  return {
    ...payload,
    turnstileToken: validTurnstileToken
  };
}

function fakeD1Result(changes: number): D1Result {
  return {
    success: true,
    meta: {
      changes
    },
    results: []
  } as unknown as D1Result;
}

async function createPendingRequest({
  emailSender,
  postCvRequest
}: {
  emailSender: FakeEmailSender;
  postCvRequest: (payload: unknown, init?: RequestInit) => Promise<Response>;
}): Promise<{
  requestId: string;
  approveUrl: string;
  rejectUrl: string;
}> {
  const response = await postCvRequest(validPayload);
  const body = (await response.json()) as { requestId: string };
  const notification = emailSender.notifications[0].notification;

  return {
    requestId: body.requestId,
    approveUrl: notification.actionLinks.approve,
    rejectUrl: notification.actionLinks.reject
  };
}

function expectOwnerActionLink(link: string, requestId: string, action: ApprovalAction): void {
  const url = new URL(link);

  expect(url.origin).toBe(workerOrigin);
  expect(url.pathname).toBe(`/api/cv-requests/${requestId}/${action}`);
  expect(url.searchParams.get('token')).toEqual(expect.any(String));
  expect(url.searchParams.get('token')).not.toHaveLength(0);
}

function expectRequesterDecisionNotification(
  emailSender: FakeEmailSender,
  requestId: string,
  decision: 'approved' | 'rejected'
): void {
  expect(emailSender.requesterNotifications).toHaveLength(1);
  expect(emailSender.requesterNotifications[0].env).toEqual(
    expect.objectContaining({
      RESEND_API_KEY: 'test-resend-api-key',
      OWNER_NOTIFICATION_FROM_EMAIL: 'cv-requests@example.com',
      PUBLIC_SITE_URL: 'https://www.example.com'
    })
  );
  expect(emailSender.requesterNotifications[0].notification).toEqual({
    requestId,
    requesterName: validPayload.fullName,
    requesterEmail: validPayload.requesterEmail,
    requestedCvType: validPayload.requestedCvType,
    requestedLanguage: validPayload.requestedLanguage,
    decision
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

async function expectDecisionHtml(
  response: Response,
  status: number,
  expectedText: string[]
): Promise<string> {
  const responseText = await response.text();

  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('vary')).toContain('Accept');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('content-security-policy')).toContain("script-src 'none'");
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  expect(responseText).toContain('<!doctype html>');
  expect(responseText).toContain('<style>');
  expect(responseText).not.toContain('<script');
  expect(responseText).not.toContain('http://');
  expect(responseText).not.toContain('https://');

  for (const text of expectedText) {
    expect(responseText).toContain(text);
  }

  return responseText;
}

function readActionToken(actionUrl: string): string {
  const token = new URL(actionUrl).searchParams.get('token');

  expect(token).toEqual(expect.any(String));

  return token ?? '';
}

function expectDecisionPageNotToLeak(
  responseText: string,
  {
    requestId,
    approvalTokens = []
  }: {
    requestId?: string;
    approvalTokens?: string[];
  }
): void {
  expectSensitiveCvRequestDataNotToLeak(responseText, validTurnstileToken);
  expect(responseText).not.toContain('fullName');
  expect(responseText).not.toContain('requesterEmail');
  expect(responseText).not.toContain('company');
  expect(responseText).not.toContain('profileUrl');
  expect(responseText).not.toContain('requestedCvType');
  expect(responseText).not.toContain(validPayload.requestedCvType);
  expect(responseText).not.toContain('requestedLanguage');
  expect(responseText).not.toContain('reason');
  expect(responseText).not.toContain(approvalTokenSecret);
  expect(responseText).not.toContain('APPROVAL_TOKEN_SECRET');
  expect(responseText).not.toContain('token=');
  expect(responseText).not.toContain('?token');

  if (requestId !== undefined) {
    expect(responseText).not.toContain(requestId);
  }

  for (const token of approvalTokens) {
    expect(token).not.toHaveLength(0);
    expect(responseText).not.toContain(token);
  }
}

interface ExpectedOwnerNotificationFailureDebugFields {
  ownerNotificationFailureKind: string;
  resendHttpStatus?: number;
  resendErrorName?: string;
}

async function expectResendOwnerNotificationFailureDebug({
  fetcher,
  expectedDebugFields,
  rawPrivateValues = []
}: {
  fetcher: typeof fetch;
  expectedDebugFields: ExpectedOwnerNotificationFailureDebugFields;
  rawPrivateValues?: string[];
}): Promise<void> {
  const submittedTurnstileToken = 'resend-owner-debug-submitted-turnstile-token';
  const resendRequestBodies: BodyInit[] = [];
  const capturingFetcher: typeof fetch = async (input, init) => {
    if (init?.body !== undefined && init.body !== null) {
      resendRequestBodies.push(init.body);
    }

    return fetcher(input, init);
  };

  const { postCvRequest } = createResendWorkerHarness(capturingFetcher, {
    cvRequestEmailDebug: true
  });
  const response = await postCvRequest({
    ...validPayload,
    turnstileToken: submittedTurnstileToken
  });
  const responseText = await response.text();
  const approvalTokens = readApprovalTokensFromOwnerEmailText(
    parseResendEmailRequestBody(resendRequestBodies[0]).text
  );

  expect(response.status).toBe(202);
  expect(JSON.parse(responseText)).toEqual({
    requestId: expect.any(String),
    status: 'pending',
    message: 'Your CV request was received and is pending review.',
    ownerNotificationStatus: 'failed',
    ...expectedDebugFields
  });
  expectOwnerNotificationDebugResponseNotToLeak(
    responseText,
    submittedTurnstileToken,
    approvalTokens,
    rawPrivateValues
  );

  const { postCvRequest: postCvRequestWithoutDebug } = createResendWorkerHarness(fetcher);
  const responseWithoutDebug = await postCvRequestWithoutDebug({
    ...validPayload,
    turnstileToken: submittedTurnstileToken
  });
  const bodyWithoutDebug = await responseWithoutDebug.json();

  expect(responseWithoutDebug.status).toBe(202);
  expect(bodyWithoutDebug).toEqual({
    requestId: expect.any(String),
    status: 'pending',
    message: 'Your CV request was received and is pending review.'
  });
}

function createResendJsonResponseFetcher(
  httpStatus: number,
  body: Record<string, unknown>
): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status: httpStatus,
      headers: {
        'content-type': 'application/json'
      }
    });
}

function parseResendEmailRequestBody(body: BodyInit | null | undefined): {
  text: string;
} {
  expect(typeof body).toBe('string');

  const parsedBody = JSON.parse(body as string) as unknown;

  if (
    !isTestRecord(parsedBody) ||
    typeof parsedBody.text !== 'string' ||
    typeof parsedBody.from !== 'string' ||
    typeof parsedBody.to !== 'string'
  ) {
    throw new Error('Expected a JSON Resend email request body.');
  }

  return {
    text: parsedBody.text
  };
}

function readApprovalTokensFromOwnerEmailText(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('Approve: ') || line.startsWith('Reject: '))
    .map((line) => new URL(line.slice(line.indexOf(':') + 1).trim()).searchParams.get('token'))
    .filter((token): token is string => token !== null);
}

function parseSiteverifyRequestBody(body: BodyInit | null | undefined): {
  secret: string;
  response: string;
  remoteip?: string;
} {
  expect(typeof body).toBe('string');

  const parsedBody = JSON.parse(body as string) as unknown;

  if (!isSiteverifyRequestBody(parsedBody)) {
    throw new Error('Expected a JSON Siteverify request body.');
  }

  return parsedBody;
}

function isSiteverifyRequestBody(value: unknown): value is {
  secret: string;
  response: string;
  remoteip?: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { secret?: unknown }).secret === 'string' &&
    typeof (value as { response?: unknown }).response === 'string' &&
    ((value as { remoteip?: unknown }).remoteip === undefined ||
      typeof (value as { remoteip?: unknown }).remoteip === 'string')
  );
}

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectFailedTurnstileResponseNotToLeak(
  responseText: string,
  submittedTurnstileToken: string
): void {
  expectSensitiveCvRequestDataNotToLeak(responseText, submittedTurnstileToken);
}

function expectFailedPersistenceResponseNotToLeak(
  responseText: string,
  submittedTurnstileToken: string
): void {
  expectSensitiveCvRequestDataNotToLeak(responseText, submittedTurnstileToken);
  expect(responseText).not.toContain('D1 write failed');
  expect(responseText).not.toContain('CV_REQUESTS_DB');
}

function expectOwnerNotificationDebugResponseNotToLeak(
  responseText: string,
  submittedTurnstileToken: string,
  approvalTokens: string[],
  rawPrivateValues: string[] = []
): void {
  expectSensitiveCvRequestDataNotToLeak(responseText, submittedTurnstileToken);
  expect(responseText).not.toContain('fullName');
  expect(responseText).not.toContain('company');
  expect(responseText).not.toContain('profileUrl');
  expect(responseText).not.toContain(validPayload.requestedCvType);
  expect(responseText).not.toContain('requestedCvType');
  expect(responseText).not.toContain('requestedLanguage');
  expect(responseText).not.toContain('reason');
  expect(responseText).not.toContain('owner@example.com');
  expect(responseText).not.toContain('OWNER_NOTIFICATION_EMAIL');
  expect(responseText).not.toContain('cv-requests@example.com');
  expect(responseText).not.toContain('OWNER_NOTIFICATION_FROM_EMAIL');
  expect(responseText).not.toContain(approvalTokenSecret);
  expect(responseText).not.toContain('APPROVAL_TOKEN_SECRET');
  expect(responseText).not.toContain('Email send failed');
  expect(responseText).not.toContain('Raw Resend');

  for (const rawPrivateValue of rawPrivateValues) {
    expect(responseText).not.toContain(rawPrivateValue);
  }

  for (const token of approvalTokens) {
    expect(token).not.toHaveLength(0);
    expect(responseText).not.toContain(token);
  }
}

function expectSensitiveCvRequestDataNotToLeak(
  responseText: string,
  submittedTurnstileToken: string
): void {
  expect(responseText).not.toContain(submittedTurnstileToken);
  expect(responseText).not.toContain('turnstileToken');
  expect(responseText).not.toContain(turnstileSecret);
  expect(responseText).not.toContain('TURNSTILE_SECRET_KEY');
  expect(responseText).not.toContain(validPayload.requesterEmail);
  expect(responseText).not.toContain('requesterEmail');
  expect(responseText).not.toContain('test-resend-api-key');
  expect(responseText).not.toContain('RESEND_API_KEY');
  expect(responseText).not.toContain(validPayload.fullName);
  expect(responseText).not.toContain(validPayload.company);
  expect(responseText).not.toContain(validPayload.profileUrl);
  expect(responseText).not.toContain(validPayload.reason);
  expect(responseText).not.toContain(d1DatabaseId);
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
