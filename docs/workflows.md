# Workflows

## Local public development

Install dependencies:

```powershell
npm ci
```

Generate public web JSON:

```powershell
npm run cv:generate
```

Build the public website:

```powershell
npm run build
```

Run privacy checks:

```powershell
npm run privacy:check
```

Run .NET tests:

```powershell
dotnet test tools/CvGenerator/CvGenerator.sln
```

Run CV request Worker validation:

```powershell
npm run api:check
npm run api:test
```

Run Astro locally:

```powershell
npm run dev --workspace apps/cv-web
```

Because the site uses the GitHub Pages base path, local URLs may include:

```txt
http://localhost:4321/constantin-cv-public/fr/
```

## Local CV request Worker development

The CV request API scaffold lives under:

```txt
services/cv-request-worker
```

Run Worker tests:

```powershell
npm run api:test
```

Run Worker TypeScript checks:

```powershell
npm run api:check
```

Apply D1 migrations to the local Wrangler database:

```powershell
npm run db:migrate:local --workspace services/cv-request-worker
```

Run the local Worker dev server:

```powershell
npm run api:dev
```

`POST /api/cv-requests` enforces configured CORS origins for browser requests,
requires `Content-Type: application/json`, validates requests, stores valid
requests in the local or configured Cloudflare D1 database with `pending`
status, and exposes `GET /health`. After persistence succeeds, it sends an
owner notification email through Resend using Worker environment configuration.
The owner notification includes signed, expiring approve and reject links.

The Worker also exposes:

```txt
GET /api/cv-requests/:id/approve?token=...
GET /api/cv-requests/:id/reject?token=...
```

Those links validate the token signature, token expiry, action, and request id,
then update the D1 status to `approved` or `rejected` and refresh `updatedAt`.
Links are single-use through the current request status: once a request is no
longer `pending`, approval/rejection returns `409 already_finalized`.

After approval or rejection is recorded, the Worker sends a requester decision
notification through Resend. Approval notifications confirm that delivery will
happen in a later follow-up step and do not include a CV file or private
download link. Rejection notifications are polite and do not expose owner
private contact data.

If owner notification sending or approval-link generation fails, the request
remains stored and the API still returns a generic `202 Accepted` response. If
requester decision notification fails after approval or rejection, the decision
status remains updated and the API returns a safe response explaining that the
decision was recorded. Notification retry and audit will be handled later.

It does not deliver PDFs, send the CV to requesters, attach PDFs, or create
public/private download links.

Configure notification values outside source control (`PUBLIC_SITE_URL` is
optional context for the email). `ALLOWED_ORIGINS` is a comma-separated list of
public origins that may call the Worker from a browser:

```txt
ALLOWED_ORIGINS
RESEND_API_KEY
OWNER_NOTIFICATION_EMAIL
OWNER_NOTIFICATION_FROM_EMAIL
APPROVAL_TOKEN_SECRET
PUBLIC_SITE_URL
```

`TURNSTILE_SECRET_KEY` is prepared as an optional secret binding for later spam
protection. It is not required yet, and the Worker does not verify Turnstile
tokens until the public form is connected in a later task.

The Worker currently has a rate-limiting abstraction only. Active rate limiting
must be configured or implemented before connecting the public form; do not
consider the current no-op default to be production protection.

Before deploying the Worker, create the Cloudflare D1 database with Wrangler and
replace the placeholder `database_id` in:

```txt
services/cv-request-worker/wrangler.toml
```

Then apply migrations to the remote D1 database:

```powershell
npm run db:migrate:remote --workspace services/cv-request-worker
```

## Local private PDF generation

Private PDF generation requires:

```txt
data/private/cv.private.yml
```

Create it from:

```powershell
Copy-Item data/private/cv.private.example.yml data/private/cv.private.yml
```

Then fill local private values.

Generate private print data:

```powershell
npm run cv:generate-print
```

Generate PDFs:

```powershell
npm run pdf:generate
```

Generated PDFs stay under:

```txt
generated/pdf/
```

They must not be committed.

## Public CI

The PR workflow must run:

```powershell
npm ci
dotnet test tools/CvGenerator/CvGenerator.sln
npm run api:check
npm run api:test
npm run cv:generate
npm run build
npm run privacy:check
```

Public CI must not run:

```powershell
npm run pdf:generate
```

## GitHub Pages deployment

The deployment workflow runs on `main`.

It must upload only:

```txt
apps/cv-web/dist
```

It must not upload:

```txt
generated/
data/private/
references/private/
```

## Branch workflow

Use feature branches:

```powershell
git checkout main
git pull
git checkout -b feat/my-feature
```

Before pushing:

```powershell
npm run cv:generate
npm run build
npm run api:check
npm run api:test
npm run privacy:check
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

Commit:

```powershell
git add -A
git commit -m "type(scope): message"
git push -u origin feat/my-feature
```

Open a PR to `main`.

## Recommended commit types

Use conventional-style messages:

```txt
feat(web): add CV request form placeholder
fix(web): support GitHub Pages base path
fix(privacy): enforce public-safe repository boundaries
feat(ci): add public checks and GitHub Pages deployment
docs: update privacy documentation
refactor(generator): simplify print generation mapping
```
