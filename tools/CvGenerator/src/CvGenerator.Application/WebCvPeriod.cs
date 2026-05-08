namespace CvGenerator.Application;

public sealed record WebCvPeriod
{
    public required string From { get; init; }
    public required string To { get; init; }
}
