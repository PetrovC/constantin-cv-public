using System.Text.Encodings.Web;
using System.Text.Json;
using CvGenerator.Application;

namespace CvGenerator.Infrastructure;

public sealed class FileWebJsonArtifactWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = true
    };

    public async Task<IReadOnlyList<string>> WriteAsync(
        string outputRoot,
        IReadOnlyList<WebJsonArtifact> artifacts,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(outputRoot))
        {
            throw new ArgumentException("Output path is required.", nameof(outputRoot));
        }

        var webOutputPath = Path.Combine(outputRoot, "web");
        Directory.CreateDirectory(webOutputPath);

        var writtenFiles = new List<string>();
        foreach (var artifact in artifacts)
        {
            var path = Path.Combine(webOutputPath, artifact.FileName);
            await using var stream = File.Create(path);
            await JsonSerializer.SerializeAsync(stream, artifact.Content, JsonOptions, cancellationToken);
            writtenFiles.Add(path);
        }

        return writtenFiles;
    }
}
