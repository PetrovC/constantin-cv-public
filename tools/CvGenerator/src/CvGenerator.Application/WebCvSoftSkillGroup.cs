namespace CvGenerator.Application;

public sealed record WebCvSoftSkillGroup
{
    public required string Name { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}
