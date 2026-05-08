namespace CvGenerator.Domain;

public sealed record CvLinkCollection
{
    public string? Linkedin { get; init; }
    public string? Github { get; init; }
    public string? Website { get; init; }
}
