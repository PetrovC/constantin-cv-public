# Private CV Delivery

Private CV delivery is an opt-in Worker feature for approved CV requests. It uses
generated Worker static assets and signed download links. It does not use R2.

## Privacy Rules

- Do not commit PDFs.
- Do not commit generated private asset files.
- Do not put PDFs in D1, environment variables, secrets, docs, or examples.
- Do not add static website download links.
- Do not expose `CV_PRIVATE_ASSETS` directly from the Worker.
- Do not log or store delivery tokens, secrets, asset paths, requester email,
  full name, company, reason/context, profile URL, or private CV content.

## Local Private Generation Flow

Create the ignored private overlay first:

```powershell
Copy-Item data/private/cv.private.example.yml data/private/cv.private.yml
```

Then replace the placeholder values locally. Do not commit
`data/private/cv.private.yml`.

Generate private print JSON:

```powershell
npm.cmd run cv:generate-print
```

This reads `data/cv.yml` plus `data/private/cv.private.yml`, then writes ignored
private print artifacts under `generated/print/`.

Generate private PDFs:

```powershell
npm.cmd run pdf:generate
```

This builds the French private print routes and writes:

```txt
generated/pdf/fr/CV_Constantin_Petrov_One_Page_FR.pdf
generated/pdf/fr/CV_Constantin_Petrov_Full_Dev_FR.pdf
```

Prepare Worker assets:

```powershell
.\scripts\admin\prepare-private-cv-assets.ps1
```

The script:

- fails when expected private PDFs are missing;
- copies approved local PDF outputs into `generated/private-cv-assets/`;
- writes `generated/private-cv-assets/manifest.json`;
- writes an `.assetsignore` file so only PDF assets are uploaded;
- prints safe status only.

Generated private print JSON, PDFs, and Worker assets are ignored by Git.

## Worker Configuration

Delivery is disabled by default:

```txt
CV_DELIVERY_ENABLED=false
CV_DELIVERY_LINK_TTL_SECONDS=604800
CV_DELIVERY_MANIFEST_JSON={}
```

Enable delivery only after preparing assets and reviewing the manifest:

```txt
CV_DELIVERY_ENABLED=true
CV_DELIVERY_LINK_TTL_SECONDS=604800
CV_DELIVERY_MANIFEST_JSON=<generated manifest JSON>
```

Configure the signing secret outside source control:

```powershell
npm exec --workspace services/cv-request-worker -- wrangler secret put CV_DELIVERY_TOKEN_SECRET
```

Manifest entries map requested CV type and language to the private Worker asset
path and the requester-facing attachment filename:

```json
{
  "one-page": {
    "fr": {
      "assetPath": "/fr/one-page.pdf",
      "downloadFilename": "constantin-petrov-cv-one-page-fr.pdf"
    }
  },
  "full-dev": {
    "fr": {
      "assetPath": "/fr/full-dev.pdf",
      "downloadFilename": "constantin-petrov-cv-full-dev-fr.pdf"
    }
  },
  "full-complete": {
    "fr": {
      "assetPath": "/fr/full-complete.pdf",
      "downloadFilename": "constantin-petrov-cv-full-complete-fr.pdf"
    }
  }
}
```

Only include entries for PDF assets that were generated, reviewed, and prepared
locally.

The Worker assets binding is:

```txt
CV_PRIVATE_ASSETS
```

It points at `generated/private-cv-assets/` and uses Worker-first routing. The
Worker only returns assets through:

```txt
GET /api/cv-requests/:id/download?token=...
```

## Approval Behavior

When an owner approves a request:

- if delivery is enabled and configured, the requester email includes a signed
  temporary download link;
- if delivery is disabled, missing, or misconfigured, the requester email keeps
  the fallback delivery-later message;
- rejection emails never include download links.

The download endpoint validates the signature, expiry, URL request id, D1 row,
approved status, requested CV type, requested language, manifest entry, and
asset availability before returning a PDF attachment with `Cache-Control:
no-store`.

## Real Request Test

1. Create `data/private/cv.private.yml` locally from the example.
2. Run `npm.cmd run cv:generate-print`.
3. Run `npm.cmd run pdf:generate`.
4. Run `.\scripts\admin\prepare-private-cv-assets.ps1`.
5. Configure `CV_DELIVERY_TOKEN_SECRET`.
6. Set `CV_DELIVERY_MANIFEST_JSON` from `generated/private-cv-assets/manifest.json`.
7. Set `CV_DELIVERY_ENABLED=true`.
8. Apply D1 migrations.
9. Deploy the Worker manually.
10. Submit a CV request through the public form.
11. Approve it with the signed owner link.
12. Open the requester email download link and confirm it returns a PDF
    attachment.

## Disable Safely

Set:

```txt
CV_DELIVERY_ENABLED=false
```

For a harder stop, also remove or rotate `CV_DELIVERY_TOKEN_SECRET`. New
approval emails will use the fallback message and no new delivery links will be
created.

## Audit Events

Delivery adds these event types:

- `cv_delivery_link_created`
- `cv_delivery_link_unavailable`
- `cv_download_succeeded`
- `cv_download_failed`

Allowed delivery metadata is limited to:

- `failureKind`
- `requestedCvType`
- `requestedLanguage`

Audit writes are best-effort. Delivery and decision flows must continue to
return safe responses if audit storage fails.
