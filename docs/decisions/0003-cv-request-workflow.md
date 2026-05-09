# 0003 — CV request workflow

## Status

Proposed

## Context

The public site should not expose private CV PDFs directly.

Visitors may need to request a CV for mission, recruitment or professional context.

The owner wants to review requests before sending private CV documents.

## Decision

The public website should provide a CV request form instead of direct PDF downloads.

The form should collect:

- full name;
- professional email;
- company / organization;
- LinkedIn or website;
- requested CV type;
- requested language;
- request reason/context.

Initially, the form is front-only and does not submit data.

Later, a backend/serverless workflow will:

```txt
receive request
→ validate payload
→ notify Constantin by email
→ provide approve/reject links
→ send CV or temporary link after approval
```

## Consequences

Private PDFs remain outside the public repository and public build.

Serverless code must keep secrets in environment variables, not source files.

Approval tokens must be signed and expiring.

Spam/rate limiting should be considered before production use.
