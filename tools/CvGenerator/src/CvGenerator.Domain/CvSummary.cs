namespace CvGenerator.Domain;

public sealed record CvSummary
{
    public LocalizedText? Short { get; init; }
    public LocalizedText? Long { get; init; }
}
