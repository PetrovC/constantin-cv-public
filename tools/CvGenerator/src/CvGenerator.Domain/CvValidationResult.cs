namespace CvGenerator.Domain;

public sealed record CvValidationResult(IReadOnlyList<CvValidationError> Errors)
{
    public bool IsValid => Errors.Count == 0;

    public static CvValidationResult Success()
        => new([]);

    public static CvValidationResult Failure(IEnumerable<CvValidationError> errors)
        => new(errors.ToArray());
}
