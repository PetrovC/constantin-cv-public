# Codex Usage Guide

## Goal

Keep Codex prompts short and focused.

`AGENTS.md` contains only non-negotiable project rules.

Long context belongs in specific docs.

## Prompt template

Use this structure:

```txt
Read AGENTS.md first.

Task:
<short task description>

Relevant docs:
- Read docs/privacy.md if touching public/private data.
- Read docs/architecture.md if touching generator/build/data flow.
- Read docs/workflows.md if touching scripts, CI or deployment.

Scope:
- Work only under <folders>.
- Do not modify unrelated files.
- Do not expose private data.

Validation:
Run:
- npm run cv:generate
- npm run build
- npm run privacy:check
- dotnet test tools/CvGenerator/CvGenerator.sln

At the end:
- summarize changes
- confirm privacy checks
- list commands passed
- mention assumptions
```

## When to ask Codex to read docs

Ask for `docs/privacy.md` when work touches:

- contact info;
- CV request form;
- PDF generation;
- print routes;
- GitHub Pages;
- generated artifacts;
- serverless/API;
- CI privacy checks.

Ask for `docs/architecture.md` when work touches:

- .NET generator;
- CV models;
- validation;
- artifact generation;
- Astro data loading;
- visibility rules.

Ask for `docs/workflows.md` when work touches:

- package scripts;
- GitHub Actions;
- deployment;
- local dev commands;
- PDF commands.

Ask for `docs/roadmap.md` when planning new features.

## Good prompts

```txt
Read AGENTS.md first.
Read docs/privacy.md because this touches the public CV request form.

Add a front-only CV request form placeholder.
Work only under apps/cv-web.
Do not add backend logic.
Do not expose private data.

Run npm run cv:generate, npm run build, npm run privacy:check and dotnet test.
```

## Bad prompts

Avoid broad requests like:

```txt
Improve everything.
Make it better.
Refactor the whole project.
Read all docs and continue.
```

These waste context and increase risk.

## Review expectations

For every Codex result, check:

```powershell
git status --short
git diff --stat
git diff --check
npm run privacy:check
```

Also inspect whether files outside the requested scope were modified.

## Browser verification

For UI tasks, ask Codex to verify:

- `/constantin-cv-public/fr/`
- `/constantin-cv-public/en/`
- `/constantin-cv-public/de/`
- language switcher;
- navigation links;
- form behavior;
- mobile layout;
- no private data visible;
- no console errors.

## Keep Codex efficient

Prefer:

- small tasks;
- precise scope;
- relevant docs only;
- explicit validation commands.

Avoid:

- asking Codex to read every file;
- repeating full project history;
- putting roadmap details in `AGENTS.md`;
- asking for large redesigns mixed with backend changes.
