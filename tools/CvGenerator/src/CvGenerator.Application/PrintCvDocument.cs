namespace CvGenerator.Application;

/// <summary>
/// Localized CV data prepared for private print and PDF rendering.
/// </summary>
public sealed record PrintCvDocument
{
    public required string Language { get; init; }
    public required PrintCvProfile Profile { get; init; }
    public required PrintCvSummary Summary { get; init; }
    public IReadOnlyList<PrintCvSkillGroup> Skills { get; init; } = [];
    public IReadOnlyList<PrintCvSoftSkillGroup> SoftSkills { get; init; } = [];
    public IReadOnlyList<PrintCvSpokenLanguage> SpokenLanguages { get; init; } = [];
    public IReadOnlyList<PrintCvEducation> Education { get; init; } = [];
    public PrintCvContinuousLearning? ContinuousLearning { get; init; }
    public required PrintCvVariant OnePage { get; init; }
    public required PrintCvVariant FullDev { get; init; }
}

/// <summary>
/// Localized profile and private contact information for print documents.
/// </summary>
public sealed record PrintCvProfile
{
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string FullName { get; init; }
    public required string Title { get; init; }
    public required string Subtitle { get; init; }
    public required PrintCvContact Contact { get; init; }
    public required PrintCvLinkCollection Links { get; init; }
}

/// <summary>
/// Contact details allowed only in dedicated print and PDF data.
/// </summary>
public sealed record PrintCvContact
{
    public required string Email { get; init; }
    public required string Phone { get; init; }
    public required string Location { get; init; }
}

/// <summary>
/// Public links that may be displayed in print documents.
/// </summary>
public sealed record PrintCvLinkCollection
{
    public string Linkedin { get; init; } = string.Empty;
    public string Github { get; init; } = string.Empty;
    public string Website { get; init; } = string.Empty;
}

/// <summary>
/// Localized profile summaries for print documents.
/// </summary>
public sealed record PrintCvSummary
{
    public required string Short { get; init; }
    public required string Long { get; init; }
}

/// <summary>
/// Localized technical skill group for print documents.
/// </summary>
public sealed record PrintCvSkillGroup
{
    public required string Name { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}

/// <summary>
/// Localized soft skill group for print documents.
/// </summary>
public sealed record PrintCvSoftSkillGroup
{
    public required string Name { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}

/// <summary>
/// Localized spoken language entry for print documents.
/// </summary>
public sealed record PrintCvSpokenLanguage
{
    public required string Name { get; init; }
    public required string Level { get; init; }
    public int? Order { get; init; }
}

/// <summary>
/// Localized education entry for print documents.
/// </summary>
public sealed record PrintCvEducation
{
    public required string Institution { get; init; }
    public required string Degree { get; init; }
    public required PrintCvPeriod Period { get; init; }
    public string? Description { get; init; }
}

/// <summary>
/// Localized continuous learning section for print documents.
/// </summary>
public sealed record PrintCvContinuousLearning
{
    public required string Title { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}

/// <summary>
/// A filtered print CV variant such as one-page CV or full developer CV.
/// </summary>
public sealed record PrintCvVariant
{
    public IReadOnlyList<PrintCvExperience> Experiences { get; init; } = [];
}

/// <summary>
/// Localized experience entry for print documents.
/// </summary>
public sealed record PrintCvExperience
{
    public required string Id { get; init; }
    public required string Company { get; init; }
    public required string Role { get; init; }
    public required PrintCvPeriod Period { get; init; }
    public required PrintCvVisibility Visibility { get; init; }
    public IReadOnlyList<PrintCvMission> Missions { get; init; } = [];
}

/// <summary>
/// Localized mission entry for print documents.
/// </summary>
public sealed record PrintCvMission
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Title { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<string> Bullets { get; init; } = [];
}

/// <summary>
/// Period displayed in print documents.
/// </summary>
public sealed record PrintCvPeriod
{
    public required string From { get; init; }
    public required string To { get; init; }
}

/// <summary>
/// Visibility flags copied from the source to make print filtering auditable.
/// </summary>
public sealed record PrintCvVisibility
{
    public bool Website { get; init; }
    public bool ShortCv { get; init; }
    public bool FullDevCv { get; init; }
    public bool FullCompleteCv { get; init; }
    public bool Linkedin { get; init; }
}
