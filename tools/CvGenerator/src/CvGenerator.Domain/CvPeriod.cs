namespace CvGenerator.Domain;

public sealed record CvPeriod
{
    public string? From { get; init; }
    public string? To { get; init; }
}
