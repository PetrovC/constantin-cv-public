using CvGenerator.Domain;

namespace CvGenerator.Application;

/// <summary>
/// Result returned by print JSON generation.
/// </summary>
public sealed record PrintJsonGenerationResult(
    CvValidationResult ValidationResult,
    IReadOnlyList<PrintJsonArtifact> Artifacts)
{
    public bool IsSuccess => ValidationResult.IsValid;

    public static PrintJsonGenerationResult Success(IReadOnlyList<PrintJsonArtifact> artifacts)
        => new(CvValidationResult.Success(), artifacts);

    public static PrintJsonGenerationResult Failure(CvValidationResult validationResult)
        => new(validationResult, []);
}
