# Serverless CV request architecture

## Status

Partially implemented. The repository now contains a Cloudflare Worker scaffold
for `POST /api/cv-requests` with validation, D1 persistence for pending
requests, owner notification email sending through Resend after persistence,
and signed approve/reject links that update request status in D1 and send a
decision notification email to the requester. The public request endpoint now
has CORS allow-list handling, JSON content-type enforcement, safe JSON request
errors, and basic security response headers.

Requester PDF delivery, temporary download links, notification retry/audit,
retention cleanup, active rate limiting, and active spam protection are still
future work. A rate-limiting abstraction exists in the Worker, but the default
implementation is intentionally inactive until a Cloudflare-native or equivalent
deployment mechanism is configured.

## Goal

Provide a small approval-based backend for private CV requests while keeping the
public website static and public-safe.

The preferred target architecture is:

- GitHub Pages for the static public website.
- Cloudflare Workers for the public CV request API.
- Cloudflare D1 for request records and approval state.
- Resend for transactional email.

## Target flow

```txt
visitor submits CV request form
-> Worker validates payload
-> Worker stores request in D1
-> Worker sends an owner notification email with signed approve/reject links
-> Worker returns a pending request id
-> Constantin approves or rejects with a signed link
-> Worker notifies the requester of the approval/rejection decision
-> future CV delivery flow runs after Constantin review
```

The public website remains a static GitHub Pages site. The form can later submit
to the Worker API, but private CV files and private contact data must not be
included in the static build.

## Public and private boundaries

Public repository and frontend:

- No secrets in source files.
- No private contact data in frontend code.
- No raw private email address in public generated JSON.
- No generated PDFs in the public build.
- No private CV or PDF artifacts in Git.
- No open public CV download URLs.

Private/backend configuration:

- API secrets live in provider environment variables.
- The owner notification address is configured in the Worker environment.
- Resend credentials are configured in the Worker environment.
- Approval token signing material is configured in the Worker environment.
- Private CV/PDF artifacts remain outside Git and outside the static public
  website build.

## Environment variables

The current Worker notification path requires Resend and owner notification
configuration in the Worker environment. Requester decision notifications reuse
the same Resend configuration and send only to the requester email stored in D1.
These values must be configured outside source control.

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | Resend API key used by the Worker for transactional emails. |
| `OWNER_NOTIFICATION_EMAIL` | Yes | Destination for approval notification emails. Must not be in frontend code. |
| `OWNER_NOTIFICATION_FROM_EMAIL` | Yes | Sender address configured for the Resend sending domain. |
| `ALLOWED_ORIGINS` | Yes before public form connection | Comma-separated list of exact public origins allowed to call `POST /api/cv-requests` from browsers. Empty or missing values reject requests that include an `Origin` header. |
| `PUBLIC_SITE_URL` | No | Optional public website origin used for email context. |
| `APPROVAL_TOKEN_SECRET` | Yes | Secret used to sign and verify expiring approve/reject tokens. |
| `REQUEST_RETENTION_DAYS` | Future | Number of days to retain request personal data before deletion or anonymization. |
| `TURNSTILE_SECRET_KEY` | Future optional | Optional Cloudflare Turnstile secret prepared in the Worker environment type for later spam protection. It is not required or verified yet. |

## D1 data model

The initial D1 migration lives at:

```txt
services/cv-request-worker/migrations/0001_create_cv_requests.sql
```

The current model is intentionally small.

### `cv_requests`

Stores the current request and approval state.

Suggested fields:

- `id`: opaque request id.
- `fullName`: trimmed requester name.
- `requesterEmail`: trimmed requester email.
- `company`: trimmed company or professional context.
- `profileUrl`: optional validated professional URL.
- `requestedCvType`: allowed CV type.
- `requestedLanguage`: allowed language.
- `reason`: trimmed request reason.
- `status`: `pending`, `approved`, `rejected`, `delivered`, or `expired`.
- `createdAt`: request creation timestamp.
- `updatedAt`: last state change timestamp.

Future workflow fields may be added when approval, delivery, retention cleanup,
or abuse prevention are implemented:

- `expires_at`: retention or request expiry timestamp.
- `approved_at`: approval timestamp, when applicable.
- `rejected_at`: rejection timestamp, when applicable.
- `delivered_at`: delivery timestamp, when applicable.
- `request_ip_hash`: optional hashed rate-limit or abuse signal.
- `user_agent_hash`: optional hashed abuse signal.

### `cv_request_events`

Optional audit log for state transitions and operational troubleshooting.

Suggested fields:

- `id`: event id.
- `request_id`: related request id.
- `event_type`: `created`, `notification_sent`, `approved`, `rejected`,
  `delivery_sent`, `delivery_failed`, `expired`, or `deleted`.
- `created_at`: event timestamp.
- `metadata_json`: minimal non-secret metadata, redacted where practical.

The audit log must not store secrets, token values, full email payload dumps, or
private CV file paths.

## API endpoints

### `POST /api/cv-requests`

Creates a pending request.

Responsibilities:

- Enforce CORS for browser requests by allowing only exact origins configured
  in `ALLOWED_ORIGINS`.
- Handle `OPTIONS` preflight for allowed origins.
- Reject requests with a disallowed `Origin` before reading or storing the
  payload.
- Require `Content-Type: application/json`.
- Parse JSON.
- Trim string fields.
- Validate required fields, maximum lengths, enum values, email format, and the
  optional URL format when provided.
- Call the rate-limiting abstraction. The current default implementation allows
  requests and is not active protection.
- Optionally verify Turnstile when configured in a later slice.
- Insert a `pending` request into D1.
- Generate signed approve/reject links after persistence succeeds.
- Send an owner notification email through Resend after link generation.
- If link generation or notification sending fails, keep the stored request and
  return the same generic `202 Accepted` response.
- Return a `202 Accepted` response with the request id and pending status.
- Return `202 Accepted` without revealing approval outcome.

Notification retry and audit logging will be handled in a later implementation
slice.

### `GET /api/cv-requests/:id/approve?token=...`

Approves a pending request.

Responsibilities:

- Validate the request id.
- Verify the signed token.
- Enforce token expiry, action scope, and request scope.
- Enforce single use by checking current D1 state.
- Mark the request `approved`.
- Send the requester an approval notification explaining that CV delivery will
  happen in a later follow-up step.
- If requester notification fails after the status update, keep the approved
  status and return a safe response explaining that the decision was recorded.
- Return `409 already_finalized` if the request is already approved, rejected,
  delivered, or expired.
- Do not send the requested CV, attach a PDF, or create a temporary access link
  yet.
- Requester notification retry and audit logging will be handled in a later
  slice.

### `GET /api/cv-requests/:id/reject?token=...`

Rejects a pending request.

Responsibilities:

- Validate the request id.
- Verify the signed token.
- Enforce token expiry, action scope, and request scope.
- Enforce single use by checking current D1 state.
- Mark the request `rejected`.
- Send the requester a polite rejection notification.
- If requester notification fails after the status update, keep the rejected
  status and return a safe response explaining that the decision was recorded.
- Return `409 already_finalized` if the request is already approved, rejected,
  delivered, or expired.
- Do not expose owner private contact data.
- Requester notification retry and audit logging will be handled in a later
  slice.

## Validation rules

The Worker must trim surrounding whitespace before validation.

Required fields and maximum lengths:

| Field | Required | Maximum length |
| --- | --- | ---: |
| `fullName` | Yes | 120 characters |
| `requesterEmail` | Yes | 254 characters |
| `company` | Yes | 160 characters |
| `profileUrl` | No | 2048 characters |
| `requestedCvType` | Yes | enum value |
| `requestedLanguage` | Yes | enum value |
| `reason` | Yes | 2000 characters |

Allowed CV types:

- `one-page`
- `full-dev`

Allowed languages:

- `fr`
- `en`
- `de`

Format rules:

- `requesterEmail` must be a syntactically valid email address with no display
  name wrapper.
- When provided, `profileUrl` must be an absolute `https://` URL.
- Unknown fields should be rejected if the original payload is stored or logged.
- Normalization must not silently replace requester-provided identity, company,
  URL, or reason with generated content.

Basic spam prevention:

- Reject empty or whitespace-only fields.
- Reject obvious HTML/script payloads in free-text fields.
- Rate-limit by IP or another Cloudflare-supported signal before production
  form connection. The current repository contains only the placeholder
  abstraction, not active enforcement.
- Require or verify Cloudflare Turnstile before production form connection if
  spam risk justifies it. `TURNSTILE_SECRET_KEY` is prepared as an optional
  environment binding, but verification is not active yet.
- Avoid detailed error messages that help abuse automation.

## Security requirements

- Approval and rejection links must use signed expiring tokens.
- Tokens must be scoped to one request id and one action.
- Tokens must be single-use through D1 state checks.
- Current approval tokens expire after seven days.
- Token values must never be stored in logs or public artifacts.
- Browser access to `POST /api/cv-requests` must be restricted to
  `ALLOWED_ORIGINS`.
- API responses should include safe headers such as `X-Content-Type-Options:
  nosniff` and `Referrer-Policy: no-referrer`.
- Active rate limiting is required before production form connection. The
  current Worker only has a replaceable inactive foundation.
- Cloudflare Turnstile verification must be activated before connecting the
  public form if it is selected as the spam protection layer.
- CV download URLs must not be open public URLs.
- Temporary access links, if used, must be signed, expiring, and scoped to the
  approved request.
- Private PDFs must not be committed to the public repo.
- Private PDFs must not be included in the static public build.
- Store the minimum personal data required to review and deliver a request.
- Apply `REQUEST_RETENTION_DAYS` by deleting or anonymizing old request data.
- Backend logs should avoid full payload dumps and redact requester email
  addresses where practical.
- Email templates must not include secrets, private file paths, or provider
  credentials.

## Delivery options

The implementation can choose one of two approved delivery modes.

Temporary link:

- Generate or retrieve the requested private CV outside the public build.
- Create a signed, expiring access link scoped to the request and CV variant.
- Send the link to the requester after approval.

Attachment:

- Generate or retrieve the requested private CV outside the public build.
- Send the PDF as a Resend attachment after approval.
- Do not persist the attachment in the public repository.

The temporary link option is usually easier to revoke and observe. The
attachment option avoids a second requester click but requires careful handling
of private files in the backend runtime.

## Alternatives considered

### Azure Functions

Azure Functions would work, especially with a .NET implementation, but it adds a
larger cloud surface for a small public site. It is not needed while the website
is otherwise static on GitHub Pages.

### Netlify Functions

Netlify Functions are convenient when the site is deployed on Netlify. This
project already targets GitHub Pages, so adding Netlify only for the API would
introduce another hosting path without a strong benefit.

### Vercel Functions

Vercel Functions are convenient for Vercel-hosted frontend projects. This
project does not need a Vercel migration, and the API requirements are small
enough for a Worker.

### GitHub Actions workflow dispatch

GitHub Actions should not be used as the public request backend. It is awkward
for request validation, approval links, transactional email, rate limiting, and
personal-data retention. It also risks mixing public repository automation with
private request handling.

### Dedicated .NET API

A dedicated .NET API would fit the existing generator language but would require
hosting, deployment, patching, monitoring, and secret management for a very small
workflow. It can be reconsidered only if the request workflow grows into a
larger authenticated backend.

## Decision

Use Cloudflare Workers, Cloudflare D1, and Resend for the future CV request
backend. Keep GitHub Pages as the static public website host.

This keeps the architecture small, avoids changing the public site deployment,
keeps secrets out of the repository, and provides enough persistence and email
delivery for an approval-based CV request flow.
