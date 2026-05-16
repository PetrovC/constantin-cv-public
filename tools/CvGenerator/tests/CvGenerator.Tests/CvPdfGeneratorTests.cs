using System.Text;
using CvGenerator.Application;
using CvGenerator.Pdf;
using Xunit;

namespace CvGenerator.Tests;

public sealed class CvPdfGeneratorTests
{
    [Fact]
    public void Generate_WhenGivenFrenchPrintDocument_ThenWritesContractNamedPdfFiles()
    {
        using var tempFolder = TemporaryFolder.Create();
        var french = FrenchPrintDocument();

        var written = new CvPdfGenerator().Generate(french, tempFolder.Path);

        var onePage = Path.Combine(
            tempFolder.Path, "pdf", "fr", "CV_Constantin_Petrov_One_Page_FR.pdf");
        var fullDev = Path.Combine(
            tempFolder.Path, "pdf", "fr", "CV_Constantin_Petrov_Full_Dev_FR.pdf");

        Assert.Equal(2, written.Count);
        Assert.True(File.Exists(onePage));
        Assert.True(File.Exists(fullDev));
        Assert.True(new FileInfo(onePage).Length > 0);
        Assert.True(new FileInfo(fullDev).Length > 0);
        Assert.Equal("%PDF-", ReadHeader(onePage));
        Assert.Equal("%PDF-", ReadHeader(fullDev));
    }

    [Fact]
    public void Generate_WhenVariantsDiffer_ThenStillProducesBothPdfs()
    {
        using var tempFolder = TemporaryFolder.Create();
        var document = CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidMinimal());
        var fullDevOnly = document.Experiences[0] with
        {
            Id = "full-dev-only",
            Company = "Full Dev Company",
            Visibility = CvDocumentFactory.Visibility() with { ShortCv = false, FullDevCv = true }
        };
        var result = new PrintJsonGenerationService().Generate(document with
        {
            Experiences = [.. document.Experiences, fullDevOnly]
        });
        var french = result.Artifacts.Single(artifact => artifact.Language == "fr").Content;

        var written = new CvPdfGenerator().Generate(french, tempFolder.Path);

        Assert.Equal(2, written.Count);
        Assert.All(written, path => Assert.True(new FileInfo(path).Length > 0));
    }

    private static PrintCvDocument FrenchPrintDocument()
    {
        var result = new PrintJsonGenerationService().Generate(
            CvDocumentFactory.WithPrivateContact(CvDocumentFactory.ValidFullSections()));

        return result.Artifacts.Single(artifact => artifact.Language == "fr").Content;
    }

    private static string ReadHeader(string path)
    {
        using var stream = File.OpenRead(path);
        var buffer = new byte[5];
        var read = stream.Read(buffer, 0, buffer.Length);

        return Encoding.ASCII.GetString(buffer, 0, read);
    }

    private sealed class TemporaryFolder : IDisposable
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
                $"constantin-cv-pdf-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(path);
            return new TemporaryFolder(path);
        }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }
        }
    }
}
