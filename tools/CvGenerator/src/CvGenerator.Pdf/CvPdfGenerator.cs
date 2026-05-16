using System.Text;
using CvGenerator.Application;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace CvGenerator.Pdf;

/// <summary>
/// Renders the private one-page and full-developer CV PDFs from a localized
/// print document. Output paths and file names match the contract consumed by
/// scripts/admin/prepare-private-cv-assets.ps1 and the Worker delivery manifest.
/// </summary>
public sealed class CvPdfGenerator
{
    static CvPdfGenerator()
    {
        // QuestPDF Community license: free for individuals and companies below
        // the revenue threshold. This is a personal portfolio project.
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public IReadOnlyList<string> Generate(PrintCvDocument document, string outputDirectory)
    {
        var language = document.Language.Trim().ToLowerInvariant();
        var targetDirectory = Path.Combine(outputDirectory, "pdf", language);
        Directory.CreateDirectory(targetDirectory);

        var jobs = new[]
        {
            (Variant: document.OnePage, Label: "One_Page", Title: "One-page CV"),
            (Variant: document.FullDev, Label: "Full_Dev", Title: "Full developer CV")
        };

        var writtenFiles = new List<string>();

        foreach (var job in jobs)
        {
            var fileName = BuildFileName(document.Profile.FullName, job.Label, language);
            var filePath = Path.Combine(targetDirectory, fileName);

            new CvPdfDocument(document, job.Variant, job.Title).GeneratePdf(filePath);
            writtenFiles.Add(filePath);
        }

        return writtenFiles;
    }

    private static string BuildFileName(string fullName, string variantLabel, string language)
    {
        var slug = new StringBuilder();
        var previousWasSeparator = false;

        foreach (var character in fullName.Trim())
        {
            if (char.IsLetterOrDigit(character))
            {
                slug.Append(character);
                previousWasSeparator = false;
            }
            else if (!previousWasSeparator && slug.Length > 0)
            {
                slug.Append('_');
                previousWasSeparator = true;
            }
        }

        var name = slug.ToString().Trim('_');
        if (name.Length == 0)
        {
            name = "CV";
        }

        return $"CV_{name}_{variantLabel}_{language.ToUpperInvariant()}.pdf";
    }
}
