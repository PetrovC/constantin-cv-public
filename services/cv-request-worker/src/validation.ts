import {
  cvRequestMaxLengths,
  requestedCvTypes,
  requestedLanguages,
  type CvRequestField,
  type CvRequestPayload,
  type CvRequestValidationError,
  type CvRequestValidationErrorCode,
  type CvRequestValidationResult,
  type RequestedCvType,
  type RequestedLanguage
} from './types';

type CvRequestInput = Record<string, unknown>;
type StringField = keyof Pick<
  CvRequestPayload,
  'fullName' | 'requesterEmail' | 'company' | 'profileUrl' | 'reason'
>;

const emailPattern = /^[^\s@<>()\[\]",;:]+@[^\s@<>()\[\]",;:]+\.[^\s@<>()\[\]",;:]+$/;

export function validateCvRequestPayload(input: unknown): CvRequestValidationResult {
  if (!isObjectRecord(input)) {
    return {
      ok: false,
      errors: [
        validationError('body', 'invalid_payload', 'Send a JSON object with CV request fields.')
      ]
    };
  }

  const errors: CvRequestValidationError[] = [];

  const fullName = readRequiredString(input, 'fullName', errors);
  const requesterEmail = readRequiredString(input, 'requesterEmail', errors);
  const company = readRequiredString(input, 'company', errors);
  const profileUrl = readOptionalString(input, 'profileUrl', errors);
  const reason = readRequiredString(input, 'reason', errors);
  const requestedCvType = readRequestedCvType(input, errors);
  const requestedLanguage = readRequestedLanguage(input, errors);

  if (requesterEmail && !isEmailLike(requesterEmail)) {
    errors.push(
      validationError('requesterEmail', 'invalid_email', 'Enter a valid email address.')
    );
  }

  if (profileUrl && !isHttpsUrl(profileUrl)) {
    errors.push(validationError('profileUrl', 'invalid_url', 'Enter a valid HTTPS URL.'));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const payload: CvRequestPayload = {
    fullName,
    requesterEmail,
    company,
    requestedCvType,
    requestedLanguage,
    reason
  };

  if (profileUrl) {
    payload.profileUrl = profileUrl;
  }

  return { ok: true, payload };
}

function readRequiredString(
  input: CvRequestInput,
  field: StringField,
  errors: CvRequestValidationError[]
): string {
  const value = readTrimmedString(input[field]);

  if (!value) {
    errors.push(validationError(field, 'required', 'This field is required.'));
    return '';
  }

  enforceMaxLength(field, value, errors);
  return value;
}

function readOptionalString(
  input: CvRequestInput,
  field: StringField,
  errors: CvRequestValidationError[]
): string | undefined {
  const value = readTrimmedString(input[field]);

  if (!value) {
    return undefined;
  }

  enforceMaxLength(field, value, errors);
  return value;
}

function readRequestedCvType(
  input: CvRequestInput,
  errors: CvRequestValidationError[]
): RequestedCvType {
  const value = readTrimmedString(input.requestedCvType);

  if (!value) {
    errors.push(validationError('requestedCvType', 'required', 'This field is required.'));
    return requestedCvTypes[0];
  }

  if (!isRequestedCvType(value)) {
    errors.push(
      validationError(
        'requestedCvType',
        'unsupported_cv_type',
        'Choose a supported CV type.'
      )
    );
    return requestedCvTypes[0];
  }

  return value;
}

function readRequestedLanguage(
  input: CvRequestInput,
  errors: CvRequestValidationError[]
): RequestedLanguage {
  const value = readTrimmedString(input.requestedLanguage);

  if (!value) {
    errors.push(validationError('requestedLanguage', 'required', 'This field is required.'));
    return requestedLanguages[0];
  }

  if (!isRequestedLanguage(value)) {
    errors.push(
      validationError(
        'requestedLanguage',
        'unsupported_language',
        'Choose a supported language.'
      )
    );
    return requestedLanguages[0];
  }

  return value;
}

function enforceMaxLength(
  field: StringField,
  value: string,
  errors: CvRequestValidationError[]
): void {
  const maxLength = cvRequestMaxLengths[field];

  if (value.length > maxLength) {
    errors.push(validationError(field, 'too_long', `Use ${maxLength} characters or fewer.`));
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value: unknown): value is CvRequestInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestedCvType(value: string): value is RequestedCvType {
  return requestedCvTypes.includes(value as RequestedCvType);
}

function isRequestedLanguage(value: string): value is RequestedLanguage {
  return requestedLanguages.includes(value as RequestedLanguage);
}

function isEmailLike(value: string): boolean {
  return emailPattern.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validationError(
  field: CvRequestField,
  code: CvRequestValidationErrorCode,
  message: string
): CvRequestValidationError {
  return { field, code, message };
}
