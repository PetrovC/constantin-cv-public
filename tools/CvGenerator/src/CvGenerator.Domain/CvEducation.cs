namespace CvGenerator.Domain;

public sealed record CvEducation
{
    public string? Institution { get; init; }
    public LocalizedText? Degree { get; init; }
    public CvPeriod? Period { get; init; }
    public LocalizedText? Description { get; init; }
}
