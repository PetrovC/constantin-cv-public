# Architecture

## Purpose

This project generates a public-safe multilingual portfolio website and private/local CV artifacts from structured CV data.

The architecture exists to serve the CV/portfolio product. It should remain simple, explicit and maintainable.

## Main data flow

```txt
data/cv.yml
  → CvGenerator validation
  → generated/web/*.json
  → Astro public portfolio
```

Private/local PDF flow:

```txt
data/cv.yml
+ data/private/cv.private.yml
  → CvGenerator print generation
  → generated/print/*.json
  → Astro print pages in private mode
  → Playwright
  → generated/pdf/*
```

## Repository areas

```txt
data/
  cv.yml                      Public-safe source of truth
  private/
    cv.private.example.yml    Placeholder example, safe to commit
    cv.private.yml            Private local overlay, ignored

tools/CvGenerator/
  src/CvGenerator.Domain/
  src/CvGenerator.Application/
  src/CvGenerator.Infrastructure/
  src/CvGenerator.Cli/
  tests/CvGenerator.Tests/

apps/cv-web/
  Astro public website

generated/
  web/
  print/
  pdf/
```

`generated/` is ignored and must not be manually edited.

## Layering rules

### Domain

Domain models describe CV concepts.

Domain must not depend on:

- YAML parsing;
- JSON serialization;
- filesystem;
- Astro;
- web components;
- Playwright;
- GitHub Actions.

### Application

Application contains:

- validation use cases;
- generation use cases;
- mapping from domain models to output DTOs;
- filtering by visibility rules.

Application should not perform direct filesystem writes.

### Infrastructure

Infrastructure contains:

- YAML file reading;
- JSON artifact writing;
- concrete file-based implementations.

### CLI

CLI responsibilities:

- parse commands;
- validate arguments;
- coordinate application and infrastructure services;
- print clear success/failure messages;
- return meaningful exit codes.

CLI must not contain business rules.

### Astro website

Astro renders public-safe generated web JSON.

Astro components must not contain hard-coded private CV data.

The public website must not depend on private overlay data.

## Visibility rules

Experiences can have visibility flags such as:

- `website`
- `shortCv`
- `fullDevCv`
- `fullCompleteCv`
- `linkedin`

Public website rendering must use only `website = true`.

One-page CV generation should use `shortCv = true`.

Full developer CV generation should use `fullDevCv = true`.

Complete CV generation, if implemented later, should use `fullCompleteCv = true`.

## GitHub Pages

The project is deployed as a GitHub Pages project site.

Expected production URL:

```txt
https://petrovc.github.io/constantin-cv-public/
```

Astro must respect the repository base path:

```txt
/constantin-cv-public/
```

All internal links, language redirects and section anchors must work under that base path.

## Design principles

The public website should feel like a modern developer portfolio, not like a PDF embedded in a browser.

Prefer:

- readable layout;
- strong visual hierarchy;
- accessible navigation;
- public-safe data;
- lightweight interactions;
- static output compatible with GitHub Pages.

Avoid:

- unnecessary JavaScript;
- heavy UI frameworks;
- private data in public components;
- duplicated CV content in components.
