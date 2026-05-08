namespace CvGenerator.Application;

public sealed record WebCvContinuousLearning
{
    public required string Title { get; init; }
    public IReadOnlyList<string> Items { get; init; } = [];
}
