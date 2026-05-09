# 0004 - CV request backend contract

## Status

Proposed

## Context

ADR 0003 records the decision to provide a CV request form instead of public
private-CV downloads.

The public form currently stays front-only. A future backend or serverless
function will need a stable contract before it can receive, validate, approve,
reject, and deliver CV requests safely.

The repository remains public, so the contract must not introduce private CV
files, private contact data, secrets, provider credentials, or a live submission
path.

## Decision

Define the future CV request backend contract in:

```txt
docs/cv-request-workflow.md
```

The future request payload will contain:

- `fullName`
- `requesterEmail`
- `company`
- optional `profileUrl`
- `requestedCvType`
- `requestedLanguage`
- `reason`

The future backend must validate required fields, maximum lengths, email format,
the optional profile URL format when present, allowed CV types, and allowed
languages before sending an approval email.

Approval and rejection links must use signed, expiring tokens. Approved delivery
may use either a temporary signed link or an attachment, but private CV files
must remain outside the public repository and static public build.

The current website must remain front-only until a backend is intentionally
implemented later.

## Consequences

Future backend work has a documented API shape and response vocabulary.

The public site can keep the request UI without sending or storing visitor data.

Rate limiting and spam protection are required before production enablement.

Secrets and private recipient addresses must be supplied through backend
environment configuration, not source files or frontend code.
