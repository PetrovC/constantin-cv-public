# Roadmap

## Phase 1: Bootstrap

- Create documentation.
- Create a minimal multilingual `data/cv.yml`.
- Create the .NET solution skeleton.
- Create the Astro + Vue website skeleton.
- Keep validation and generation minimal.

## Phase 2: CV Validation

- Parse the YAML source of truth.
- Validate required fields.
- Detect missing translations for French, English and German.
- Report review status for translated public content.
- Add focused tests for validation rules.

## Phase 3: Website Content

- Generate web-ready structured data from `data/cv.yml`.
- Render multilingual portfolio pages.
- Add language routing.
- Add project, experience and skills sections.

## Phase 4: Professional Artifacts

- Generate LinkedIn-ready content.
- Add dedicated print pages for CV layouts.
- Add Playwright-based PDF generation.
- Keep website and PDF layouts separate.

## Phase 5: Automation

- Add GitHub Actions checks.
- Add GitHub Pages deployment.
- Add release or artifact publishing only after generated-output policy is settled.
