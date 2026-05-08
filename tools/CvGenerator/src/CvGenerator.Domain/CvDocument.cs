namespace CvGenerator.Domain;

public sealed record CvDocument
{
    public int? SchemaVersion { get; init; }
    public CvLanguages? Languages { get; init; }
    public CvProfile? Profile { get; init; }
    public CvSummary? Summary { get; init; }
    public List<CvSkillGroup?> Skills { get; init; } = [];
    public List<CvSoftSkillGroup?> SoftSkills { get; init; } = [];
    public List<CvSpokenLanguage?> SpokenLanguages { get; init; } = [];
    public List<CvEducation?> Education { get; init; } = [];
    public CvContinuousLearning? ContinuousLearning { get; init; }
    public List<CvExperience> Experiences { get; init; } = [];
}
