# AGENTS.md

## Project goal

Build a multilingual CV and portfolio platform for Constantin Petrov.

The project contains:

- A modern public portfolio website
- Professional downloadable CV PDFs
- LinkedIn-ready generated content
- A single structured CV source of truth

The project must stay simple, maintainable and explicit.

The goal is not to build an over-engineered platform.
The goal is to build a clean, professional and evolutive system that can grow step by step.

---

## Technology choices

- Astro + Vue for the public website
- .NET for CV validation and artifact generation
- YAML as the single source of truth
- Playwright later for PDF generation from print pages
- GitHub Actions later for PR checks and GitHub Pages deployment

Do not introduce additional technologies, frameworks, databases, external services or infrastructure components unless explicitly requested.

---

## Monorepo structure

Expected structure:

```txt
constantin-cv/
├── data/
│   └── cv.yml
├── apps/
│   └── cv-web/
├── tools/
│   └── CvGenerator/
├── generated/
├── docs/
├── .github/
└── AGENTS.md
```

Important:

- Keep the structure simple.
- Do not create folders without an immediate purpose.
- Do not create speculative architecture for future features.
- Every folder and file must have a clear responsibility.
- Every created file must be used by the current implementation.

---

## Architecture principles

The architecture must serve the project, not the other way around.

The agent must respect the following principles:

- Keep `data/cv.yml` as the single source of truth.
- Do not manually edit generated artifacts.
- Keep the website and PDF layouts separate.
- The website must be a modern dynamic portfolio.
- The PDF must remain a professional CV format.
- Prefer simple, explicit and maintainable code.
- Avoid premature abstractions.
- Respect separation between domain, application, infrastructure and interfaces.
- Keep business rules out of UI components.
- Keep generated files out of Git unless explicitly decided later.
- Keep external dependencies controlled and justified.
- Prefer readability over cleverness.
- Prefer consistency over personal style.
- Prefer stable and boring solutions over fashionable complexity.

The agent must clearly separate:

- Domain rules
- Application logic
- Infrastructure concerns
- User interfaces
- Generated artifacts

---

## Agent behavior and engineering standards

The agent must behave like an experienced senior developer and software architect.

The agent must aim for:

- Maintainability
- Scalability when justified
- Testability
- Readability
- Simplicity
- Explicit design
- Long-term consistency

The agent must:

- Think before coding.
- Keep changes small and coherent.
- Respect the existing project structure.
- Use clear names for files, classes, methods, variables and tests.
- Prefer boring, predictable and robust solutions.
- Avoid unnecessary abstractions.
- Avoid unnecessary layers.
- Avoid unnecessary helper methods.
- Avoid unnecessary files.
- Avoid premature optimization.
- Avoid framework-specific logic in business rules.
- Avoid hiding important behavior behind magic conventions.
- Write code that a new developer can understand quickly.
- Favor explicit code over clever code.
- Favor stable architecture over fashionable architecture.
- Document important decisions when useful.
- Verify behavior, not only compilation.
- Review its own work before considering a task complete.

The agent must not:

- Create files that are not immediately useful.
- Create generic utilities without a concrete need.
- Add abstractions only because they might be useful later.
- Add a database for the first version.
- Add external services unless explicitly requested.
- Implement future roadmap features unless explicitly requested.
- Mix generated files with manually maintained source files.
- Manually edit generated files.
- Hide business logic inside Astro, Vue or UI components.
- Produce code that is difficult to test.
- Claim a feature is complete only because the project compiles.
- Leave missing dependencies unresolved.
- Leave partially configured projects.

The agent should act like a senior engineer reviewing his own work before opening a pull request.

---

## Clean Code rules

All code must follow Clean Code principles.

General rules:

- Use meaningful names.
- Keep methods small and focused.
- Keep classes cohesive.
- Keep responsibilities separated.
- Keep control flow simple.
- Prefer guard clauses when they improve readability.
- Avoid deeply nested logic.
- Avoid duplication.
- Do not abstract too early.
- Make dependencies explicit.
- Keep side effects visible and controlled.
- Prefer immutable data when it improves clarity.
- Prefer explicit error handling.
- Do not silently swallow exceptions.
- Do not add comments to explain bad code. Improve the code instead.
- Do not use abbreviations unless they are widely known.
- Do not use vague names such as `Helper`, `Manager`, `Processor`, `Data`, `Utils` unless there is a very clear reason.

Good naming examples:

```txt
CvSourceValidator
CvYamlLoader
MissingTranslationRule
GeneratedCvWriter
SupportedLanguage
ValidateCvCommand
```

Bad naming examples:

```txt
Utils
Helper
Common
Stuff
Processor
Manager
DoThings
HandleData
```

---

## File creation rules

Before creating a new file, the agent must verify that the file has a clear responsibility and immediate usefulness.

A new file is allowed when:

- It represents a real concept in the project.
- It improves readability.
- It improves separation of concerns.
- It avoids mixing unrelated responsibilities.
- It is used immediately by the implemented feature.

A new file is not allowed when:

- It contains speculative future code.
- It contains a generic abstraction without current usage.
- It contains a helper method used only once without improving clarity.
- It exists only to make the architecture look more complex.
- It duplicates an existing responsibility.
- It contains empty placeholder code.
- It contains unused methods.
- It contains unused types.
- It contains unused configuration.
- It contains fake completeness.

The agent must prefer fewer, well-named files over many vague files.

---

## Documentation rules

Documentation must improve understanding.

The agent must document:

- Public APIs
- Public classes
- Public methods
- Important business rules
- Non-obvious technical decisions
- Validation rules
- Generation rules
- Complex data structures
- Important configuration conventions

The agent must avoid:

- Comments that repeat the code.
- Useless comments on obvious private methods.
- Excessive documentation that makes the code harder to read.
- Outdated comments.
- TODO comments without a clear reason.

Documentation must explain why something exists when the reason is not obvious.

---

## Toolchain and version update rules

The agent must keep the project buildable and compatible with the required tooling.

If a package, framework or library requires a higher version of Node.js, npm, .NET, Astro, Vue, TypeScript or another project dependency, the agent is allowed to update the project configuration accordingly.

The agent may update:

- `package.json`
- `package-lock.json`
- `.csproj` files
- `global.json`
- `README.md`
- Tooling documentation
- Test project dependencies
- Build scripts
- Project-level configuration files

The agent must not leave the project in a partially upgraded state.

When updating versions, the agent must:

- Choose stable versions unless explicitly requested otherwise.
- Avoid preview versions unless the project already uses previews or explicitly requires them.
- Keep the update as small as possible.
- Update related files consistently.
- Document the required runtime versions when relevant.
- Verify that the project still builds.
- Verify that the relevant tests still run.
- Verify that the implemented feature still behaves correctly.

The agent must not:

- Ask for permission for normal project-level dependency updates required to complete the requested task.
- Ignore a missing dependency and produce a broken project.
- Create a test project without installing the required test framework packages.
- Upgrade unrelated dependencies without a clear reason.
- Change the architecture because of a dependency update.
- Add external services because of a dependency update.
- Install or require global machine-level tools unless necessary and documented.

If a required tool is missing from the environment, the agent must document what is required and update the project files when possible.

---

## Dependency rules

Dependencies must be minimal and justified.

The agent must:

- Prefer built-in platform features when sufficient.
- Avoid adding packages for trivial tasks.
- Avoid adding large dependencies for small needs.
- Explain why a dependency is needed when adding one.
- Keep dependencies compatible with the chosen technology stack.
- Avoid dependencies that require external services unless explicitly requested.
- Add required dependencies when a project cannot work correctly without them.
- Remove unused dependencies when they are discovered.

The agent must not:

- Add NuGet or npm packages that are not used.
- Add dependencies for speculative future features.
- Add dependencies only to avoid writing simple code.
- Leave broken or missing package references.
- Leave a test project without a working test framework.

---

## C# coding rules

For C# code:

- Enable nullable reference types where applicable.
- Prefer explicit models over dynamic objects.
- Prefer records for immutable data structures when appropriate.
- Prefer classes when behavior and lifecycle matter.
- Keep domain logic independent from infrastructure concerns.
- Do not leak CLI concerns into the domain layer.
- Do not leak file system concerns into the domain layer.
- Do not leak YAML concerns into the domain layer.
- Do not leak UI concerns into the domain layer.
- Use clear namespaces matching the folder structure.
- Use async APIs only when there is real asynchronous work.
- Use cancellation tokens when relevant for IO or long-running operations.
- Validate inputs at application boundaries.
- Prefer result objects for expected validation failures.
- Use exceptions for unexpected technical failures.
- Avoid static global state.
- Avoid service locator patterns.
- Avoid reflection unless explicitly justified.
- Avoid magic strings when constants or strong types improve clarity.

---

## C# XML documentation

The agent must use XML documentation comments for public C# APIs.

Required:

- Public classes must have XML documentation comments.
- Public records must have XML documentation comments.
- Public interfaces must have XML documentation comments.
- Public methods must have XML documentation comments.
- Public properties should have XML documentation comments when their meaning is not obvious.
- Important internal methods may have XML documentation comments when they express business rules or non-obvious behavior.

Not required:

- Obvious private methods.
- Simple private helpers.
- Self-explanatory private properties.
- Test methods when the test name already explains the behavior.

Example:

```csharp
/// <summary>
/// Validates the CV source and returns all detected validation errors.
/// </summary>
/// <param name="source">The structured CV source to validate.</param>
/// <param name="cancellationToken">Token used to cancel the validation operation.</param>
/// <returns>A validation result containing errors and warnings.</returns>
public Task<CvValidationResult> ValidateAsync(
    CvSource source,
    CancellationToken cancellationToken = default)
{
    // Implementation
}
```

Bad example:

```csharp
/// <summary>
/// Gets the name.
/// </summary>
public string Name { get; init; }
```

Do not write useless documentation.

---

## .NET project and NuGet rules

When creating a .NET project, the agent must ensure that the project contains all required dependencies.

For test projects, the agent must install and configure the appropriate test packages.

For xUnit test projects, the expected packages are:

```txt
Microsoft.NET.Test.Sdk
xunit
xunit.runner.visualstudio
FluentAssertions
```

The agent may add additional packages only when they are justified by the implemented feature.

Rules:

- A test project must actually be runnable with `dotnet test`.
- A test project must contain a valid test framework.
- Test files must be discovered by the test runner.
- Tests must fail when the tested behavior is broken.
- Tests must pass when the behavior is correct.
- The agent must not create empty test projects.
- The agent must not create fake tests that only verify trivial construction.
- The agent must not add NuGet packages that are not used.
- The agent must not leave unused package references.

When adding a test project, the agent must verify:

- The test project references the correct production project.
- The test framework is installed.
- At least one meaningful test is present when behavior has been implemented.
- `dotnet test` discovers and executes the tests.

---

## TypeScript, Astro and Vue coding rules

For TypeScript, Astro and Vue code:

- Use TypeScript types explicitly for exported functions.
- Use typed component props.
- Keep UI components focused on rendering and user interaction.
- Keep business validation rules outside components.
- Move reusable data transformation logic into dedicated modules.
- Prefer small, readable components.
- Avoid unnecessary global state.
- Avoid introducing state management libraries unless explicitly requested.
- Prefer accessible HTML.
- Prefer semantic markup.
- Use clear prop names.
- Avoid magic strings when constants improve clarity.
- Avoid overly generic components.
- Avoid mixing layout, business rules and data loading in the same file.

---

## TypeScript and JSDoc documentation

The agent must use JSDoc for exported TypeScript functions when their purpose is not immediately obvious.

Required:

- Exported functions with non-trivial behavior.
- Exported types with non-obvious meaning.
- Complex component props.
- Important localization helpers.
- Important formatting helpers.

Not required:

- Obvious local functions.
- Simple private constants.
- Simple components with self-explanatory props.

Example:

```ts
/**
 * Returns the localized label for a CV section.
 *
 * @param sectionKey - The section identifier used in the CV data source.
 * @param language - The target language.
 * @returns The localized section label.
 */
export function getSectionLabel(
  sectionKey: CvSectionKey,
  language: SupportedLanguage
): string {
  // Implementation
}
```

---

## Testing rules

Tests are part of the product and must be written with the same care as production code.

The agent must write tests for meaningful business logic.

Tests are required for:

- CV source validation
- Missing translation detection
- Required field detection
- Invalid date detection
- Invalid language detection
- YAML parsing behavior
- Generation logic
- Error handling for invalid input
- Any non-trivial transformation logic

Tests are not required for:

- Pure static markup with no behavior
- Trivial property assignment
- Generated files
- Visual styling only
- Framework boilerplate

---

## Test structure rules

Tests must follow the Arrange / Act / Assert structure.

Each test should clearly show:

- T1 - Arrange
- T2 - Act
- T3 - Assert

Example:

```csharp
[Fact]
public async Task ValidateAsync_WhenGermanTranslationIsMissing_ThenReturnsMissingTranslationError()
{
    // T1 - Arrange
    var source = CvSourceBuilder
        .Valid()
        .WithoutGermanTranslation("profile.summary")
        .Build();

    var validator = new CvSourceValidator();

    // T2 - Act
    var result = await validator.ValidateAsync(source);

    // T3 - Assert
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(error =>
        error.Code == "MissingTranslation" &&
        error.Path == "profile.summary.de");
}
```

Rules:

- Keep one main behavior per test.
- Avoid testing multiple unrelated behaviors in the same test.
- Avoid unnecessary mocking.
- Prefer testing behavior over implementation details.
- Prefer readable tests over clever test helpers.
- Use deterministic test data.
- Do not depend on real external services.
- Do not depend on the developer machine.
- Do not depend on current date/time unless controlled by an abstraction.
- Do not depend on file system paths unless using test-controlled temporary files.
- Avoid random values unless the seed is controlled.
- Avoid snapshot tests unless explicitly justified.

---

## Test naming convention

Use the following naming convention:

```txt
MethodName_WhenScenario_ThenExpectedResult
```

Examples:

```txt
ValidateAsync_WhenFrenchTitleIsMissing_ThenReturnsValidationError
ValidateAsync_WhenGermanTranslationIsMissing_ThenReturnsMissingTranslationError
GenerateAsync_WhenInputIsValid_ThenCreatesGeneratedFiles
LoadAsync_WhenYamlFileDoesNotExist_ThenReturnsFailure
Parse_WhenYamlContainsInvalidLanguage_ThenReturnsValidationError
```

For test classes:

```txt
ClassNameTests
```

Examples:

```txt
CvSourceValidatorTests
CvYamlLoaderTests
GeneratedCvWriterTests
SupportedLanguageValidatorTests
```

Avoid vague test names:

```txt
Test1
ShouldWork
ValidateTest
CheckData
TestValidation
```

---

## Test file organization

Test files must mirror the production code structure when possible.

Example:

```txt
tools/
└── CvGenerator/
    ├── src/
    │   └── CvGenerator.Application/
    │       └── Validation/
    │           └── CvSourceValidator.cs
    └── tests/
        └── CvGenerator.Application.Tests/
            └── Validation/
                └── CvSourceValidatorTests.cs
```

Rules:

- Test files must be named after the class under test.
- Do not create generic test files such as `Tests.cs`.
- Do not mix unrelated test subjects in the same file.
- Use test builders only when they improve readability.
- Do not create test builders for a single test.
- Do not hide important test setup behind unclear abstractions.

---

## Test assertions

Assertions must be readable and meaningful.

Prefer:

```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(error =>
    error.Code == "MissingTranslation" &&
    error.Path == "profile.summary.de");
```

Avoid:

```csharp
Assert.False(result.IsValid);
Assert.True(result.Errors.Count > 0);
```

The expected behavior should be clear from the assertion.

---

## Behavioral verification rules

Compiling is not enough.

The agent must verify that the implemented behavior is correct, not only that the code builds.

For every implemented feature, the agent must check:

- The code compiles.
- The project builds.
- The feature is wired correctly.
- The feature can actually be executed.
- The expected behavior is covered by tests when relevant.
- The tests are discovered by the test runner.
- The tests pass for the right reason.
- The implementation matches the requested behavior.
- Edge cases are handled when they are part of the feature.
- Invalid input is handled when relevant.
- The project does not contain unused or fake code.

Examples:

If the agent creates a validator:

- It must test valid input.
- It must test invalid input.
- It must verify that validation errors contain the expected code, message and path.

If the agent creates a YAML loader:

- It must test that a valid YAML file is loaded correctly.
- It must test that a missing file is handled correctly.
- It must test that invalid YAML is handled correctly.

If the agent creates a generator:

- It must test that expected files are generated.
- It must test that generated content is based on the source data.
- It must test failure cases when input is invalid.

If the agent creates a CLI command:

- It must verify that the command is registered.
- It must verify that arguments are parsed correctly.
- It must verify that success and failure paths return the expected exit behavior.

If the agent creates a website component:

- It must verify that the component receives the expected props.
- It must verify that required content is rendered.
- It must avoid hiding business rules inside the component.

The agent must not claim that a feature is complete only because the project compiles.

---

## CV source rules

French is the primary content language.

The CV source must support the following languages eventually:

- French
- English
- German

Rules:

- `data/cv.yml` is the source of truth.
- French content is required first.
- English and German translations must be reviewed before publication.
- All public content should support French, English and German eventually.
- Missing translations must be detected by validation.
- Invalid language codes must be detected by validation.
- Empty required fields must be detected by validation.
- Invalid dates must be detected by validation.
- Technical terms may remain unchanged when appropriate.

Technical terms that may remain unchanged:

- .NET
- Angular
- Vue.js
- Astro
- SQL Server
- PostgreSQL
- CI/CD
- Clean Code
- REST
- SOAP
- YAML
- GitHub Actions
- Playwright
- API
- DDD
- CQRS

---

## YAML rules

The YAML file must stay readable and structured.

Rules:

- Use clear section names.
- Avoid deeply nested structures unless justified.
- Keep language-specific content explicit.
- Avoid duplicated content where possible.
- Avoid mixing source content and generated content.
- Keep the YAML focused on CV and portfolio data.
- Do not store secrets in YAML.
- Do not store environment-specific configuration in YAML.
- Do not store generated HTML, PDF or LinkedIn content manually in YAML unless explicitly decided.

---

## CV validation rules

Validation must be deterministic and explicit.

Validation must detect:

- Missing required fields
- Missing translations
- Invalid language codes
- Invalid dates
- Empty public content
- Invalid URLs
- Invalid email format
- Invalid skill groups
- Invalid experience entries
- Invalid education entries
- Invalid project entries

Validation errors should include:

- A stable error code
- A readable message
- The path of the invalid field when possible
- The language concerned when relevant

Example error shape:

```txt
Code: MissingTranslation
Path: profile.summary.de
Message: German translation is missing for profile summary.
```

Validation logic must be testable without running the website.

---

## Generated artifacts

The following files are generated and must not be manually edited:

```txt
generated/web/*
generated/pdf/*
generated/linkedin/*
apps/cv-web/dist/*
```

Rules:

- Generated files must only be produced from `data/cv.yml`.
- Generated files must not be manually edited.
- Generated output must be reproducible.
- Generated output must be deterministic.
- Generation logic must be tested.
- Formatting differences should be minimized between runs.
- Generated files should stay out of Git unless explicitly decided later.

---

## Website rules

The website must be modern, readable and professional.

Rules:

- Use Astro for structure and static generation.
- Use Vue only where interactivity is useful.
- Keep pages fast and lightweight.
- Keep content accessible.
- Use semantic HTML.
- Support multilingual routing eventually.
- Keep UI components free from business validation logic.
- Keep localization explicit and testable.
- Avoid introducing heavy frontend dependencies without explicit approval.

The website and PDF layouts must stay separate.

The website can be more dynamic and visual.
The PDF must stay professional and CV-oriented.

---

## PDF rules

PDF generation must not be implemented in the first bootstrap task.

Later, PDF generation should:

- Use dedicated print pages.
- Use Playwright to generate PDFs.
- Keep PDF layout separate from website layout.
- Generate professional CV files.
- Support multiple languages.
- Support at least a concise CV and a full CV eventually.

Do not implement PDF generation until explicitly requested.

---

## LinkedIn content rules

LinkedIn-ready content should eventually be generated from the CV source.

Rules:

- Do not manually duplicate LinkedIn content.
- Generate LinkedIn content from structured data.
- Keep generated LinkedIn content separate from source data.
- Support French first.
- Support English and German later when translations are reviewed.

Do not implement LinkedIn generation until explicitly requested.

---

## Safety rules

The agent must follow these safety rules:

- Do not use real secrets.
- Do not add API keys.
- Do not add credentials.
- Do not add personal data that is not already provided in the CV source.
- Do not introduce external services unless explicitly requested.
- Do not add a database for the first version.
- Do not implement PDF generation in the first bootstrap task.
- Do not implement CI/CD in the first bootstrap task.
- Do not publish anything automatically.
- Do not generate files that are meant to be private unless explicitly requested.
- Do not run destructive commands unless explicitly requested.

---

## Git and generated files rules

The agent must not assume generated files should be committed.

Rules:

- Source files should be committed.
- Generated files should stay out of Git unless explicitly decided.
- Build output should stay out of Git.
- Temporary files should stay out of Git.
- Local environment files should stay out of Git.
- Secrets must never be committed.

Recommended ignored paths:

```txt
generated/
apps/cv-web/dist/
node_modules/
bin/
obj/
.env
.env.local
```

---

## Commands

Expected future commands:

```txt
dotnet test
dotnet build
dotnet run --project tools/CvGenerator/CvGenerator.Cli -- validate --input data/cv.yml
dotnet run --project tools/CvGenerator/CvGenerator.Cli -- generate --input data/cv.yml --output generated

npm install
npm run build --workspace apps/cv-web
```

The agent must keep commands simple and documented.

---

## First implementation priority

Start small.

The first bootstrap task must only:

1. Create the documentation files.
2. Create a minimal multilingual `data/cv.yml`.
3. Create the .NET solution structure.
4. Create the Astro + Vue app.
5. Keep the implementation minimal.
6. Keep the project buildable.
7. Avoid advanced features.
8. When creating test projects, install the required test framework packages.
9. Verify that tests are discovered and executed.
10. Verify implemented behavior, not only compilation.
11. Update project-level dependency versions when required by the chosen libraries.

The first bootstrap task must not:

- Implement PDF generation.
- Implement CI/CD.
- Add a database.
- Add external services.
- Add complex architecture.
- Add speculative abstractions.
- Add unused files.
- Add unused methods.
- Add unused dependencies.
- Create empty test projects.
- Create test projects without a working test framework.
- Claim a feature is complete without verifying its behavior.
- Leave missing dependencies unresolved.
- Ignore required runtime or tooling version updates.

---

## First version expected outcome

At the end of the first version, the project should have:

- A clear monorepo structure.
- A minimal CV source in YAML.
- A basic Astro + Vue website.
- A basic .NET solution structure.
- Initial validation foundations.
- Clear documentation.
- Working test project dependencies when tests are created.
- Tests discovered and executed when behavior is implemented.
- No generated PDF yet.
- No CI/CD yet.
- No database.
- No external service dependency.

The result must be simple, clean and ready to evolve.

---

## Senior developer checklist

Before finishing a task, the agent must verify:

- Does the code compile?
- Does the project build?
- Do the relevant tests run?
- Are the tests discovered by the test runner?
- Do the tests verify real behavior?
- Would at least one test fail if the implemented behavior was broken?
- Are the names clear?
- Are the responsibilities separated?
- Are there unnecessary files?
- Are there unused methods?
- Are there unused dependencies?
- Are public APIs documented?
- Are important rules tested?
- Do tests follow Arrange / Act / Assert?
- Do tests use the required naming convention?
- Is the implementation wired into the project correctly?
- Is the implementation actually used?
- Is the behavior aligned with the requested feature?
- Is the implementation simpler than the alternative?
- Is the solution understandable by a new developer?
- Did the agent avoid implementing future features too early?
- Did the agent avoid fake completeness?

If the answer is no, the agent must improve the solution before considering the task finished.

---

## Guiding principle

Build like a senior developer.

Keep it simple.
Keep it explicit.
Keep it maintainable.
Keep it testable.
Keep it professional.

Do not build Mordor.
Build the road to Minas Tirith first.
