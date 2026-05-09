export const requestedCvTypes = ['one-page', 'full-dev'] as const;

export type RequestedCvType = (typeof requestedCvTypes)[number];

export const requestedLanguages = ['fr', 'en', 'de'] as const;

export type RequestedLanguage = (typeof requestedLanguages)[number];

export const cvRequestMaxLengths = {
  fullName: 120,
  requesterEmail: 254,
  company: 160,
  profileUrl: 2048,
  reason: 2000
} as const;

export interface CvRequestPayload {
  fullName: string;
  requesterEmail: string;
  company: string;
  profileUrl?: string;
  requestedCvType: RequestedCvType;
  requestedLanguage: RequestedLanguage;
  reason: string;
}

export interface CvRequestSubmissionPayload extends CvRequestPayload {
  turnstileToken: string;
}

export type CvRequestField = keyof CvRequestSubmissionPayload | 'body';

export type CvRequestValidationErrorCode =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'invalid_url'
  | 'unsupported_cv_type'
  | 'unsupported_language'
  | 'invalid_json'
  | 'invalid_payload';

export interface CvRequestValidationError {
  field: CvRequestField;
  code: CvRequestValidationErrorCode;
  message: string;
}

export type CvRequestValidationResult =
  | {
      ok: true;
      payload: CvRequestPayload;
    }
  | {
      ok: false;
      errors: CvRequestValidationError[];
    };
