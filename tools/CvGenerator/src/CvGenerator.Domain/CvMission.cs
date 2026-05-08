namespace CvGenerator.Domain;

public sealed record CvMission
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public LocalizedText? Title { get; init; }
    public List<string> Tags { get; init; } = [];
    public List<LocalizedText?> Bullets { get; init; } = [];
}
