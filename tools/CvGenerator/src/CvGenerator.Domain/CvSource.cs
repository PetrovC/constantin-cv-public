namespace CvGenerator.Domain;

public sealed record CvSource(string Path, string Content)
{
    public bool HasContent => !string.IsNullOrWhiteSpace(Content);
}
