namespace CvGenerator.Domain;

public sealed record CvSkillGroup
{
    public LocalizedText? Name { get; init; }
    public List<string> Items { get; init; } = [];
}
