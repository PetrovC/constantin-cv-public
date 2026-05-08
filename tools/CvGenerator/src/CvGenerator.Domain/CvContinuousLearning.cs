namespace CvGenerator.Domain;

public sealed record CvContinuousLearning
{
    public LocalizedText? Title { get; init; }
    public List<LocalizedText?> Items { get; init; } = [];
}
