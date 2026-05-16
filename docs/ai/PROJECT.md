# Project Context

This file is the short project brief for AI agents. Keep it factual,
operational, and public-safe.

## Purpose

This repository is the public-clean CV and portfolio project for Constantin
Petrov. It publishes a public-safe multilingual developer portfolio and keeps
private contact details, private CV outputs, secrets, and delivery artifacts out
of Git.

The core idea is dynamic CV generation: one structured public data source feeds
the public website, while an ignored local private overlay can be applied only
for private print/PDF generation and approved delivery.

## Current Product State

- Public portfolio website: Astro with Vue integration under `apps/cv-web`.
- CV source of truth: `data/cv.yml`, public-safe and committed.
- Private overlay: `data/private/cv.private.yml`, local-only and ignored.
- Generator: .NET solution under `tools/CvGenerator`.
- Public generated web artifacts: `generated/web/*.json`, ignored and
  regenerated from `data/cv.yml`.
- Private generated print artifacts: local-only print JSON and PDFs under
  ignored `generated` subfolders.
- CV request workflow: Cloudflare Worker under `services/cv-request-worker`.
- Persistence: Cloudflare D1 tables for requests and audit events.
- Anti-spam: Cloudflare Turnstile verification in the Worker.
- Email: Resend notifications for owner review and requester decisions.
- Approval flow: signed approve/reject links with browser-friendly decision
  pages.
- Admin operations: protected Worker endpoint plus local PowerShell scripts.
- Private delivery: approved requests can receive signed temporary download
  links served by the Worker from generated static assets. R2 is not used.

## Users And Roles

| Role | Description | Key permissions |
|---|---|---|
| Public visitor | Reads the public portfolio. | View public website only. |
| CV requester | Submits a professional CV request form. | Submit request after Turnstile verification. |
| Owner | Reviews requests from Resend owner emails. | Approve or reject using signed links. |
| Admin operator | Runs local admin scripts or direct API calls. | Read safe request summaries with `ADMIN_API_TOKEN`. |
| AI agent | Maintains code and docs safely. | May edit scoped files, but must not expose private data. |

## Main Workflows

1. Public website build:
   - `data/cv.yml`
   - .NET generator
   - `generated/web/*.json`
   - Astro static site in `apps/cv-web/dist`
2. Private local PDF generation:
   - `data/cv.yml`
   - ignored `data/private/cv.private.yml`
   - private print JSON
   - print-mode Astro pages
   - local Playwright PDF output
3. CV request workflow:
   - public form posts to the Worker
   - Turnstile is verified server-side
   - request is stored in D1 with pending status
   - owner receives approve/reject links by Resend
   - decision updates D1 and audits the event
   - approved delivery link is included only when delivery is explicitly enabled
     and fully configured

## Technical Stack

| Layer | Technology |
|---|---|
| Public website | Astro, Vue integration, TypeScript, static output |
| CV generator | .NET, C#, xUnit tests |
| Request API | Cloudflare Worker, TypeScript |
| Persistence | Cloudflare D1 |
| Anti-spam | Cloudflare Turnstile |
| Email | Resend |
| PDF generation | Astro print build, Playwright, local files |
| Public hosting | Static site output, documented for GitHub Pages/static hosting |
| Private delivery | Cloudflare Worker assets with Worker-first routing |
| Admin operations | Protected Worker endpoint, PowerShell scripts |

## Public Vs Private Boundary

Public-safe and committed:

- `data/cv.yml`
- source code
- public examples with placeholders
- documentation that uses placeholders only

Local-only and never committed:

- `data/private/cv.private.yml`
- generated private print JSON
- generated PDFs
- generated private Worker assets
- real private email, phone number, or address
- secrets, API keys, tokens, Cloudflare account ids, real D1 database ids
- generated download links

Use placeholders in docs and examples:

```txt
<PRIVATE_EMAIL>
<PRIVATE_PHONE>
<PRIVATE_ADDRESS>
<SECRET_VALUE>
<D1_DATABASE_ID>
<WORKER_URL>
```

## Constraints

- This is a public-clean repository. Assume every tracked file may be published.
- Generated artifacts are outputs, not source. Do not hand-edit them.
- Private CV PDFs must not be served from GitHub Pages or any public static
  build.
- Worker secrets belong in Cloudflare secrets or local ignored files, never in
  committed vars or docs.
- Remote D1 migration and Worker deployment commands mutate cloud state. Run
  them only when explicitly requested.
- Public CI must not generate private PDFs or private Worker assets.

## Current Priorities

1. Keep the public/private data boundary easy to audit.
2. Stabilize private CV delivery operations without adding R2.
3. Keep docs, commands, and tests aligned with the current Worker and generator.
4. Improve operational visibility without leaking requester data or tokens.

## Known Risks

- Delivery depends on correct Worker env configuration, manifest JSON, assets
  binding, D1 state, and signing secret.
- The rate limiter abstraction exists, but the default Worker dependency is
  inactive; do not treat it as production rate limiting by itself.
- Some older root docs may describe earlier milestones. Prefer source, package
  scripts, migrations, and current runbooks when resolving ambiguity.
