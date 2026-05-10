# Cloudflare Worker deployment

This document prepares manual deployment for the CV request API Worker. It does
not deploy anything automatically, deliver PDFs, or add private data to the
repository.

## Safety rules

- Keep `services/cv-request-worker/wrangler.toml` public-safe.
- Do not commit a real `account_id`.
- Do not commit a real D1 `database_id`.
- Do not commit Worker secrets, API keys, Turnstile secret keys, private email
  addresses, private CV files, generated print data, or generated PDFs.
- Keep production frontend values deployment-specific. The Turnstile site key
  is public-safe, but committed examples must use placeholders only.
- Keep CI limited to validation. CI must not run `npm run api:deploy`,
  `npm run api:migrate:remote`, or `wrangler deploy` until a separate deployment
  workflow is intentionally designed.
- The public form is wired to this API through Astro `PUBLIC_` environment
  variables. Review active rate limiting and final production configuration
  before promoting the connected form as production protection.

The committed `wrangler.toml` uses empty non-secret vars and an all-zero D1 id as
placeholders:

```toml
ALLOWED_ORIGINS = ""
PUBLIC_SITE_URL = ""
database_id = "00000000-0000-0000-0000-000000000000"
```

Replace those only in local deployment configuration, then keep the real values
out of commits.

## Manual setup

Install dependencies:

```powershell
npm ci
```

Log in to Cloudflare with the Worker workspace's Wrangler dependency:

```powershell
npm exec --workspace services/cv-request-worker -- wrangler login
npm exec --workspace services/cv-request-worker -- wrangler whoami
```

Create the D1 database:

```powershell
npm exec --workspace services/cv-request-worker -- wrangler d1 create cv-request-worker
```

Copy the D1 `database_id` returned by Wrangler into a local-only deployment
configuration. The simplest manual path is an uncommitted local edit to
`services/cv-request-worker/wrangler.toml` before deployment. Do not commit the
real id.

Apply migrations locally when developing:

```powershell
npm run api:migrate:local
```

Apply migrations to the remote D1 database only after the real D1 binding is
configured locally:

```powershell
npm run api:migrate:remote
```

Configure Worker secrets with Wrangler. Enter the values interactively; do not
place values in commands, docs, source files, or CI logs.

```powershell
npm exec --workspace services/cv-request-worker -- wrangler secret put RESEND_API_KEY
npm exec --workspace services/cv-request-worker -- wrangler secret put OWNER_NOTIFICATION_EMAIL
npm exec --workspace services/cv-request-worker -- wrangler secret put OWNER_NOTIFICATION_FROM_EMAIL
npm exec --workspace services/cv-request-worker -- wrangler secret put APPROVAL_TOKEN_SECRET
npm exec --workspace services/cv-request-worker -- wrangler secret put TURNSTILE_SECRET_KEY
```

Configure non-secret vars before deploying:

- `ALLOWED_ORIGINS`: comma-separated exact origins that may call
  `POST /api/cv-requests` from browsers.
- `PUBLIC_SITE_URL`: public portfolio origin used as email context.

These are not secrets, but they are deployment-specific. Keep real values in the
Cloudflare Worker environment or an uncommitted local Wrangler config. If you
set them in the Cloudflare dashboard, make sure a later `wrangler deploy` will
not overwrite them with the committed empty placeholders.

Deploy manually only after the D1 binding, migrations, vars, and secrets are in
place:

```powershell
npm run api:deploy
```

## Turnstile setup

Create a Turnstile site in Cloudflare for the public portfolio origin.

- The frontend uses `PUBLIC_TURNSTILE_SITE_KEY` to render the Turnstile widget.
- The Worker uses the Turnstile secret key through `TURNSTILE_SECRET_KEY`.
- Do not commit the secret key.
- Use `PUBLIC_CV_REQUEST_API_BASE_URL` in the Astro app to point the static form
  at the deployed Worker origin.

`POST /api/cv-requests` requires a `turnstileToken`. Without
`TURNSTILE_SECRET_KEY`, the Worker returns a safe `503` configuration response.
With a configured secret and an invalid or dummy token, it returns `403`.
A full accepted request requires a token produced by a matching Turnstile widget.

## Resend setup

Configure the sender domain and sender address in Resend outside this repo.

- Store the Resend API key as the `RESEND_API_KEY` Worker secret.
- Store the owner destination address as the `OWNER_NOTIFICATION_EMAIL` Worker
  secret.
- Store the approved sender address as the `OWNER_NOTIFICATION_FROM_EMAIL`
  Worker secret.
- Do not commit sender addresses, private destination addresses, or API keys.

## Local smoke tests

Start the local Worker:

```powershell
npm run api:dev
```

Check health:

```powershell
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8787/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Test a request payload without private personal data:

```powershell
$body = @{
  fullName = "Alex Martin"
  requesterEmail = "alex.martin@example.com"
  company = "Example Consulting"
  profileUrl = "https://www.example.com/profile/alex-martin"
  requestedCvType = "full-dev"
  requestedLanguage = "en"
  reason = "Reviewing a senior software engineering opportunity."
  turnstileToken = "replace-with-token-from-turnstile-widget"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8787/api/cv-requests `
  -ContentType "application/json" `
  -Body $body
```

Smoke-test expectations:

- With no `TURNSTILE_SECRET_KEY`, expect `503 configuration_error`.
- With `TURNSTILE_SECRET_KEY` and a dummy token, expect
  `403 turnstile_verification_failed`.
- With a valid Turnstile token, configured D1 database, configured Resend
  secrets, and valid non-secret vars, expect `202` with a pending request id.
- If you include an `Origin` header, it must match `ALLOWED_ORIGINS` exactly.

The current Worker does not send PDFs, attach CV files, or create download
links.

## Validation

Before opening a PR for deployment setup changes, run:

```powershell
npm run api:check
npm run api:test
npm run privacy:check
npm run build
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

These commands do not require real Cloudflare secrets and must remain safe for
public CI.
