using CvGenerator.Application;
using Xunit;

namespace CvGenerator.Tests;

public sealed class CvPrivateOverlayServiceTests
{
    private readonly CvPrivateOverlayService service = new();

    [Fact]
    public void Validate_WhenPrivateOverlayContainsContact_ThenReturnsSuccess()
    {
        // T1 - Arrange
        var overlay = CvDocumentFactory.PrivateOverlay();

        // T2 - Act
        var result = service.Validate(overlay);

        // T3 - Assert
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Validate_WhenPrivateOverlayIsMissingTelephone_ThenReturnsValidationError()
    {
        // T1 - Arrange
        var overlay = CvDocumentFactory.PrivateOverlay() with
        {
            Profile = CvDocumentFactory.PrivateOverlay().Profile! with
            {
                Phone = string.Empty
            }
        };

        // T2 - Act
        var result = service.Validate(overlay);

        // T3 - Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "profile.phone");
    }

    [Fact]
    public void Apply_WhenPrivateOverlayContainsContact_ThenReturnsDocumentWithPrivateContact()
    {
        // T1 - Arrange
        var document = CvDocumentFactory.ValidMinimal();
        var overlay = CvDocumentFactory.PrivateOverlay();

        // T2 - Act
        var result = service.Apply(document, overlay);

        // T3 - Assert
        Assert.Equal("private.contact@example.test", result.Profile!.Email);
        Assert.Equal("PRIVATE_PHONE_PLACEHOLDER", result.Profile.Phone);
        Assert.Equal("PRIVATE_LOCATION_PLACEHOLDER", result.Profile.Location);
    }
}
