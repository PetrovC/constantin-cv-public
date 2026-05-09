# AGENTS.md

## Project goal

Build a public-safe multilingual CV and portfolio platform for Constantin Petrov.

The project uses one public-safe CV source of truth to generate:

- a static Astro + Vue portfolio website;
- public web JSON artifacts;
- private/local print and PDF artifacts;
- a future CV request workflow.

## Read order

Always read this file first.

Read additional docs only when relevant:

- `docs/privacy.md` when touching public/private data, contact info, generated artifacts, PDFs, GitHub Pages or serverless workflows.
- `docs/architecture.md` when touching the generator, data flow, domain/application/infrastructure boundaries or Astro data loading.
- `docs/workflows.md` when touching scripts, CI, GitHub Actions, build commands or deployment.
- `docs/codex-usage.md` when changing agent instructions or project automation behavior.
- `docs/roadmap.md` when planning new features.

## Non-negotiable privacy rules

This repository is public.

Tracked files must never contain:

- raw personal email;
- phone number;
- precise home/location details;
- private CV PDFs;
- private reference CV files;
- generated print JSON;
- generated PDFs;
- secrets or API keys.

`data/cv.yml` must remain public-safe.

Private contact data belongs only in:

```txt
data/private/cv.private.yml
```

That file must stay ignored by Git.

Public web JSON must never expose:

- phone number;
- raw email;
- encoded mailto containing the real email;
- precise private location;
- private print routes.

## Architecture boundaries

Keep responsibilities separated:

- `data/cv.yml`: public-safe source of truth.
- `data/private/cv.private.yml`: local private overlay, ignored by Git.
- `tools/CvGenerator`: .NET validation and artifact generation.
- `apps/cv-web`: Astro public website.
- `generated/web`: generated public web JSON, ignored.
- `generated/print`: generated private print JSON, ignored.
- `generated/pdf`: generated private PDFs, ignored.

Domain models must not depend on YAML, JSON, filesystem, Astro or UI concerns.

Application code contains use cases and mapping.

Infrastructure handles file reading and writing.

CLI only parses commands and coordinates services.

Astro components render generated public data and must not contain private CV data.

## Validation commands

Before finishing a normal public-site task, run:

```powershell
npm run cv:generate
npm run build
npm run privacy:check
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

For private/local PDF work only:

```powershell
npm run cv:generate-print
npm run pdf:generate
```

If private overlay data is missing, PDF generation may fail with a clear expected error.

## Git rules

Do not manually edit generated files.

Do not commit:

- `generated/`
- `apps/cv-web/dist/`
- `node_modules/`
- `bin/`
- `obj/`
- `.idea/`
- `.vscode/`
- `data/private/cv.private.yml`
- `references/private/`
- private PDFs or reference files.

## Working style

Keep changes focused and small.

Do not redesign unrelated areas.

Do not introduce new frameworks, services or dependencies without explicit approval.

Prefer simple, explicit and maintainable code.

Avoid over-engineering and premature abstractions.

After each task, summarize:

- changed files or areas;
- commands run;
- privacy impact;
- assumptions;
- remaining risks.
