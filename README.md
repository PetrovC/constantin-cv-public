# Constantin CV

Multilingual CV and portfolio monorepo for Constantin Petrov.

The repository keeps one structured CV source of truth in `data/cv.yml` and will use it to power:

- a public Astro + Vue portfolio website;
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

This bootstrap contains:

- initial project documentation;
- a minimal multilingual CV YAML file;
- a .NET generator solution skeleton;
- an Astro website prepared for Vue components;
- a simple portfolio landing page.

PDF generation, CI/CD, external services and database storage are out of scope for this first version.

## Useful Commands

```powershell
dotnet build tools/CvGenerator/CvGenerator.sln
dotnet test tools/CvGenerator/CvGenerator.sln
dotnet run --project tools/CvGenerator/src/CvGenerator.Cli/CvGenerator.Cli.csproj -- validate --input data/cv.yml

npm install
npm run build --workspace apps/cv-web
```
