namespace CvGenerator.Application;

public sealed record WebCvVisibility
{
    public required bool Website { get; init; }
    public required bool ShortCv { get; init; }
    public required bool FullDevCv { get; init; }
    public required bool FullCompleteCv { get; init; }
    public required bool Linkedin { get; init; }
}
