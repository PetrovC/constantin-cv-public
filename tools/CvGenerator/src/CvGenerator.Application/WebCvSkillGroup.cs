namespace CvGenerator.Application;

public sealed record WebCvSkillGroup
{
    public required string Name { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}
