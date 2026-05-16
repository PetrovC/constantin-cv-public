# Glossary

| Term | Definition |
|---|---|
| Public CV | Public-safe CV data and website content that can be committed and published without private contact details. |
| Private CV overlay | Ignored local YAML file at `data/private/cv.private.yml` that supplies private email, phone, and address/location for print output. |
| Generated web artifact | Public JSON produced from `data/cv.yml` for the Astro site, normally under generated web output. |
| Print artifact | Private print JSON generated after applying the private overlay; used by print-mode Astro pages and local PDF generation. |
| Private CV asset | Generated private PDF asset prepared for Worker-controlled delivery; must stay ignored and never be served directly. |
| Worker | Cloudflare Worker service in `services/cv-request-worker` that handles CV request API, approval flow, admin endpoint, and private delivery. |
| D1 | Cloudflare's serverless SQL database used for CV requests and audit events. |
| Turnstile | Cloudflare anti-spam challenge. The browser gets a public token, and the Worker verifies it with a secret key. |
| Resend | Email provider used by the Worker for owner and requester notifications. |
| Approval token | Signed, expiring token in owner approve/reject links; scoped to request id and action. |
| Delivery token | Signed, expiring token in requester download links; scoped to request id, CV type, and language. |
| Audit event | Safe operational event stored in D1, such as request creation, notification status, approval, rejection, or download result. |
| Admin endpoint | Protected Worker endpoint `GET /api/admin/cv-requests/recent`, requiring `ADMIN_API_TOKEN` and returning safe summaries only. |
| Manifest | JSON mapping requested CV type and language to a private Worker asset path and attachment filename. |
| GitHub Pages | Public static hosting target documented for the portfolio site; must never receive private PDFs or private generated assets. |
| Cloudflare Worker assets | Static assets bundled with a Worker deployment. This project uses them for private PDFs behind Worker token checks, not as direct public files. |
| Public CI | Validation pipeline that may build the public site and run tests, but must not generate private PDFs or deploy the Worker. |
| Private delivery | Opt-in approval path that sends a temporary signed link to an approved requester when all delivery configuration is present. |
| R2 | Cloudflare object storage. Deferred for now because Worker assets are sufficient for the small reviewed private asset set. |
