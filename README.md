# Constantin CV

Multilingual CV and portfolio monorepo for Constantin Petrov.

The repository keeps one structured CV source of truth in `data/cv.yml` and will use it to power:

- a public Astro portfolio website;
- downloadable professional CV PDFs;
- LinkedIn-ready generated content.

French is the primary content language. English and German content are present from the start, but must be reviewed before publication.

## Repository Structure

```txt
constantin-cv/
├─ data/
│  └─ cv.yml
├─ apps/
│  └─ cv-web/
├─ tools/
│  └─ CvGenerator/
├─ generated/
├─ docs/
└─ AGENTS.md
```

Generated artifacts are intentionally excluded from Git. Do not manually edit files under `generated/` or `apps/cv-web/dist/`.

## Current Scope

The project currently includes:

- a multilingual CV YAML source of truth (`data/cv.yml`);
- a .NET (Clean Architecture) generator producing public web JSON and private print JSON;
- a multilingual Astro public website (fr/en/de) deployed to GitHub Pages;
- .NET/QuestPDF generation of the private CV PDF variants;
- a Cloudflare Worker backend (D1 + Resend) handling CV access requests;
- CI/CD via GitHub Actions (PR checks + Pages deploy) with a public-privacy gate.

## Useful Commands

```powershell
dotnet build tools/CvGenerator/CvGenerator.sln
dotnet test tools/CvGenerator/CvGenerator.sln
dotnet run --project tools/CvGenerator/src/CvGenerator.Cli/CvGenerator.Cli.csproj -- validate --input data/cv.yml

npm install
npm run build --workspace apps/cv-web
```

## Local Website URL

The Astro website is configured for the GitHub Pages project path `/constantin-cv-public`. When running the web app locally, open:

```txt
http://localhost:4321/constantin-cv-public/
```
