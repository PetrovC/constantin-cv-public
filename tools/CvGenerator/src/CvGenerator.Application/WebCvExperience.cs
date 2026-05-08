namespace CvGenerator.Application;

public sealed record WebCvExperience
{
    public required string Id { get; init; }
    public required string Company { get; init; }
    public required string Role { get; init; }
    public required WebCvPeriod Period { get; init; }
    public required WebCvVisibility Visibility { get; init; }
    public IReadOnlyList<WebCvMission> Missions { get; init; } = [];
}
