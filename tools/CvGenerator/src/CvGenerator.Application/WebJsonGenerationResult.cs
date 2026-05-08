using CvGenerator.Domain;

namespace CvGenerator.Application;

public sealed record WebJsonGenerationResult(
    CvValidationResult ValidationResult,
    IReadOnlyList<WebJsonArtifact> Artifacts)
{
    public bool IsSuccess => ValidationResult.IsValid;

    public static WebJsonGenerationResult Success(IReadOnlyList<WebJsonArtifact> artifacts)
        => new(CvValidationResult.Success(), artifacts);

    public static WebJsonGenerationResult Failure(CvValidationResult validationResult)
        => new(validationResult, []);
}
