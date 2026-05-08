namespace CvGenerator.Domain;

public sealed record CvLanguages
{
    public string? Primary { get; init; }
    public List<string> Supported { get; init; } = [];
}
