using CvGenerator.Application;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CvGenerator.Pdf;

/// <summary>
/// Baseline A4 print template for one private CV variant (one-page or full-dev).
/// Layout is intentionally simple and is meant to be iterated on.
/// </summary>
public sealed class CvPdfDocument : IDocument
{
    private const string AccentColor = "#1849A9";
    private const string MutedColor = "#475467";
    private const string RuleColor = "#D7DDE5";

    private readonly PrintCvDocument document;
    private readonly PrintCvVariant variant;
    private readonly string variantLabel;

    public CvPdfDocument(PrintCvDocument document, PrintCvVariant variant, string variantLabel)
    {
        this.document = document;
        this.variant = variant;
        this.variantLabel = variantLabel;
    }

    public DocumentMetadata GetMetadata()
        => new()
        {
            Title = $"{document.Profile.FullName} - {variantLabel}",
            Author = document.Profile.FullName
        };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(text => text.FontSize(10).FontColor(Colors.Black).LineHeight(1.35f));

            page.Header().Element(ComposeHeader);
            page.Content().PaddingTop(16).Element(ComposeContent);
            page.Footer().AlignCenter().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(8).FontColor(MutedColor));
                text.Span($"{document.Profile.FullName} — ");
                text.CurrentPageNumber();
                text.Span(" / ");
                text.TotalPages();
            });
        });
    }

    private void ComposeHeader(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().Text(document.Profile.FullName)
                .FontSize(22).Bold().FontColor(AccentColor);
            column.Item().Text(document.Profile.Title).FontSize(12).FontColor(MutedColor);

            if (!string.IsNullOrWhiteSpace(document.Profile.Subtitle))
            {
                column.Item().Text(document.Profile.Subtitle).FontSize(10).FontColor(MutedColor);
            }

            column.Item().PaddingTop(6).Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(9).FontColor(MutedColor));

                foreach (var (value, isFirst) in ContactParts())
                {
                    if (!isFirst)
                    {
                        text.Span("  ·  ");
                    }

                    text.Span(value);
                }
            });

            column.Item().PaddingTop(8).LineHorizontal(1).LineColor(RuleColor);
        });
    }

    private IEnumerable<(string Value, bool IsFirst)> ContactParts()
    {
        var parts = new List<string>();
        var contact = document.Profile.Contact;
        var links = document.Profile.Links;

        if (!string.IsNullOrWhiteSpace(contact.Email)) parts.Add(contact.Email);
        if (!string.IsNullOrWhiteSpace(contact.Phone)) parts.Add(contact.Phone);
        if (!string.IsNullOrWhiteSpace(contact.Location)) parts.Add(contact.Location);
        if (!string.IsNullOrWhiteSpace(links.Linkedin)) parts.Add(links.Linkedin);
        if (!string.IsNullOrWhiteSpace(links.Github)) parts.Add(links.Github);
        if (!string.IsNullOrWhiteSpace(links.Website)) parts.Add(links.Website);

        for (var index = 0; index < parts.Count; index++)
        {
            yield return (parts[index], index == 0);
        }
    }

    private void ComposeContent(IContainer container)
    {
        container.Column(column =>
        {
            column.Spacing(16);

            if (!string.IsNullOrWhiteSpace(document.Summary.Long))
            {
                column.Item().Element(c => Section(c, "Profil", inner =>
                    inner.Text(document.Summary.Long)));
            }

            if (variant.Experiences.Count > 0)
            {
                column.Item().Element(c => Section(c, "Expérience", inner =>
                    inner.Column(experiences =>
                    {
                        experiences.Spacing(12);
                        foreach (var experience in variant.Experiences)
                        {
                            experiences.Item().Element(e => ComposeExperience(e, experience));
                        }
                    })));
            }

            if (document.Skills.Count > 0)
            {
                column.Item().Element(c => Section(c, "Compétences", inner =>
                    inner.Column(skills =>
                    {
                        skills.Spacing(4);
                        foreach (var group in document.Skills)
                        {
                            skills.Item().Text(text =>
                            {
                                text.Span($"{group.Name}: ").SemiBold();
                                text.Span(string.Join(", ", group.Items));
                            });
                        }
                    })));
            }

            if (document.SoftSkills.Count > 0)
            {
                column.Item().Element(c => Section(c, "Savoir-être", inner =>
                    inner.Column(soft =>
                    {
                        soft.Spacing(4);
                        foreach (var group in document.SoftSkills)
                        {
                            soft.Item().Text(text =>
                            {
                                text.Span($"{group.Name}: ").SemiBold();
                                text.Span(string.Join(", ", group.Items));
                            });
                        }
                    })));
            }

            if (document.SpokenLanguages.Count > 0)
            {
                column.Item().Element(c => Section(c, "Langues", inner =>
                    inner.Text(string.Join(
                        "   ·   ",
                        document.SpokenLanguages.Select(language => $"{language.Name} ({language.Level})")))));
            }

            if (document.Education.Count > 0)
            {
                column.Item().Element(c => Section(c, "Formation", inner =>
                    inner.Column(education =>
                    {
                        education.Spacing(6);
                        foreach (var entry in document.Education)
                        {
                            education.Item().Column(item =>
                            {
                                item.Item().Text(text =>
                                {
                                    text.Span(entry.Degree).SemiBold();
                                    text.Span($"  ·  {entry.Institution}").FontColor(MutedColor);
                                });
                                item.Item().Text($"{entry.Period.From} — {entry.Period.To}")
                                    .FontSize(9).FontColor(MutedColor);

                                if (!string.IsNullOrWhiteSpace(entry.Description))
                                {
                                    item.Item().Text(entry.Description!).FontSize(9);
                                }
                            });
                        }
                    })));
            }

            if (document.ContinuousLearning is { } learning && learning.Items.Count > 0)
            {
                column.Item().Element(c => Section(c, learning.Title, inner =>
                    inner.Column(items =>
                    {
                        foreach (var item in learning.Items)
                        {
                            items.Item().Text($"• {item}");
                        }
                    })));
            }
        });
    }

    private static void Section(IContainer container, string title, Action<IContainer> body)
    {
        container.Column(column =>
        {
            column.Item().Text(title.ToUpperInvariant())
                .FontSize(11).Bold().FontColor(AccentColor).LetterSpacing(0.05f);
            column.Item().PaddingTop(2).PaddingBottom(6).LineHorizontal(0.75f).LineColor(RuleColor);
            column.Item().Element(body);
        });
    }

    private void ComposeExperience(IContainer container, PrintCvExperience experience)
    {
        container.Column(column =>
        {
            column.Item().Text(text =>
            {
                text.Span(experience.Role).SemiBold().FontSize(11);
                text.Span($"  ·  {experience.Company}").FontColor(MutedColor);
            });
            column.Item().Text($"{experience.Period.From} — {experience.Period.To}")
                .FontSize(9).FontColor(MutedColor);

            foreach (var mission in experience.Missions)
            {
                column.Item().PaddingTop(6).Column(missionColumn =>
                {
                    missionColumn.Item().Text(mission.Title).SemiBold();

                    if (mission.Tags.Count > 0)
                    {
                        missionColumn.Item().Text(string.Join(" · ", mission.Tags))
                            .FontSize(8).FontColor(MutedColor);
                    }

                    foreach (var bullet in mission.Bullets)
                    {
                        missionColumn.Item().Row(row =>
                        {
                            row.ConstantItem(12).Text("•").FontColor(AccentColor);
                            row.RelativeItem().Text(bullet);
                        });
                    }
                });
            }
        });
    }
}
