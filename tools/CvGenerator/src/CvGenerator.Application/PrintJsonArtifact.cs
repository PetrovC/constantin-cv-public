namespace CvGenerator.Application;

/// <summary>
/// A localized print JSON artifact to write under generated/print.
/// </summary>
public sealed record PrintJsonArtifact(string Language, string FileName, PrintCvDocument Content);
