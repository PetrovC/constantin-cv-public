using System.Text.Encodings.Web;
using System.Text.Json;
using CvGenerator.Application;

namespace CvGenerator.Infrastructure;

/// <summary>
/// Writes private print JSON artifacts under the generated print directory.
/// </summary>
public sealed class FilePrintJsonArtifactWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = true
    };

    /// <summary>
    /// Writes print JSON artifacts to generated/print below the provided output root.
    /// </summary>
    /// <param name="outputRoot">The generation output root.</param>
    /// <param name="artifacts">The print JSON artifacts to write.</param>
    /// <param name="cancellationToken">Token used to cancel file writing.</param>
    /// <returns>The written file paths.</returns>
    public async Task<IReadOnlyList<string>> WriteAsync(
        string outputRoot,
        IReadOnlyList<PrintJsonArtifact> artifacts,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(outputRoot))
        {
            throw new ArgumentException("Output path is required.", nameof(outputRoot));
        }

        var printOutputPath = Path.Combine(outputRoot, "print");
        Directory.CreateDirectory(printOutputPath);

        var writtenFiles = new List<string>();
        foreach (var artifact in artifacts)
        {
            var path = Path.Combine(printOutputPath, artifact.FileName);
            await using var stream = File.Create(path);
            await JsonSerializer.SerializeAsync(stream, artifact.Content, JsonOptions, cancellationToken);
            writtenFiles.Add(path);
        }

        return writtenFiles;
    }
}
