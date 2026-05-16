# Architecture

## Overview

The system is a public static CV/portfolio website plus a serverless private CV
request workflow. Public content is generated from `data/cv.yml`. Private
contact details are applied only from an ignored local overlay for print/PDF
generation and approved Worker delivery.

The architecture intentionally separates public static hosting from private
Worker-controlled delivery. The public site must never expose private contact
data, generated PDFs, private Worker asset paths, secrets, or download links.

## Major Areas

| Area | Path | Responsibility |
|---|---|---|
| Public website | `apps/cv-web` | Astro static portfolio, Vue integration, CV request form, print routes gated by print build mode. |
| CV generation | `tools/CvGenerator` | Validate YAML, generate public web JSON, apply private overlay, generate private print JSON. |
| Request Worker | `services/cv-request-worker` | CV request API, Turnstile verification, D1 persistence, Resend emails, approval/rejection, admin endpoint, private download endpoint. |
| Public data | `data/cv.yml` | Public-safe structured CV source of truth. |
| Private data | `data/private/cv.private.yml` | Ignored local overlay for private email, phone, and address/location. |
| Generated artifacts | `generated` | Ignored generated JSON, PDFs, and private Worker assets. |
| Admin scripts | `scripts/admin` | Local PowerShell helpers for safe inspection and asset preparation. |

## Data And Artifact Flow

Public web flow:

```txt
data/cv.yml
-> tools/CvGenerator validate/generate
-> generated/web/cv.<lang>.generated.json
-> apps/cv-web Astro build
-> apps/cv-web/dist
-> public static hosting
```

Private print/PDF flow:

```txt
data/cv.yml
+ data/private/cv.private.yml
-> tools/CvGenerator generate-print
-> generated private print JSON
-> apps/cv-web print-mode build
-> Playwright PDF generation
-> generated local PDFs
```

Private delivery asset flow:

```txt
generated local PDFs
-> scripts/admin/prepare-private-cv-assets.ps1
-> generated private Worker assets and manifest
-> Cloudflare Worker assets binding
-> GET /api/cv-requests/:id/download?token=<DELIVERY_TOKEN>
```

## Public Website Layer

`apps/cv-web` is the public-facing Astro site with Vue integration available.
It loads only public web JSON from `generated/web`. The normal public build must
not include private print pages or private contact details.

Print routes are under the Astro app, but `getStaticPaths` returns no print
routes unless `CV_WEB_BUILD_MODE=print` is set by the local PDF generator. This
keeps private print pages out of the normal public build.

The CV request form is rendered by the static site and posts to the configured
Worker origin only when both public frontend values are configured:

- `PUBLIC_CV_REQUEST_API_BASE_URL`
- `PUBLIC_TURNSTILE_SITE_KEY`

These are public-safe frontend values. The Turnstile secret is Worker-only.

## CV Generation Layer

`tools/CvGenerator` is a .NET solution with clear boundaries:

- Domain: CV models, visibility flags, validation result types.
- Application: validation and generation services.
- Infrastructure: YAML readers and JSON artifact writers.
- CLI: commands for `validate`, `generate`, and `generate-print`.

Rules:

- Domain and Application do not know about Astro, Playwright, Cloudflare, or
  deployment.
- Public web generation filters website-visible content and omits private
  contact fields.
- Print generation requires private contact fields after applying the overlay.
- Generated artifacts are outputs. Do not hand-edit them.

## Serverless Request Workflow

`services/cv-request-worker` exposes:

- `GET /health`
- `OPTIONS /api/cv-requests`
- `POST /api/cv-requests`
- `GET /api/cv-requests/:id/approve?token=<APPROVAL_TOKEN>`
- `GET /api/cv-requests/:id/reject?token=<APPROVAL_TOKEN>`
- `GET /api/cv-requests/:id/download?token=<DELIVERY_TOKEN>`
- `GET /api/admin/cv-requests/recent`

Request flow:

```txt
POST /api/cv-requests
-> CORS and content-type checks
-> Turnstile token required
-> server-side Turnstile verification
-> payload validation
-> D1 insert with pending status
-> audit event
-> Resend owner notification with signed approve/reject links
-> 202 safe response
```

Decision flow:

```txt
Owner link
-> approval token verification
-> D1 request lookup
-> pending-only status update
-> audit event
-> requester Resend notification
-> browser-friendly HTML or JSON decision response
```

Download flow:

```txt
Requester link
-> delivery token verification
-> delivery enabled/configured checks
-> D1 approved request lookup
-> manifest lookup for requested CV type/language
-> Worker assets fetch
-> PDF attachment with no-store cache headers
```

## Data Layer

`data/cv.yml` is the committed public source of truth.

`data/private/cv.private.yml` is ignored and must never be created by an agent
unless explicitly asked for local private generation. The committed example must
use placeholders only.

D1 stores request data and audit events:

- `cv_requests`: requester payload, requested CV type/language, status,
  timestamps.
- `cv_request_events`: safe operational event type, request id, timestamp, and
  allowlisted metadata JSON.

Audit metadata must not contain requester email, full name, company,
profile URL, reason/context, tokens, secrets, asset paths, raw provider
responses, raw exceptions, PDFs, or download links.

## External Integrations

| Integration | Direction | Purpose | Safety rules |
|---|---|---|---|
| Cloudflare D1 | Worker to D1 | Request persistence and audit events. | Real `database_id` values are deployment config, not committed docs. |
| Cloudflare Turnstile | Browser and Worker | Anti-spam widget and server-side token verification. | Site key is public; secret key is Worker-only. |
| Resend | Worker to Resend API | Owner and requester email notifications. | API key and private emails are secrets. |
| Cloudflare Worker assets | Worker to assets binding | Private PDF delivery after approval. | `run_worker_first`; assets are not directly public. |

## Why R2 Is Not Used

Private delivery currently uses generated Worker static assets because the asset
set is small, manually prepared, and reviewed before deployment. This avoids
extra infrastructure, extra cost, and another private storage lifecycle.

Reconsider R2 only if Worker assets become too large, too manual, or need
independent lifecycle management.

## Why PDFs Must Not Be Served From GitHub Pages

Private PDFs can include private email, phone number, and address/location.
GitHub Pages and normal static hosting make files public, crawlable, cacheable,
and easy to share. A private CV must be delivered only after approval through a
signed Worker-controlled flow, or manually outside this repository.

## Dependency Rules

- Public site depends on generated public JSON, not private overlay data.
- CvGenerator does not depend on the public website or Worker.
- Worker does not read private overlay files or local PDFs from the repo at
  runtime.
- Admin scripts call the protected Worker admin endpoint or prepare ignored
  local assets.
- Generated files are not source dependencies for hand editing.

## Architecture Decisions

See [DECISIONS.md](./DECISIONS.md).
