# 0002 — GitHub Pages base path

## Status

Accepted

## Context

The site is deployed as a GitHub Pages project site, not as a user root site.

Correct production URL:

```txt
https://petrovc.github.io/constantin-cv-public/
```

Incorrect URL:

```txt
https://petrovc.github.io/
```

## Decision

Astro must be configured with the project base path:

```txt
/constantin-cv-public/
```

All internal links, language routes, redirects and anchors must work under this base path.

## Consequences

Local dev may use URLs such as:

```txt
http://localhost:4321/constantin-cv-public/fr/
```

The root language redirect must redirect to base-aware URLs.

Hardcoded absolute links such as `/fr/` should be avoided unless they are base-aware.
