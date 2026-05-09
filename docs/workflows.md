# Workflows

## Local public development

Install dependencies:

```powershell
npm ci
```

Generate public web JSON:

```powershell
npm run cv:generate
```

Build the public website:

```powershell
npm run build
```

Run privacy checks:

```powershell
npm run privacy:check
```

Run .NET tests:

```powershell
dotnet test tools/CvGenerator/CvGenerator.sln
```

Run Astro locally:

```powershell
npm run dev --workspace apps/cv-web
```

Because the site uses the GitHub Pages base path, local URLs may include:

```txt
http://localhost:4321/constantin-cv-public/fr/
```

## Local private PDF generation

Private PDF generation requires:

```txt
data/private/cv.private.yml
```

Create it from:

```powershell
Copy-Item data/private/cv.private.example.yml data/private/cv.private.yml
```

Then fill local private values.

Generate private print data:

```powershell
npm run cv:generate-print
```

Generate PDFs:

```powershell
npm run pdf:generate
```

Generated PDFs stay under:

```txt
generated/pdf/
```

They must not be committed.

## Public CI

The PR workflow must run:

```powershell
npm ci
dotnet test tools/CvGenerator/CvGenerator.sln
npm run cv:generate
npm run build
npm run privacy:check
```

Public CI must not run:

```powershell
npm run pdf:generate
```

## GitHub Pages deployment

The deployment workflow runs on `main`.

It must upload only:

```txt
apps/cv-web/dist
```

It must not upload:

```txt
generated/
data/private/
references/private/
```

## Branch workflow

Use feature branches:

```powershell
git checkout main
git pull
git checkout -b feat/my-feature
```

Before pushing:

```powershell
npm run cv:generate
npm run build
npm run privacy:check
dotnet test tools/CvGenerator/CvGenerator.sln
git diff --check
```

Commit:

```powershell
git add -A
git commit -m "type(scope): message"
git push -u origin feat/my-feature
```

Open a PR to `main`.

## Recommended commit types

Use conventional-style messages:

```txt
feat(web): add CV request form placeholder
fix(web): support GitHub Pages base path
fix(privacy): enforce public-safe repository boundaries
feat(ci): add public checks and GitHub Pages deployment
docs: update privacy documentation
refactor(generator): simplify print generation mapping
```
