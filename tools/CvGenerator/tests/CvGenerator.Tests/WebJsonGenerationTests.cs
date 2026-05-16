using System.Text.Json;
using CvGenerator.Application;
using CvGenerator.Infrastructure;
using Xunit;

namespace CvGenerator.Tests;

public sealed class WebJsonGenerationTests
{
    [Fact]
    public async Task SuccessfulGenerationWritesOneJsonFilePerSupportedLanguage()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidMinimal());

        var files = await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, files.Count);
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "web", "cv.fr.generated.json")));
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "web", "cv.en.generated.json")));
        Assert.True(File.Exists(Path.Combine(tempFolder.Path, "web", "cv.de.generated.json")));
    }

    [Fact]
    public async Task GeneratedFrenchJsonContainsFrenchText()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidMinimal());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "fr");

        Assert.Equal("fr", ReadString(json, "language"));
        Assert.Equal("Développeur .NET et web", ReadString(json, "profile", "title"));
        Assert.Equal("Résumé court", ReadString(json, "summary", "short"));
        Assert.Equal("Développeur logiciel", ReadString(json, "experiences", "0", "role"));
        Assert.Equal("Développement plateforme", ReadString(json, "experiences", "0", "missions", "0", "title"));
        Assert.Equal(
            "Livraison d'applications web maintenables",
            ReadString(json, "experiences", "0", "missions", "0", "bullets", "0"));
    }

    [Fact]
    public async Task GeneratedFrenchJsonContainsLocalizedSkillsAndEducation()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidFullSections());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "fr");

        Assert.Equal("Développement backend", ReadString(json, "skills", "0", "name"));
        Assert.Equal(".NET", ReadString(json, "skills", "0", "items", "0"));
        Assert.Equal("Haute école exemple", ReadString(json, "education", "0", "institution"));
        Assert.Equal(
            "Bachelier en informatique de gestion",
            ReadString(json, "education", "0", "degree"));
        Assert.Equal(
            "Formation axée sur les applications métier",
            ReadString(json, "education", "0", "description"));
    }

    [Fact]
    public async Task Generate_WhenPublicCvHasNoPrivateContactData_ThenPublicJsonOmitsContactFields()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidMinimal());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "fr");

        var profile = json.RootElement.GetProperty("profile");
        var rawJson = await File.ReadAllTextAsync(Path.Combine(tempFolder.Path, "web", "cv.fr.generated.json"));

        Assert.False(profile.TryGetProperty("email", out _));
        Assert.False(profile.TryGetProperty("phone", out _));
        Assert.False(profile.TryGetProperty("contactHref", out _));
        Assert.DoesNotContain("private.contact@example.test", rawJson);
    }

    [Fact]
    public async Task Generate_WhenProducingPublicJson_ThenVisibilityFlagsAreNotExposed()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidMinimal());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        var rawJson = await File.ReadAllTextAsync(
            Path.Combine(tempFolder.Path, "web", "cv.fr.generated.json"));

        Assert.DoesNotContain("visibility", rawJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Generate_WhenExperienceIsHiddenFromWebsite_ThenPublicJsonOmitsExperience()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var document = CvDocumentFactory.ValidMinimal();
        var hiddenExperience = document.Experiences[0] with
        {
            Id = "hidden-experience",
            Company = "Hidden Company",
            Visibility = CvDocumentFactory.Visibility() with
            {
                Website = false,
                ShortCv = false,
                FullCompleteCv = true
            }
        };

        var result = new WebJsonGenerationService().Generate(document with
        {
            Experiences = [.. document.Experiences, hiddenExperience]
        });

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "fr");

        var experiences = json.RootElement.GetProperty("experiences");

        Assert.Equal(1, experiences.GetArrayLength());
        Assert.Equal("Example Company", ReadString(json, "experiences", "0", "company"));
    }

    [Fact]
    public async Task GeneratedEnglishJsonContainsEnglishText()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidMinimal());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "en");

        Assert.Equal("en", ReadString(json, "language"));
        Assert.Equal(".NET and web developer", ReadString(json, "profile", "title"));
        Assert.Equal("Short summary", ReadString(json, "summary", "short"));
        Assert.Equal("Software developer", ReadString(json, "experiences", "0", "role"));
        Assert.Equal("Platform development", ReadString(json, "experiences", "0", "missions", "0", "title"));
        Assert.Equal(
            "Delivered maintainable web applications",
            ReadString(json, "experiences", "0", "missions", "0", "bullets", "0"));
    }

    [Fact]
    public async Task GeneratedEnglishJsonContainsLocalizedSoftSkillsAndLanguages()
    {
        await using var tempFolder = TemporaryFolder.Create();
        var result = new WebJsonGenerationService().Generate(CvDocumentFactory.ValidFullSections());

        await new FileWebJsonArtifactWriter().WriteAsync(tempFolder.Path, result.Artifacts);
        using var json = await ReadGeneratedJsonAsync(tempFolder.Path, "en");

        Assert.Equal("Collaboration", ReadString(json, "softSkills", "0", "name"));
        Assert.Equal("Clear communication", ReadString(json, "softSkills", "0", "items", "0"));
        Assert.Equal("French", ReadString(json, "spokenLanguages", "0", "name"));
        Assert.Equal("Fluent", ReadString(json, "spokenLanguages", "0", "level"));
    }

    [Fact]
    public void GenerationFailsWhenValidationFails()
    {
        var invalidDocument = CvDocumentFactory.ValidMinimal() with
        {
            Profile = null
        };

        var result = new WebJsonGenerationService().Generate(invalidDocument);

        Assert.False(result.IsSuccess);
        Assert.Empty(result.Artifacts);
        Assert.Contains(result.ValidationResult.Errors, error => error.Path == "profile");
    }

    private static async Task<JsonDocument> ReadGeneratedJsonAsync(string outputRoot, string language)
    {
        var path = Path.Combine(outputRoot, "web", $"cv.{language}.generated.json");
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
