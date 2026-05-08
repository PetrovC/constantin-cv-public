namespace CvGenerator.Domain;

public sealed record CvVisibility
{
    public bool? Website { get; init; }
    public bool? ShortCv { get; init; }
    public bool? FullDevCv { get; init; }
    public bool? FullCompleteCv { get; init; }
    public bool? Linkedin { get; init; }
}
