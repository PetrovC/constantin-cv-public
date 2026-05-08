using System.Text.Json;
using CvGenerator.Application;
using CvGenerator.Infrastructure;
using Xunit;

namespace CvGenerator.Tests;

public sealed class PrintJsonGenerationTests
{
    [Fact]
    public async Task WriteAsync_WhenPrintGenerationSucceeds_ThenWritesOneJsonFilePerSupportedLanguage()
    {
        // T1 - Arrange
        await using var tempFolder = TemporaryFolder.Create();
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidMinimal());
        var result = new PrintJsonGenerationService().Generate(document);

        // T2 - Act
        var files = await new FilePrintJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);

        // T3 - Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, files.Count);
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "print", "cv.fr.print.json")));
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "print", "cv.en.print.json")));
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "print", "cv.de.print.json")));
    }

    [Fact]
    public async Task Generate_WhenProfileContainsPrivateContactData_ThenPrintJsonIncludesContact()
    {
        // T1 - Arrange
        await using var tempFolder = TemporaryFolder.Create();
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidFullSections());
        var result = new PrintJsonGenerationService().Generate(document);

        // T2 - Act
        await new FilePrintJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "fr");

        // T3 - Assert
        Assert.Equal("fr", ReadString(json, "language"));
        Assert.Equal("Constantin Petrov", ReadString(json, "profile", "fullName"));
        Assert.Contains(".NET et web", ReadString(json, "profile", "title"));
        Assert.Equal("private.contact@example.test", ReadString(json, "profile", "contact", "email"));
        Assert.Equal("PRIVATE_PHONE_PLACEHOLDER", ReadString(json, "profile", "contact", "phone"));
        Assert.Equal("PRIVATE_LOCATION_PLACEHOLDER", ReadString(json, "profile", "contact", "location"));
    }

    [Fact]
    public void Generate_WhenExperiencesHaveDifferentVisibility_ThenPrintVariantsUseExpectedFilters()
    {
        // T1 - Arrange
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

        // T2 - Act
        var result = new PrintJsonGenerationService().Generate(document with
        {
            Experiences = [.. document.Experiences, fullDevOnlyExperience, fullCompleteOnlyExperience]
        });
        var printDocument = result.Artifacts.Single(artifact => artifact.Language == "fr").Content;

        // T3 - Assert
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
        // T1 - Arrange
        var document = CvDocumentFactory.ValidMinimal();

        // T2 - Act
        var result = new PrintJsonGenerationService().Generate(document);

        // T3 - Assert
        Assert.False(result.IsSuccess);
        Assert.Empty(result.Artifacts);
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile.email");
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile.phone");
    }

    [Fact]
    public void Generate_WhenValidationFails_ThenReturnsValidationFailure()
    {
        // T1 - Arrange
        var invalidDocument = CvDocumentFactory.ValidMinimal() with
        {
            Profile = null
        };

        // T2 - Act
        var result = new PrintJsonGenerationService().Generate(invalidDocument);

        // T3 - Assert
        Assert.False(result.IsSuccess);
        Assert.Empty(result.Artifacts);
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile");
    }

    private static async Task<JsonDocument> ReadGeneratedJsonAsync(string outputRoot, string language)
    {
        var path = Path.Combine(outputRoot, "print", $"cv.{language}.print.json");
        await using var stream = File.OpenRead(path);
        return await JsonDocument.ParseAsync(stream);
    }

    private static string ReadString(JsonDocument document, params string[] path)
    {
        var current = document.RootElement;
        foreach (var segment in path)
        {
            current = int.TryParse(segment, out var index)
                ? current[index]
                : current.GetProperty(segment);
        }

        return current.GetString() ?? string.Empty;
    }

    private sealed class TemporaryFolder : IAsyncDisposable
    {
        private TemporaryFolder(string path)
        {
            Path = path;
        }

        public string Path { get; }

        public static TemporaryFolder Create()
        {
            var path = System.IO.Path.Combine(
                System.IO.Path.GetTempPath(),
                $"constantin-cv-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(path);
            return new TemporaryFolder(path);
        }

        public ValueTask DisposeAsync()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }

            return ValueTask.CompletedTask;
        }
    }
}
