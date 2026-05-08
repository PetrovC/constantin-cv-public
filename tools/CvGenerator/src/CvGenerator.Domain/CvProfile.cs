namespace CvGenerator.Domain;

public sealed record CvProfile
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public LocalizedText? Title { get; init; }
    public LocalizedText? Subtitle { get; init; }
    public string? Location { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public CvLinkCollection? Links { get; init; }
}
