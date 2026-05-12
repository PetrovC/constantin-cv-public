# Admin Scripts

Local admin scripts live under:

```txt
scripts/admin/
```

They call the protected CV request admin endpoint:

```txt
GET /api/admin/cv-requests/recent
```

The scripts prompt for `ADMIN_API_TOKEN` with `Read-Host -AsSecureString`.
PowerShell does not echo the token while you paste it. The scripts use the token
only for the current request, do not accept it as a command-line parameter, and
do not write it to disk.

## Inspect Recent Requests

Use the deployed Worker by default:

```powershell
.\scripts\admin\get-cv-requests.ps1
```

Limit the number of returned requests:

```powershell
.\scripts\admin\get-cv-requests.ps1 -Limit 20
```

Point the script at a local Worker:

```powershell
.\scripts\admin\get-cv-requests.ps1 -ApiBase "http://127.0.0.1:8787" -Limit 20
```

Show safe audit event type names after the request table:

```powershell
.\scripts\admin\get-cv-requests.ps1 -ShowEvents
```

Example output:

```txt
requestId                            status   requestedCvType requestedLanguage createdAt            updatedAt
---------                            ------   --------------- ---------------- ---------            ---------
11111111-1111-4111-8111-111111111111 pending  full-dev        en               2026-05-12T09:30:00Z 2026-05-12T09:30:00Z
22222222-2222-4222-8222-222222222222 approved one-page        fr               2026-05-11T18:10:00Z 2026-05-11T18:45:00Z
```

The table is intentionally limited to safe request metadata:

```txt
requestId
status
requestedCvType
requestedLanguage
createdAt
updatedAt
```

It does not print requester email, full name, company, reason/context, profile
URL, approval tokens, Turnstile tokens, Resend API keys, raw payloads, PDFs,
attachments, or download links.

## Inspect Events

To focus on event type names from the same admin response:

```powershell
.\scripts\admin\get-cv-request-events.ps1 -Limit 20
```

Example output:

```txt
requestId                            status   eventType                     createdAt            updatedAt
---------                            ------   ---------                     ---------            ---------
11111111-1111-4111-8111-111111111111 pending  request_created               2026-05-12T09:30:00Z 2026-05-12T09:30:00Z
22222222-2222-4222-8222-222222222222 approved request_created               2026-05-11T18:10:00Z 2026-05-11T18:45:00Z
22222222-2222-4222-8222-222222222222 approved owner_notification_sent       2026-05-11T18:10:00Z 2026-05-11T18:45:00Z
22222222-2222-4222-8222-222222222222 approved request_approved              2026-05-11T18:10:00Z 2026-05-11T18:45:00Z
22222222-2222-4222-8222-222222222222 approved requester_notification_sent   2026-05-11T18:10:00Z 2026-05-11T18:45:00Z
```

## Generate And Set ADMIN_API_TOKEN

Generate a long random token locally:

```powershell
$TokenBytes = New-Object byte[] 32
$Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $Random.GetBytes($TokenBytes)
  [Convert]::ToBase64String($TokenBytes)
} finally {
  [Array]::Clear($TokenBytes, 0, $TokenBytes.Length)
  $Random.Dispose()
}
```

For the deployed Cloudflare Worker, set it as an interactive secret:

```powershell
npm exec --workspace services/cv-request-worker -- wrangler secret put ADMIN_API_TOKEN
```

Paste the generated token only when Wrangler prompts for the secret value.

For local Wrangler development, put a local token in:

```txt
services/cv-request-worker/.dev.vars
```

Example local entry:

```txt
ADMIN_API_TOKEN=replace-with-a-long-random-local-token
```

That file is ignored by Git. Never commit, share, paste into issue comments, or
store real admin tokens in docs, source files, generated artifacts, screenshots,
logs, or shell history snippets.

## Troubleshooting

`401 Unauthorized`: the request did not include a usable bearer token. Rerun the
script and paste `ADMIN_API_TOKEN` when prompted.

`403 Forbidden`: the token was received but does not match the Worker secret.
Check that the value you pasted matches the configured `ADMIN_API_TOKEN`.

`503 Service Unavailable`: the Worker admin service is not configured or D1 is
temporarily unavailable. Confirm `ADMIN_API_TOKEN` is configured for the target
Worker and that the D1 binding is healthy.
