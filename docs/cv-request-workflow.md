# CV request workflow contract

## Status

Future contract only. No backend, serverless function, email delivery, storage, or
form submission is implemented by this document.

The current public website form must remain front-only until a backend is added
in a later task.

## Goal

The public website should let a professional visitor request a private CV
without publishing private CV files, private contact details, or delivery
credentials in this public repository.

## Future flow

```txt
Visitor fills the CV request form
-> frontend sends a JSON request to a future API
-> API validates the request
-> Constantin receives an approval email
-> Constantin approves or rejects the request
-> approved requester receives a temporary link or an attachment
```

If Constantin rejects the request, the requester may receive a neutral rejection
message. The response must not disclose private contact data, private file
locations, or internal approval details.

## Future endpoint

The expected public contract is:

```txt
POST /api/cv-requests
Content-Type: application/json
```

The endpoint path is reserved for a future backend or serverless function. It
must not be called by the current front-only form.

## Request payload

```ts
interface CvRequestPayload {
  fullName: string;
  requesterEmail: string;
  company: string;
  profileUrl?: string;
  requestedCvType: 'one-page' | 'full-dev';
  requestedLanguage: 'fr' | 'en' | 'de';
  reason: string;
}
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `fullName` | Requester's full name. |
| `requesterEmail` | Requester's professional contact email. |
| `company` | Company, organization, or professional context. |
| `profileUrl` | Optional LinkedIn profile, company profile, or professional website URL. |
| `requestedCvType` | Private CV variant requested. |
| `requestedLanguage` | Requested CV language. |
| `reason` | Short professional reason for the request. |

## Validation rules

The future API must validate after trimming surrounding whitespace from string
fields.

Required fields:

| Field | Required | Maximum length |
| --- | --- | ---: |
| `fullName` | Yes | 120 characters |
| `requesterEmail` | Yes | 254 characters |
| `company` | Yes | 160 characters |
| `profileUrl` | No | 2048 characters |
| `requestedCvType` | Yes | enum value |
| `requestedLanguage` | Yes | enum value |
| `reason` | Yes | 2000 characters |

Format and enum rules:

- `requesterEmail` must be a syntactically valid email address with no display
  name wrapper.
- When provided, `profileUrl` must be an absolute `https://` URL.
- `requestedCvType` must be one of:
  - `one-page`
  - `full-dev`
- `requestedLanguage` must be one of:
  - `fr`
  - `en`
  - `de`
- Unknown fields should be ignored or rejected consistently by the future API.
  Prefer rejecting them if the backend stores the original payload.
- Normalization must not silently replace the requester-provided identity,
  company, URL, or reason with generated content.

## Security and privacy rules

Repository and source rules:

- No private CV files in the public repository.
- No private contact data in tracked files.
- No secrets, API keys, provider tokens, or serverless credentials in source.
- No raw private email address in frontend code or generated public artifacts.
- The future approval recipient address must come from backend environment
  configuration, not from frontend code.

Request handling rules:

- Treat submitted request payloads as personal data.
- Do not expose submitted request payloads in public artifacts or client logs.
- Do not include private CV attachments or private file paths in public JSON.
- Rate limiting is required before production enablement.
- Spam protection is required before production enablement.
- Approval and rejection actions must use signed, expiring tokens.
- Approval tokens should be single-use and scoped to one request and one action.
- Temporary download links, if used, must be signed, expiring, and scoped to the
  approved requester and CV variant.
- Attachments, if used, must be sent only after approval and must not be stored
  in this public repository.
- Backend logs should avoid full payload dumps and should redact requester email
  addresses where practical.

## Approval email

The future API sends an approval email to Constantin using a private destination
configured outside source control.

The approval email should include:

- request summary;
- requested CV type and language;
- requester name, company, profile URL if provided, and reason;
- approve link with a signed expiring token;
- reject link with a signed expiring token.

The approval email must not require any private token or secret to be present in
frontend code.

## Delivery

After approval, the backend may use either delivery mode:

- temporary link: a signed expiring link to the approved CV variant;
- attachment: an email attachment generated or loaded from private backend
  storage.

Both modes must keep private CV files out of the public repository and out of
the static public build.

## Expected API responses

### Success

Use `202 Accepted` when the request is syntactically valid and queued for
approval.

```json
{
  "status": "accepted",
  "requestId": "request_id",
  "message": "Request received and pending approval."
}
```

The response must not reveal whether approval will be granted.

### Validation error

Use `400 Bad Request` when fields are missing, too long, malformed, or outside
the allowed enum values.

```json
{
  "status": "validation_error",
  "errors": [
    {
      "field": "requesterEmail",
      "code": "invalid_email",
      "message": "Enter a valid email address."
    }
  ]
}
```

Supported validation error codes:

- `required`
- `too_long`
- `invalid_email`
- `invalid_url`
- `unsupported_cv_type`
- `unsupported_language`

### Rate limited

Use `429 Too Many Requests` when rate limiting blocks the request.

```json
{
  "status": "rate_limited",
  "retryAfterSeconds": 900,
  "message": "Too many requests. Try again later."
}
```

### Server error

Use `500 Internal Server Error` for unexpected backend failures.

```json
{
  "status": "server_error",
  "message": "The request could not be processed right now."
}
```

Server error responses must not include stack traces, provider details, private
file paths, private email addresses, or secrets.

## Current implementation boundary

The current public form stays front-only:

- it may collect values in browser form controls;
- it may use browser-native validation;
- it may show a "workflow not active" message;
- it must not send form data anywhere;
- it must not store submitted data;
- it must not expose private CV data.
