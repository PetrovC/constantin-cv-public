# 0001 — Public/private data boundary

## Status

Accepted

## Context

The repository is public and is used for GitHub Pages.

The project needs public portfolio data and private CV/PDF data.

Private data includes:

- personal email;
- phone number;
- precise location;
- private CV PDFs;
- private reference CV files.

## Decision

`data/cv.yml` is public-safe and can be committed.

Private contact data belongs only in:

```txt
data/private/cv.private.yml
```

That file is ignored by Git.

Generated private artifacts belong only under:

```txt
generated/print/
generated/pdf/
```

These folders are ignored by Git.

## Consequences

The public website can be safely deployed from the public repository.

Private PDF generation requires local private overlay data.

Public CI must not generate PDFs.

Future serverless code must not contain secrets or private data in source files.
