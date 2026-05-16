# Privacy Rules

This repository is designed to be safe for public GitHub hosting.

## Public repository rules

Tracked source files must not contain:

- raw personal email;
- phone number;
- precise home/location details;
- private CV PDFs;
- reference CV files;
- generated print JSON;
- generated PDFs;
- secrets or API keys.

The public CV source in `data/cv.yml` may contain only public-safe information, including the broad location:

```txt
Belgique / Luxembourg
```

## Public-safe data

`data/cv.yml` is safe to commit.

It must not contain:

- private email;
- phone number;
- precise home location;
- private PDF-only contact data.

## Private overlay

Private contact data belongs in:

```txt
data/private/cv.private.yml
```

That file is ignored by Git.

Create it locally from:

```txt
data/private/cv.private.example.yml
```

Then replace placeholder values with private contact details.

## Public web JSON

Generated public web JSON lives under:

```txt
generated/web/
```

It must never expose:

- phone number;
- raw email;
- encoded mailto containing the real email;
- precise private location;
- private CV PDFs.

## Private print data

The private print model (with private contact data) exists only in memory
during PDF generation. No private print JSON artifact is written to disk and
nothing under `generated/print/` is produced anymore.

## Generated PDFs

Generated PDFs live under:

```txt
generated/pdf/
```

They are private artifacts because they may include private contact details.

They must not be committed.

They should not be publicly deployed unless intentionally reviewed and approved.

## Public build

The web app no longer contains any print pages or print routes. Private CV
rendering is fully handled by the .NET `CvGenerator.Pdf` (QuestPDF) generator
and never touches the public Astro build.

## Privacy check

Run:

```powershell
npm run privacy:check
```

The check should fail if public/tracked files contain blocked private patterns.

## Future CV request workflow

Future public CV access should use a request workflow instead of direct public PDF downloads.

Expected flow:

```txt
Visitor requests CV
→ request is sent to a backend/serverless function
→ Constantin receives an approval email
→ Constantin approves or rejects
→ approved requester receives a temporary link or email attachment
```

The public repository must still not contain private contact data, PDFs, secrets or serverless credentials.

Serverless secrets must be stored in provider environment variables or GitHub secrets, never in source files.
