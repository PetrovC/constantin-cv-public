namespace CvGenerator.Application;

public sealed record WebCvSpokenLanguage
{
    public required string Name { get; init; }
    public required string Level { get; init; }
    public int? Order { get; init; }
}
