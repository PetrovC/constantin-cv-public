namespace CvGenerator.Domain;

public sealed record LocalizedText
{
    public string? Fr { get; init; }
    public string? En { get; init; }
    public string? De { get; init; }
}
