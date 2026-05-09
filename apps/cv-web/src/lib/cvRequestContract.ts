export const cvRequestAllowedCvTypes = ['one-page', 'full-dev'] as const;

export type CvRequestCvType = (typeof cvRequestAllowedCvTypes)[number];

export const cvRequestAllowedLanguages = ['fr', 'en', 'de'] as const;

export type CvRequestLanguage = (typeof cvRequestAllowedLanguages)[number];

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
  requestedCvType: CvRequestCvType;
  requestedLanguage: CvRequestLanguage;
  reason: string;
}

export type CvRequestField = keyof CvRequestPayload;

export type CvRequestValidationErrorCode =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'invalid_url'
  | 'unsupported_cv_type'
  | 'unsupported_language';

export interface CvRequestValidationIssue {
  field: CvRequestField;
  code: CvRequestValidationErrorCode;
  message: string;
}

export interface CvRequestSuccessResponse {
  status: 'accepted';
  requestId: string;
  message: string;
}

export interface CvRequestValidationErrorResponse {
  status: 'validation_error';
  errors: CvRequestValidationIssue[];
}

export interface CvRequestRateLimitedResponse {
  status: 'rate_limited';
  retryAfterSeconds: number;
  message: string;
}

export interface CvRequestServerErrorResponse {
  status: 'server_error';
  message: string;
}

export type CvRequestApiResponse =
  | CvRequestSuccessResponse
  | CvRequestValidationErrorResponse
  | CvRequestRateLimitedResponse
  | CvRequestServerErrorResponse;
