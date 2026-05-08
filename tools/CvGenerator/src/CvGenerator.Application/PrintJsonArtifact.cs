namespace CvGenerator.Application;

/// <summary>
/// A localized print JSON artifact to write under the print artifact directory.
/// </summary>
public sealed record PrintJsonArtifact(string Language, string FileName, PrintCvDocument Content);
