namespace CvGenerator.Application;

public sealed record WebCvProfile
{
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string FullName { get; init; }
    public required string Title { get; init; }
    public required string Subtitle { get; init; }
    public required string Location { get; init; }
    public required WebCvLinkCollection Links { get; init; }
}
