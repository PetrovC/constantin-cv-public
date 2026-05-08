# Architecture

## Goal

The platform is a small monorepo for a multilingual CV and portfolio. The core rule is simple: `data/cv.yml` is the source of truth, and every public artifact must derive from it.

## Boundaries

```txt
data/cv.yml
  -> tools/CvGenerator
  -> generated/*
  -> apps/cv-web
```

The website and the PDF layouts must stay separate. The public website can be dynamic and portfolio-oriented, while the PDF output must remain a professional CV format.

## .NET Generator

The .NET solution lives in `tools/CvGenerator` and is split into explicit layers:

- `CvGenerator.Domain`: core CV concepts and business rules.
- `CvGenerator.Application`: use cases such as validation and generation orchestration.
- `CvGenerator.Infrastructure`: file system and YAML loading concerns.
- `CvGenerator.Cli`: command-line interface.
- `CvGenerator.Tests`: test project placeholder for validation and generation behavior.

Business rules should stay out of the CLI and UI. The CLI should call application services, and infrastructure should provide adapters for reading and writing files.

## Web App

The public website lives in `apps/cv-web` and uses Astro with Vue integration enabled. Astro owns pages and routing; Vue components can be introduced for interactive sections.

For now, the web app contains only a simple landing page. Later, it should consume generated web data rather than manually duplicating CV content.

## Generated Artifacts

The following paths are generated outputs and must not be manually edited:

```txt
generated/web/*
generated/pdf/*
generated/linkedin/*
apps/cv-web/dist/*
```

Generated files are ignored by Git unless the project explicitly decides otherwise later.
