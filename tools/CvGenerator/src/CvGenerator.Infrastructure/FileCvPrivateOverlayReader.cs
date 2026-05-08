using CvGenerator.Domain;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace CvGenerator.Infrastructure;

/// <summary>
/// Reads the ignored private CV overlay used only for local print generation.
/// </summary>
public sealed class FileCvPrivateOverlayReader
{
    private const string MissingOverlayMessage =
        "Private CV overlay file was not found. Create data/private/cv.private.yml by copying data/private/cv.private.example.yml, then fill it with private contact details.";

    private readonly IDeserializer deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    /// <summary>
    /// Reads and parses the private overlay YAML file.
    /// </summary>
    /// <param name="path">The private overlay path.</param>
    /// <param name="cancellationToken">Token used to cancel file reading.</param>
    /// <returns>The parsed private overlay.</returns>
    public async Task<CvPrivateOverlay> ReadAsync(string path, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("Private overlay path is required.", nameof(path));
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException(MissingOverlayMessage, path);
        }

        var content = await File.ReadAllTextAsync(path, cancellationToken);
        return Parse(content, path);
    }

    /// <summary>
    /// Parses private overlay YAML content.
    /// </summary>
    /// <param name="yaml">The YAML content.</param>
    /// <param name="sourceName">The source name used in error messages.</param>
    /// <returns>The parsed private overlay.</returns>
    public CvPrivateOverlay Parse(string yaml, string sourceName = "memory")
    {
        try
        {
            var overlay = deserializer.Deserialize<CvPrivateOverlay>(yaml);
            return overlay ?? new CvPrivateOverlay();
        }
        catch (YamlException ex)
        {
            throw new InvalidDataException($"Could not parse private CV overlay '{sourceName}': {ex.Message}", ex);
        }
    }
}
