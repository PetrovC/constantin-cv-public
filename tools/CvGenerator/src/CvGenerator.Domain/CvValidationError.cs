namespace CvGenerator.Domain;

public sealed record CvValidationError(string Path, string Message)
{
    public override string ToString()
        => $"{Path}: {Message}";
}
