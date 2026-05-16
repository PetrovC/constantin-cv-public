# Technical Decisions

Record accepted decisions here so future agents do not re-open settled design
questions without a clear reason.

## [2026-05-16] - Public-Clean Repository Boundary

**Status**: Accepted

**Decision**: This repository is treated as a public-clean working copy. Private
source material, private contact data, generated private artifacts, provider
secrets, tokens, and real deployment identifiers must stay out of committed
files.

**Consequences**: Agents must assume tracked files are publishable. Use
placeholders such as `<PRIVATE_EMAIL>`, `<SECRET_VALUE>`, and
`<D1_DATABASE_ID>` in docs and examples.

## [2026-05-16] - Public CV Data Plus Private Overlay

**Status**: Accepted

**Decision**: `data/cv.yml` is the committed public-safe CV source. Private
contact details live only in ignored `data/private/cv.private.yml`, copied
locally from the placeholder example when needed.

**Consequences**: Public web generation must not require private data. Print/PDF
generation may require the private overlay but remains local and ignored.

## [2026-05-16] - Generated Artifacts Are Not Source

**Status**: Accepted

**Decision**: Generated web JSON, print JSON, PDFs, Worker private assets, and
build output are regenerated from source and must not be hand-edited.

**Consequences**: Fix source data, generator code, scripts, or templates instead
of patching generated files. Keep generated private assets ignored.

## [2026-05-16] - No Private PDFs In Git Or Public Static Hosting

**Status**: Accepted

**Decision**: Private PDFs must not be committed, uploaded to GitHub Pages, or
linked from the public static website.

**Consequences**: Private CV delivery must be manual or Worker-controlled after
approval. Public CI must not run private PDF generation.

## [2026-05-16] - Astro Public Site And .NET Generator

**Status**: Accepted

**Decision**: The public portfolio is an Astro site with Vue integration. The CV
generator remains a .NET tool with Domain, Application, Infrastructure, and CLI
projects.

**Consequences**: Keep public rendering in `apps/cv-web` and CV data shaping in
`tools/CvGenerator`. Do not duplicate CV content by hand in components.

## [2026-05-16] - Cloudflare Worker Request Workflow

**Status**: Accepted

**Decision**: CV requests are handled by a Cloudflare Worker instead of the
static site. The Worker owns request validation, Turnstile verification, D1
persistence, Resend email notifications, approval/rejection, admin access, and
private delivery routing.

**Consequences**: The static site only collects and submits the request. Secrets
and sensitive workflow state stay server-side.

## [2026-05-16] - D1 For Requests And Audit Events

**Status**: Accepted

**Decision**: Cloudflare D1 stores CV requests and operational audit events.
Audit metadata is allowlisted and must stay privacy-safe.

**Consequences**: Requester payload belongs in `cv_requests`; audit events
belong in `cv_request_events`. Audit metadata must never contain raw requester
data, tokens, secrets, download links, raw provider responses, or asset paths.

## [2026-05-16] - Turnstile For Anti-Spam

**Status**: Accepted

**Decision**: Public submissions require a Turnstile token and the Worker
verifies it server-side with Cloudflare Siteverify.

**Consequences**: The frontend site key is public. `TURNSTILE_SECRET_KEY` is a
Worker secret. Without a configured secret, submissions fail safely before
persistence or email.

## [2026-05-16] - Resend For Email Notifications

**Status**: Accepted

**Decision**: Resend sends owner review emails and requester decision emails.

**Consequences**: `RESEND_API_KEY`, owner destination, and sender values are
Worker secrets or deployment configuration. Do not commit real private email
values unless they are explicitly public-safe.

## [2026-05-16] - Signed Approval And Delivery Tokens

**Status**: Accepted

**Decision**: Approve/reject links and private download links use signed,
expiring HMAC tokens scoped to the request and intended action or CV variant.

**Consequences**: Approval links are effectively single-use through D1 status:
only pending requests can be finalized. Delivery links are accepted only for
approved requests whose token, D1 row, manifest entry, and asset all match.

## [2026-05-16] - Protected Admin Endpoint And Local Scripts

**Status**: Accepted

**Decision**: Operational inspection uses `GET /api/admin/cv-requests/recent`
protected by `ADMIN_API_TOKEN`, plus local PowerShell scripts under
`scripts/admin`.

**Consequences**: The admin endpoint returns safe summaries only. Scripts prompt
for tokens securely and must not print requester private fields, tokens, PDFs,
attachments, or download links.

## [2026-05-16] - Private Delivery Uses Worker Assets, Not R2

**Status**: Accepted

**Decision**: Private CV delivery currently uses generated Worker static assets
with Worker-first routing. R2 is deferred.

**Consequences**: This avoids extra infrastructure and cost while the asset set
is small. Delivery requires generated private assets, an assets binding, a
manifest, `CV_DELIVERY_TOKEN_SECRET`, and `CV_DELIVERY_ENABLED=true`.

## [2026-05-16] - Delivery Is Explicitly Configured

**Status**: Accepted

**Decision**: Approval emails include private download links only when delivery
is explicitly enabled and fully configured. Otherwise approval emails use the
safe fallback message with no CV file or link.

**Consequences**: `CV_DELIVERY_TOKEN_SECRET` must be a Cloudflare secret.
`CV_DELIVERY_MANIFEST_JSON` must be configured from reviewed generated local
assets. Generated private assets and manifest helper files stay ignored.
