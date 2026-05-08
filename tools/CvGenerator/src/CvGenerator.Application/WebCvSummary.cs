namespace CvGenerator.Application;

public sealed record WebCvSummary
{
    public required string Short { get; init; }
    public required string Long { get; init; }
}
