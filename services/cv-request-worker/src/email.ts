import type { CvRequestPayload } from './types';

export interface EmailEnv {
  RESEND_API_KEY?: string;
  OWNER_NOTIFICATION_EMAIL?: string;
  OWNER_NOTIFICATION_FROM_EMAIL?: string;
  PUBLIC_SITE_URL?: string;
}

export interface OwnerActionLinks {
  approve: string;
  reject: string;
}

export interface OwnerNotificationEmail {
  requestId: string;
  payload: CvRequestPayload;
  actionLinks: OwnerActionLinks;
}

export type RequesterDecision = 'approved' | 'rejected';

export interface RequesterDecisionEmail {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  requestedCvType: CvRequestPayload['requestedCvType'];
  requestedLanguage: CvRequestPayload['requestedLanguage'];
  decision: RequesterDecision;
  downloadLink?: string;
}

export type EmailSendFailureKind =
  | 'resend_fetch_exception'
  | 'resend_http_error'
  | 'resend_invalid_json'
  | 'resend_unexpected_response';

export type EmailSendResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      failureKind: 'resend_fetch_exception';
    }
  | {
      ok: false;
      failureKind: 'resend_http_error';
      httpStatus?: number;
      errorName?: string;
    }
  | {
      ok: false;
      failureKind: 'resend_invalid_json';
      httpStatus?: number;
    }
  | {
      ok: false;
      failureKind: 'resend_unexpected_response';
      httpStatus?: number;
    };

export interface EmailSender {
  sendOwnerNotification(
    env: EmailEnv,
    notification: OwnerNotificationEmail
  ): Promise<EmailSendResult>;
  sendRequesterDecisionNotification(
    env: EmailEnv,
    notification: RequesterDecisionEmail
  ): Promise<EmailSendResult>;
}

export class ResendEmailSender implements EmailSender {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async sendOwnerNotification(
    env: EmailEnv,
    notification: OwnerNotificationEmail
  ): Promise<EmailSendResult> {
    const apiKey = readRequiredConfig(env.RESEND_API_KEY, 'RESEND_API_KEY');
    const to = readRequiredConfig(env.OWNER_NOTIFICATION_EMAIL, 'OWNER_NOTIFICATION_EMAIL');
    const from = readRequiredConfig(
      env.OWNER_NOTIFICATION_FROM_EMAIL,
      'OWNER_NOTIFICATION_FROM_EMAIL'
    );

    return sendResendEmail(this.fetcher, apiKey, {
      from,
      to,
      subject: `New CV request ${notification.requestId}`,
      text: buildOwnerNotificationText(notification, env.PUBLIC_SITE_URL)
    });
  }

  async sendRequesterDecisionNotification(
    env: EmailEnv,
    notification: RequesterDecisionEmail
  ): Promise<EmailSendResult> {
    const apiKey = readRequiredConfig(env.RESEND_API_KEY, 'RESEND_API_KEY');
    const from = readRequiredConfig(
      env.OWNER_NOTIFICATION_FROM_EMAIL,
      'OWNER_NOTIFICATION_FROM_EMAIL'
    );

    return sendResendEmail(this.fetcher, apiKey, {
      from,
      to: notification.requesterEmail,
      subject:
        notification.decision === 'approved'
          ? 'Your CV request was approved'
          : 'Your CV request update',
      text: buildRequesterDecisionText(notification)
    });
  }
}

interface ResendEmailRequest {
  from: string;
  to: string;
  subject: string;
  text: string;
}

async function sendResendEmail(
  fetcher: typeof fetch,
  apiKey: string,
  email: ResendEmailRequest
): Promise<EmailSendResult> {
  let response: Response;

  try {
    response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(email)
    });
  } catch {
    return { ok: false, failureKind: 'resend_fetch_exception' };
  }

  if (response.ok) {
    return { ok: true };
  }

  return readResendFailureResult(response);
}

async function readResendFailureResult(response: Response): Promise<EmailSendResult> {
  const httpStatus = response.status;
  let parsedBody: unknown;

  try {
    parsedBody = await response.json();
  } catch {
    return { ok: false, failureKind: 'resend_invalid_json', httpStatus };
  }

  if (!isRecord(parsedBody)) {
    return { ok: false, failureKind: 'resend_unexpected_response', httpStatus };
  }

  const errorName = readSafeResendErrorName(parsedBody);

  return {
    ok: false,
    failureKind: 'resend_http_error',
    httpStatus,
    ...(errorName ? { errorName } : {})
  };
}

function buildOwnerNotificationText(
  { requestId, payload, actionLinks }: OwnerNotificationEmail,
  publicSiteUrl?: string
): string {
  const publicSite = readOptionalConfig(publicSiteUrl);
  const publicSiteLine = publicSite ? [`Public site: ${publicSite}`, ''] : [];
  const profileUrl = payload.profileUrl ?? 'Not provided';

  return [
    'A valid CV request was received and stored for review.',
    '',
    ...publicSiteLine,
    `Request id: ${requestId}`,
    `Requester full name: ${payload.fullName}`,
    `Requester email: ${payload.requesterEmail}`,
    `Company: ${payload.company}`,
    `Profile URL: ${profileUrl}`,
    `Requested CV type: ${payload.requestedCvType}`,
    `Requested language: ${payload.requestedLanguage}`,
    '',
    'Review actions:',
    `Approve: ${actionLinks.approve}`,
    `Reject: ${actionLinks.reject}`,
    '',
    'Reason/context:',
    payload.reason
  ].join('\n');
}

function buildRequesterDecisionText(notification: RequesterDecisionEmail): string {
  if (notification.decision === 'approved') {
    if (notification.downloadLink) {
      return [
        `Hello ${notification.requesterName},`,
        '',
        `Your request for Constantin Petrov's ${notification.requestedCvType} CV in ${notification.requestedLanguage} has been approved.`,
        '',
        'Download link:',
        notification.downloadLink,
        '',
        'This link is temporary and should not be forwarded.',
        '',
        'Thank you.'
      ].join('\n');
    }

    return [
      `Hello ${notification.requesterName},`,
      '',
      `Your request for Constantin Petrov's ${notification.requestedCvType} CV in ${notification.requestedLanguage} has been approved.`,
      '',
      'This message confirms the approval decision only. CV delivery will happen in a later follow-up step.',
      'No CV file, attachment, or private download link is included in this email.',
      '',
      'Thank you.'
    ].join('\n');
  }

  return [
    `Hello ${notification.requesterName},`,
    '',
    "Thank you for your interest in Constantin Petrov's CV. After review, this request will not move forward.",
    '',
    'No CV file, attachment, or private download link is included in this email.',
    '',
    'Thank you for understanding.'
  ].join('\n');
}

function readRequiredConfig(value: string | undefined, name: string): string {
  const trimmedValue = readOptionalConfig(value);

  if (!trimmedValue) {
    throw new Error(`${name} is not configured.`);
  }

  return trimmedValue;
}

function readOptionalConfig(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function readSafeResendErrorName(body: Record<string, unknown>): string | undefined {
  for (const field of ['name', 'type', 'code']) {
    const value = body[field];
    const trimmedValue = typeof value === 'string' ? value.trim() : '';

    if (/^[A-Za-z0-9._:-]{1,120}$/u.test(trimmedValue)) {
      return trimmedValue;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
