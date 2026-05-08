namespace CvGenerator.Application;

public sealed record WebCvLinkCollection
{
    public required string Linkedin { get; init; }
    public required string Github { get; init; }
    public required string Website { get; init; }
}
