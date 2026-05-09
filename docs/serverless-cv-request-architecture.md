# Serverless CV request architecture

## Status

Future architecture only. This document does not implement backend code,
serverless functions, email delivery, database migrations, storage, or workflow
changes.

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
-> Worker sends approval email to Constantin through Resend
-> Constantin clicks approve or reject link
-> Worker validates signed expiring token
-> if approved, requester receives the CV or a temporary access link
-> if rejected, requester receives a polite refusal or no email depending on configuration
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

## Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | Resend API key used by the Worker for transactional emails. |
| `APPROVAL_TOKEN_SECRET` | Yes | Secret used to sign and verify expiring approve/reject tokens. |
| `OWNER_NOTIFICATION_EMAIL` | Yes | Destination for approval notification emails. Must not be in frontend code. |
| `PUBLIC_SITE_URL` | Yes | Public website origin used for user-facing links and email copy. |
| `REQUEST_RETENTION_DAYS` | Yes | Number of days to retain request personal data before deletion or anonymization. |
| `TURNSTILE_SECRET_KEY` | No | Optional Cloudflare Turnstile secret for later spam protection. |

## D1 data model

The exact migration can be designed during implementation, but D1 should keep
the model small.

### `cv_requests`

Stores the current request and approval state.

Suggested fields:

- `id`: opaque request id.
- `full_name`: trimmed requester name.
- `requester_email`: trimmed requester email.
- `company`: trimmed company or professional context.
- `profile_url`: optional validated professional URL.
- `requested_cv_type`: allowed CV type.
- `requested_language`: allowed language.
- `reason`: trimmed request reason.
- `status`: `pending`, `approved`, `rejected`, `delivered`, or `expired`.
- `created_at`: request creation timestamp.
- `updated_at`: last state change timestamp.
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

- Parse JSON.
- Trim string fields.
- Validate required fields, maximum lengths, enum values, email format, and the
  optional URL format when provided.
- Apply rate limiting and basic spam prevention.
- Optionally verify Turnstile when configured.
- Insert a `pending` request into D1.
- Send an approval notification email through Resend.
- Return `202 Accepted` without revealing approval outcome.

### `GET /api/cv-requests/:id/approve?token=...`

Approves a pending request.

Responsibilities:

- Validate the request id.
- Verify the signed token.
- Enforce token expiry, action scope, and request scope.
- Enforce single use by checking current D1 state.
- Mark the request `approved`.
- Send the requested CV or a temporary access link to the requester.
- Record an audit event if audit logging is enabled.

### `GET /api/cv-requests/:id/reject?token=...`

Rejects a pending request.

Responsibilities:

- Validate the request id.
- Verify the signed token.
- Enforce token expiry, action scope, and request scope.
- Enforce single use by checking current D1 state.
- Mark the request `rejected`.
- Depending on configuration, send a polite refusal or send no requester email.
- Record an audit event if audit logging is enabled.

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
- Rate-limit by IP or another Cloudflare-supported signal.
- Optionally require Cloudflare Turnstile before production enablement.
- Avoid detailed error messages that help abuse automation.

## Security requirements

- Approval and rejection links must use signed expiring tokens.
- Tokens must be scoped to one request id and one action.
- Tokens must be single-use through D1 state checks.
- Token values must never be stored in logs or public artifacts.
- Rate limiting is required before production use.
- Cloudflare Turnstile can be added when spam risk justifies it.
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
