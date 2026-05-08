namespace CvGenerator.Application;

public sealed record WebCvEducation
{
    public required string Institution { get; init; }
    public required string Degree { get; init; }
    public required WebCvPeriod Period { get; init; }
    public string? Description { get; init; }
}
