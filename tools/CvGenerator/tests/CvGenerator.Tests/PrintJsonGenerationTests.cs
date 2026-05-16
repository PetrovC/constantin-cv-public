using CvGenerator.Application;
using Xunit;

namespace CvGenerator.Tests;

public sealed class PrintJsonGenerationTests
{
    [Fact]
    public void Generate_WhenPrintGenerationSucceeds_ThenProducesOneArtifactPerSupportedLanguage()
    {
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidMinimal());

        var result = new PrintJsonGenerationService().Generate(document);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Artifacts.Count);
        Assert.Contains(result.Artifacts, artifact => artifact.Language == "fr");
        Assert.Contains(result.Artifacts, artifact => artifact.Language == "en");
        Assert.Contains(result.Artifacts, artifact => artifact.Language == "de");
    }

    [Fact]
    public void Generate_WhenProfileContainsPrivateContactData_ThenArtifactIncludesContact()
    {
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidFullSections());

        var result = new PrintJsonGenerationService().Generate(document);
        var french = result.Artifacts.Single(artifact => artifact.Language == "fr").Content;

        Assert.Equal("fr", french.Language);
        Assert.Equal("Constantin Petrov", french.Profile.FullName);
        Assert.Contains(".NET et web", french.Profile.Title);
        Assert.Equal("private.contact@example.test", french.Profile.Contact.Email);
        Assert.Equal("PRIVATE_PHONE_PLACEHOLDER", french.Profile.Contact.Phone);
        Assert.Equal("PRIVATE_LOCATION_PLACEHOLDER", french.Profile.Contact.Location);
    }

    [Fact]
    public void Generate_WhenExperiencesHaveDifferentVisibility_ThenPrintVariantsUseExpectedFilters()
    {
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidMinimal());
        var fullDevOnlyExperience = document.Experiences[0] with
        {
            Id = "full-dev-only",
            Company = "Full Dev Company",
            Visibility = CvDocumentFactory.Visibility() with
            {
                ShortCv = false,
                FullDevCv = true,
                FullCompleteCv = true
            }
        };
        var fullCompleteOnlyExperience = document.Experiences[0] with
        {
            Id = "full-complete-only",
            Company = "Full Complete Company",
            Visibility = CvDocumentFactory.Visibility() with
            {
                ShortCv = false,
                FullDevCv = false,
                FullCompleteCv = true
            }
        };

        var result = new PrintJsonGenerationService().Generate(document with
        {
            Experiences = [.. document.Experiences, fullDevOnlyExperience, fullCompleteOnlyExperience]
        });
        var printDocument = result.Artifacts.Single(artifact => artifact.Language == "fr").Content;

        Assert.True(result.IsSuccess);
        Assert.Contains(printDocument.OnePage.Experiences, experience => experience.Id == "experience-1");
        Assert.DoesNotContain(printDocument.OnePage.Experiences, experience => experience.Id == "full-dev-only");
        Assert.DoesNotContain(printDocument.OnePage.Experiences, experience => experience.Id == "full-complete-only");
        Assert.Contains(printDocument.FullDev.Experiences, experience => experience.Id == "experience-1");
        Assert.Contains(printDocument.FullDev.Experiences, experience => experience.Id == "full-dev-only");
        Assert.DoesNotContain(printDocument.FullDev.Experiences, experience => experience.Id == "full-complete-only");
    }

    [Fact]
    public void Generate_WhenPrivateContactIsMissing_ThenReturnsValidationFailure()
    {
        var document = CvDocumentFactory.ValidMinimal();

        var result = new PrintJsonGenerationService().Generate(document);

        Assert.False(result.IsSuccess);
        Assert.Empty(result.Artifacts);
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile.email");
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile.phone");
    }

    [Fact]
    public void Generate_WhenValidationFails_ThenReturnsValidationFailure()
    {
        var invalidDocument = CvDocumentFactory.ValidMinimal() with
        {
            Profile = null
        };

        var result = new PrintJsonGenerationService().Generate(invalidDocument);

        Assert.False(result.IsSuccess);
        Assert.Empty(result.Artifacts);
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile");
    }
}
