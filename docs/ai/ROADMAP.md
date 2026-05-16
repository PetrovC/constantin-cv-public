# Roadmap

This roadmap reconciles the older initial roadmap with the current repository
state. Do not invent new product work here; keep it aligned with implemented
features and existing runbooks.

## Done

- Public-safe repository structure.
- Public CV source in `data/cv.yml`.
- Private overlay pattern with ignored `data/private/cv.private.yml`.
- .NET CV validation and generation tool.
- Public web JSON generation.
- Private print JSON generation.
- Astro multilingual public portfolio.
- Vue integration available in the public app.
- Public CV request form wiring.
- Privacy check script.
- Local private PDF generation.
- Cloudflare Worker CV request flow.
- Server-side Turnstile verification.
- D1 request persistence.
- D1 audit event table.
- Resend owner notification emails.
- Signed approve/reject workflow.
- Browser-friendly approval/rejection pages.
- Requester decision notification emails.
- Protected admin endpoint.
- Local PowerShell admin scripts.
- Private delivery foundation through generated Worker static assets.

## In Progress / Stabilization

- Keep AI guidance and operational docs aligned with the implemented workflow.
- Make private delivery deployment safer and less manual.
- Keep manifest handling understandable and reviewable.
- Improve operational checks without exposing requester data, tokens, asset
  paths, or private CV content.
- Review production readiness of rate limiting before treating the public form
  as fully protected.

## Next

- Simplify the private delivery deployment flow.
- Make manifest handling less manual or easier to validate.
- Harden the operational checklist for enabling `CV_DELIVERY_ENABLED=true`.
- Polish owner and requester email copy.
- Improve monitoring/debugging while preserving safe responses and audit
  metadata.

## Later

- Finalize a custom Resend sender/domain if desired.
- Add CI deployment for the Worker only if deployment ownership and secret
  handling are clearly designed.
- Build a richer admin UI only if scripts and the protected endpoint become
  insufficient.
- Add richer PDF templates and additional language/version coverage.
- Add LinkedIn-ready content generation from the same source of truth.

## Explicitly Deferred

- R2 storage for private PDFs, unless Worker assets become insufficient.
- Public direct PDF downloads.
- Serving private PDFs from GitHub Pages or static public output.
- Committing private overlay data, generated private assets, generated PDFs, or
  generated download links.
- Adding dependencies for convenience when the existing scripts or platform APIs
  are sufficient.

## Adjustment From Initial Roadmap

The initial roadmap treated the CV request backend, approval flow, audit trail,
admin endpoint, and private delivery as future milestones. The repository now
implements those foundations. The active roadmap is therefore no longer about
building the first workflow; it is about stabilization, safer operations, and
polish.
