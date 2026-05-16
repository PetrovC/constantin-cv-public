# Commands

Use `npm.cmd` on Windows PowerShell. `npm.ps1` can be blocked by execution
policy, while `npm.cmd` uses the npm command shim directly.

Run commands from the repository root unless a command says otherwise.

## Setup

```powershell
npm.cmd ci
dotnet restore tools/CvGenerator/CvGenerator.sln
```

## Public Generation And Build

```powershell
npm.cmd run cv:generate
npm.cmd run build
```

`cv:generate` reads `data/cv.yml` and writes ignored public web JSON under
`generated`.

`build` runs public CV generation and the Astro web build. It does not generate
private PDFs.

## Private Local Generation

Run only when private local data exists and the task explicitly requires private
print/PDF work:

```powershell
npm.cmd run cv:generate-print
npm.cmd run pdf:generate
.\scripts\admin\prepare-private-cv-assets.ps1
```

`cv:generate-print` requires ignored `data/private/cv.private.yml`.

`pdf:generate` creates local generated PDFs. Do not run it in public CI and do
not commit its outputs.

`prepare-private-cv-assets.ps1` copies reviewed local PDFs into ignored Worker
asset output and writes an ignored manifest helper.

## Website Development

```powershell
npm.cmd run dev
npm.cmd run web:build
```

The public CV request form needs public frontend environment values when testing
real submission wiring:

```txt
PUBLIC_CV_REQUEST_API_BASE_URL=<WORKER_URL>
PUBLIC_TURNSTILE_SITE_KEY=<PUBLIC_SITE_KEY>
```

Do not commit local `.env` files with real values.

## Worker Checks And Tests

```powershell
npm.cmd run api:check
npm.cmd run api:test
```

These delegate to `services/cv-request-worker`:

- `api:check`: TypeScript `tsc --noEmit`
- `api:test`: Vitest Worker test suite

## Worker Local Development

```powershell
npm.cmd run api:dev
npm.cmd run api:migrate:local
```

`api:migrate:local` applies D1 migrations to the local Wrangler database.

Local Worker secrets belong in ignored local files such as
`services/cv-request-worker/.dev.vars`, or in the provider secret store for
remote environments. Do not print or commit real values.

## Remote Worker Operations

Run only when explicitly asked to deploy or mutate remote Cloudflare state:

```powershell
npm.cmd run api:migrate:remote
npm.cmd run api:deploy
```

`api:migrate:remote` applies D1 migrations to the remote database.

`api:deploy` deploys the Cloudflare Worker and assets. Confirm D1 binding,
secrets, non-secret vars, delivery manifest, and private assets before running.

## .NET Generator Tests

```powershell
dotnet test tools/CvGenerator/CvGenerator.sln
```

Use this after changes to generator logic, data model assumptions, or docs that
describe generator behavior.

## Privacy And Repository Checks

```powershell
npm.cmd run privacy:check
git diff --check
git status --short
git ls-files generated
git ls-files data/private
```

`privacy:check` verifies tracked files and public artifacts for blocked private
markers. It expects public web JSON and public build artifacts to exist, so run
public generation/build first if needed.

`git ls-files generated` and `git ls-files data/private` should return no
private generated artifacts and no private overlay.

## Admin Scripts

Routine safe inspection:

```powershell
.\scripts\admin\get-cv-requests.ps1
.\scripts\admin\get-cv-requests.ps1 -ApiBase "<WORKER_URL>" -Limit 20 -ShowEvents
.\scripts\admin\get-cv-request-events.ps1 -Limit 20
```

The scripts prompt for `ADMIN_API_TOKEN` securely. Do not pass real admin tokens
as command-line arguments, paste them into docs, or store them in shell history.

Private asset preparation:

```powershell
.\scripts\admin\prepare-private-cv-assets.ps1
```

This requires generated local PDFs and writes ignored private Worker assets.

## PR Validation Baseline

For docs or code changes that need full validation:

```powershell
npm.cmd run cv:generate
npm.cmd run build
npm.cmd run privacy:check
npm.cmd run api:check
npm.cmd run api:test
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

Do not include `npm.cmd run pdf:generate`, `npm.cmd run api:migrate:remote`, or
`npm.cmd run api:deploy` in ordinary public PR validation.
