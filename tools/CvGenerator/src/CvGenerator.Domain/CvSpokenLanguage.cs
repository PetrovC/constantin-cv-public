namespace CvGenerator.Domain;

public sealed record CvSpokenLanguage
{
    public LocalizedText? Name { get; init; }
    public LocalizedText? Level { get; init; }
    public int? Order { get; init; }
}
