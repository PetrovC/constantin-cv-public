# Testing Strategy

This project has three validation surfaces:

- .NET generator tests under `tools/CvGenerator`.
- Worker TypeScript checks and Vitest tests under `services/cv-request-worker`.
- Public privacy/build checks from root npm scripts.

## Mandatory Before PR

Run from the repository root:

```powershell
npm.cmd run cv:generate
npm.cmd run build
npm.cmd run privacy:check
npm.cmd run api:check
npm.cmd run api:test
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

Also verify no private generated or overlay files are tracked:

```powershell
git ls-files generated
git ls-files data/private
```

Expected result: no private generated assets, private PDFs, private print JSON,
or `data/private/cv.private.yml` are listed.

## Worker Tests

Use:

```powershell
npm.cmd run api:check
npm.cmd run api:test
```

The Worker test suite covers:

- health endpoint
- CORS and content-type behavior
- Turnstile verification and safe debug responses
- request validation
- D1 persistence failure handling
- owner notification behavior
- audit event writes and privacy-safe metadata
- approval and rejection token validation
- browser-friendly decision pages
- requester notification behavior
- admin endpoint authorization and safe summaries
- private delivery token and asset checks
- download responses that avoid leaking tokens, asset internals, or private data

Add or update Worker tests when changing request payload shape, validation,
email behavior, D1 queries, audit events, tokens, admin output, CORS, Turnstile,
or private delivery behavior.

## .NET Generator Tests

Use:

```powershell
dotnet test tools/CvGenerator/CvGenerator.sln
```

The generator tests cover:

- public web JSON generation
- print JSON generation
- CV validation
- private overlay validation and application
- visibility filtering for public website, one-page CV, and full developer CV

Add or update .NET tests when changing YAML structure, validation rules,
visibility behavior, generated JSON shape, private overlay behavior, or print
generation.

## Privacy Check

Use:

```powershell
npm.cmd run privacy:check
```

This check scans tracked source files and public artifacts for blocked private
markers and forbidden tracked paths. It expects public generated web JSON and
the public Astro build to exist. If it reports missing public artifacts, run:

```powershell
npm.cmd run cv:generate
npm.cmd run build
```

Then rerun the privacy check.

## Manual Smoke Tests

Manual smoke tests are required for deployment-sensitive workflow changes
because local unit tests do not prove real Cloudflare, Turnstile, D1, or Resend
configuration.

CV request flow:

- Start a local or deployed Worker.
- Confirm `GET /health` returns `{"status":"ok"}`.
- Submit a request with no Turnstile secret and confirm safe `503`.
- Submit a request with a dummy Turnstile token and confirm safe `403`.
- Submit a request with valid Turnstile and configured D1/Resend, then confirm
  `202` and a pending request id.
- Confirm the response does not include requester private fields, tokens, raw
  provider errors, PDFs, or download links.

Approve/reject flow:

- Use the owner email approve link and confirm the request becomes approved.
- Use the owner email reject link on a separate pending request and confirm it
  becomes rejected.
- Reuse a finalized link and confirm a safe already-finalized response.
- Open links from a browser and confirm the HTML page has no request id, token,
  private fields, scripts, or external links.
- Confirm requester decision emails are sent and rejection emails never include
  download links.

Private delivery flow:

- Generate private print data only from local ignored private overlay.
- Generate local PDFs only when explicitly required.
- Prepare Worker assets with `scripts/admin/prepare-private-cv-assets.ps1`.
- Configure delivery manifest and secret outside source control.
- Approve a request with delivery enabled.
- Open the requester download link and confirm it returns a PDF attachment with
  `Cache-Control: no-store`.
- Confirm invalid, expired, mismatched, unknown, or non-approved download links
  return safe errors without leaking tokens, asset paths, private data, or raw
  failures.

## Before Enabling CV_DELIVERY_ENABLED=true

Check all of the following:

- Private overlay exists only locally and is ignored.
- PDFs were generated locally, reviewed, and are ignored.
- Worker private assets were prepared under ignored generated output.
- Manifest JSON was copied from reviewed generated assets and contains only
  expected CV type/language entries.
- `CV_DELIVERY_TOKEN_SECRET` is configured as a Cloudflare secret.
- `CV_PRIVATE_ASSETS` binding points to the generated Worker assets.
- Worker assets use Worker-first routing; assets are not directly public.
- D1 migrations are applied to the target environment.
- Resend secrets and sender configuration are correct.
- Turnstile secret is configured.
- `ALLOWED_ORIGINS` is restricted to exact public origins.
- Admin token is configured and not stored in command history or docs.
- Manual request, approval, and download smoke tests pass.

If any item is missing, keep delivery disabled or remove
`CV_DELIVERY_TOKEN_SECRET`.

## What Public CI Must Not Run

Public CI must not run:

```powershell
npm.cmd run pdf:generate
npm.cmd run api:migrate:remote
npm.cmd run api:deploy
```

These commands either create private artifacts or mutate remote infrastructure.
