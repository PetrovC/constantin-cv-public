# Roadmap

## Completed foundations

- Public-safe repository structure.
- Public CV source in `data/cv.yml`.
- Private overlay pattern in `data/private/cv.private.yml`.
- .NET CV validation.
- Public web JSON generation.
- Astro multilingual portfolio.
- GitHub Pages deployment.
- CI and privacy checks.
- Local/private PDF generation foundation.
- Public CV request form placeholder.

## Next milestones

### V1.1 — CV request workflow UI

Goal: prepare the public user journey for requesting CV PDFs.

Scope:

- improve CV request section;
- keep form front-only until backend exists;
- no private data exposure;
- no direct PDF downloads.

### V1.2 — Serverless CV request backend

Goal: receive CV requests safely.

Expected flow:

```txt
Visitor submits request
→ backend validates payload
→ request is stored or logged safely
→ approval email is sent to Constantin
```

Possible fields:

- full name;
- professional email;
- company / organization;
- LinkedIn or website;
- requested CV type;
- requested language;
- reason/context.

### V1.3 — Approval workflow

Goal: approve or reject CV requests by email.

Expected flow:

```txt
Constantin receives request email
→ clicks approve or reject
→ token is verified
→ requester is notified
```

Approval links must use signed, expiring tokens.

### V1.4 — Private CV delivery

Goal: send approved CVs.

Possible delivery modes:

- email attachment;
- temporary signed download link.

Preferred: temporary signed link.

### V1.5 — PDF visual polish

Goal: make generated PDFs professionally designed.

Tasks:

- improve one-page layout;
- improve full developer CV layout;
- avoid ugly page breaks;
- tune typography;
- generate FR / EN / DE versions.

### V1.6 — LinkedIn content generation

Goal: generate LinkedIn-ready snippets from the source of truth.

Potential outputs:

- headline;
- about section;
- experience descriptions;
- multilingual variants.

## Future ideas

- Admin-only request dashboard.
- Rate limiting for CV requests.
- Spam protection.
- Audit trail for approved/rejected requests.
- Optional analytics without personal tracking.
