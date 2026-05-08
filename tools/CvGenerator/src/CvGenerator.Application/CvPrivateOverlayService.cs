using System.Net.Mail;
using CvGenerator.Domain;

namespace CvGenerator.Application;

/// <summary>
/// Validates and applies private overlay data for local print generation.
/// </summary>
public sealed class CvPrivateOverlayService
{
    /// <summary>
    /// Validates that the private overlay contains the contact fields required for print output.
    /// </summary>
    /// <param name="overlay">The private overlay loaded from the ignored local YAML file.</param>
    /// <returns>A validation result containing all detected overlay errors.</returns>
    public CvValidationResult Validate(CvPrivateOverlay overlay)
    {
        var errors = new List<CvValidationError>();

        if (overlay.Profile is null)
        {
            errors.Add(new CvValidationError("profile", "Private profile contact details are required."));
            return CvValidationResult.Failure(errors);
        }

        RequireValue(overlay.Profile.Email, "profile.email", "Private email is required.", errors);
        RequireValue(overlay.Profile.Phone, "profile.phone", "Private telephone is required.", errors);
        RequireValue(overlay.Profile.Location, "profile.location", "Private location is required.", errors);

        var email = overlay.Profile.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email) && !LooksLikeEmail(email))
        {
            errors.Add(new CvValidationError("profile.email", "Private email must look like a valid email address."));
        }

        return errors.Count == 0
            ? CvValidationResult.Success()
            : CvValidationResult.Failure(errors);
    }

    /// <summary>
    /// Applies private contact data to a public CV document before print JSON generation.
    /// </summary>
    /// <param name="document">The public CV document.</param>
    /// <param name="overlay">The validated private overlay.</param>
    /// <returns>A CV document containing private print contact fields.</returns>
    public CvDocument Apply(CvDocument document, CvPrivateOverlay overlay)
        => document with
        {
            Profile = document.Profile is null
                ? null
                : document.Profile with
                {
                    Email = overlay.Profile?.Email?.Trim(),
                    Phone = overlay.Profile?.Phone?.Trim(),
                    Location = overlay.Profile?.Location?.Trim()
                }
        };

    private static void RequireValue(
        string? value,
        string path,
        string message,
        List<CvValidationError> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add(new CvValidationError(path, message));
        }
    }

    private static bool LooksLikeEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            return string.Equals(address.Address, email.Trim(), StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
