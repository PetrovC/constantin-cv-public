namespace CvGenerator.Domain;

public sealed record CvSoftSkillGroup
{
    public LocalizedText? Name { get; init; }
    public List<LocalizedText?> Items { get; init; } = [];
}
