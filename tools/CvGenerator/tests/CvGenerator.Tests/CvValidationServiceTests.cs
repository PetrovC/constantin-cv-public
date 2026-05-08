using CvGenerator.Application;
using CvGenerator.Domain;
using Xunit;

namespace CvGenerator.Tests;

public sealed class CvValidationServiceTests
{
    private readonly CvValidationService service = new();

    [Fact]
    public void ValidMinimalCvPasses()
    {
        var result = service.Validate(CvDocumentFactory.ValidMinimal());

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidDocumentWithFullSectionsPasses()
    {
        var result = service.Validate(CvDocumentFactory.ValidFullSections());

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void MissingProfileFails()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Profile = null
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "profile");
    }

    [Fact]
    public void Validate_WhenOptionalProfileEmailIsInvalid_ThenReturnsValidationError()
    {
        // T1 - Arrange
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Profile = CvDocumentFactory.ValidMinimal().Profile! with
            {
                Email = "invalid-email"
            }
        };

        // T2 - Act
        var result = service.Validate(document);

        // T3 - Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "profile.email");
    }

    [Fact]
    public void MissingTranslationFailsWithLanguagePath()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Summary = new CvSummary
            {
                Short = new LocalizedText
                {
                    Fr = "Résumé court",
                    En = "Short summary"
                },
                Long = CvDocumentFactory.Text("Résumé long")
            }
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "summary.short.de");
    }

    [Fact]
    public void DuplicateExperienceIdsFail()
    {
        var experience = CvDocumentFactory.ValidMinimal().Experiences[0];
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Experiences =
            [
                experience,
                experience with { Company = "Another Company" }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "experiences[1].id");
    }

    [Fact]
    public void MissingMissionBulletsFail()
    {
        var experience = CvDocumentFactory.ValidMinimal().Experiences[0];
        var mission = experience.Missions[0] with
        {
            Bullets = []
        };
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Experiences =
            [
                experience with
                {
                    Missions = [mission]
                }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "experiences[0].missions[0].bullets");
    }

    [Fact]
    public void MissingSkillGroupNameFails()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Skills =
            [
                new CvSkillGroup
                {
                    Items = [".NET"]
                }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "skills[0].name");
    }

    [Fact]
    public void EmptySkillGroupItemsFail()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Skills =
            [
                new CvSkillGroup
                {
                    Name = CvDocumentFactory.Text("Backend"),
                    Items = []
                }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "skills[0].items");
    }

    [Fact]
    public void MissingSpokenLanguageLevelTranslationFails()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            SpokenLanguages =
            [
                new CvSpokenLanguage
                {
                    Name = CvDocumentFactory.Text("Français", "French", "Französisch"),
                    Level = new LocalizedText
                    {
                        Fr = "Courant",
                        De = "Fließend"
                    }
                }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "spokenLanguages[0].level.en");
    }

    [Fact]
    public void MissingEducationPeriodFails()
    {
        var document = CvDocumentFactory.ValidMinimal() with
        {
            Education =
            [
                new CvEducation
                {
                    Institution = "Haute école exemple",
                    Degree = CvDocumentFactory.Text("Bachelier")
                }
            ]
        };

        var result = service.Validate(document);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.Path == "education[0].period");
    }
}
