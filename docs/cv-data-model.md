# CV Data Model

`data/cv.yml` is the single source of truth for public CV and portfolio content.

## Languages

French is the primary language:

```yaml
languages:
  primary: fr
  supported:
    - fr
    - en
    - de
```

Translatable values should use language keys:

```yaml
headline:
  fr: "Développeur .NET et web"
  en: "Developer .NET and web"
  de: ".NET- und Webentwickler"
```

Technical terms such as `.NET`, `Angular`, `Vue.js`, `SQL Server`, `CI/CD`, `Clean Code` and `REST` may remain unchanged across languages.

## Review Status

Translations should be marked as reviewed before publication:

```yaml
translationStatus:
  fr: reviewed
  en: draft
  de: draft
```

The generator will later fail validation when required translations are missing or publication-ready output depends on unreviewed translations.

## Initial Sections

The first version keeps the data model deliberately small:

- `profile`: identity, role, location and summary.
- `contacts`: public contact links.
- `skills`: grouped technical skills.
- `experience`: professional experience entries.
- `education`: education entries.
- `projects`: portfolio project entries.

The model can grow when validation and generation needs become concrete.
