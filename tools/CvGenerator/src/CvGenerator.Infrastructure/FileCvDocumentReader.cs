using CvGenerator.Domain;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace CvGenerator.Infrastructure;

public sealed class FileCvDocumentReader
{
    private readonly IDeserializer deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    public async Task<CvDocument> ReadAsync(string path, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("Input path is required.", nameof(path));
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException("CV source file was not found.", path);
        }

        var content = await File.ReadAllTextAsync(path, cancellationToken);
        return Parse(content, path);
    }

    public CvDocument Parse(string yaml, string sourceName = "memory")
    {
        try
        {
            var document = deserializer.Deserialize<CvDocument>(yaml);
            return document ?? new CvDocument();
        }
        catch (YamlException ex)
        {
            throw new InvalidDataException($"Could not parse YAML CV source '{sourceName}': {ex.Message}", ex);
        }
    }
}
