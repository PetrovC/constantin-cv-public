namespace CvGenerator.Application;

public sealed record WebCvDocument
{
    public required string Language { get; init; }
    public required WebCvProfile Profile { get; init; }
    public required WebCvSummary Summary { get; init; }
    public IReadOnlyList<WebCvSkillGroup> Skills { get; init; } = [];
    public IReadOnlyList<WebCvSoftSkillGroup> SoftSkills { get; init; } = [];
    public IReadOnlyList<WebCvSpokenLanguage> SpokenLanguages { get; init; } = [];
    public IReadOnlyList<WebCvEducation> Education { get; init; } = [];
    public WebCvContinuousLearning? ContinuousLearning { get; init; }
    public IReadOnlyList<WebCvExperience> Experiences { get; init; } = [];
}
