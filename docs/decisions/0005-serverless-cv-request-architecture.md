# 0005 - Serverless CV request architecture

## Status

Accepted for future implementation.

No backend, serverless functions, database migrations, email delivery, workflow
changes, or application code are implemented by this decision.

## Context

ADR 0003 decides that private CVs should be requested through an approval
workflow instead of direct public PDF downloads.

ADR 0004 defines the future backend contract for request payloads, validation,
responses, approval tokens, and delivery options.

The project still deploys the public website as a static GitHub Pages site. The
future backend must not add private CV files, private contact data, secrets, or
provider credentials to the public repository.

## Decision

Use a simple serverless architecture for the future CV request workflow:

- Cloudflare Workers for the public API.
- Cloudflare D1 for request records and approval state.
- Resend for transactional email.
- GitHub Pages remains the static public website host.

The target endpoints are:

- `POST /api/cv-requests`
- `GET /api/cv-requests/:id/approve?token=...`
- `GET /api/cv-requests/:id/reject?token=...`

The Worker will validate and store requests, send approval email to Constantin,
validate signed expiring approve/reject tokens, and deliver an approved CV by
temporary access link or email attachment.

Required backend configuration must come from provider environment variables:

- `RESEND_API_KEY`
- `APPROVAL_TOKEN_SECRET`
- `OWNER_NOTIFICATION_EMAIL`
- `PUBLIC_SITE_URL`
- `REQUEST_RETENTION_DAYS`
- optional `TURNSTILE_SECRET_KEY`

Detailed architecture, validation, D1 table notes, endpoint responsibilities,
security requirements, and alternatives are documented in:

```txt
docs/serverless-cv-request-architecture.md
```

## Consequences

The public site can stay static on GitHub Pages.

The backend can be implemented later without putting private contact data,
private PDFs, API keys, or approval secrets in the repository.

Cloudflare D1 becomes the source of truth for request state and retention.

Resend becomes the transactional email provider for approval and requester
delivery messages.

Production enablement still requires implementation work, rate limiting,
secret configuration, email templates, D1 migrations, retention cleanup, and
privacy review.

## Alternatives considered

Azure Functions, Netlify Functions, Vercel Functions, GitHub Actions workflow
dispatch, and a dedicated .NET API were considered.

Cloudflare Workers with D1 is preferred because it keeps the workflow small,
fits a static GitHub Pages site, provides lightweight persistence, supports
edge-side rate limiting and optional Turnstile, and avoids hosting a dedicated
application service for a narrow approval workflow.
