namespace CvGenerator.Domain;

public sealed record CvExperience
{
    public string? Id { get; init; }
    public string? Company { get; init; }
    public LocalizedText? Role { get; init; }
    public CvPeriod? Period { get; init; }
    public CvVisibility? Visibility { get; init; }
    public List<CvMission> Missions { get; init; } = [];
}
