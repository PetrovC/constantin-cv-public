namespace CvGenerator.Application;

public sealed record WebCvMission
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Title { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<string> Bullets { get; init; } = [];
}
