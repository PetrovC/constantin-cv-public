namespace CvGenerator.Domain;

/// <summary>
/// Private CV data that is merged only for local print and PDF generation.
/// </summary>
public sealed record CvPrivateOverlay
{
    /// <summary>
    /// Private profile contact details excluded from the public CV source.
    /// </summary>
    public CvPrivateProfile? Profile { get; init; }
}

/// <summary>
/// Private contact details used by generated print artifacts.
/// </summary>
public sealed record CvPrivateProfile
{
    /// <summary>
    /// Private contact email for print documents.
    /// </summary>
    public string? Email { get; init; }

    /// <summary>
    /// Private telephone value for print documents.
    /// </summary>
    public string? Phone { get; init; }

    /// <summary>
    /// Private contact location for print documents.
    /// </summary>
    public string? Location { get; init; }
}
