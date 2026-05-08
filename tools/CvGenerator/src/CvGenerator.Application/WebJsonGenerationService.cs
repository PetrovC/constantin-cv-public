using CvGenerator.Domain;

namespace CvGenerator.Application;

public sealed class WebJsonGenerationService
{
    private readonly CvValidationService validationService;

    public WebJsonGenerationService(CvValidationService? validationService = null)
    {
        this.validationService = validationService ?? new CvValidationService();
    }

    public WebJsonGenerationResult Generate(CvDocument document)
    {
        var validationResult = validationService.Validate(document);
        if (!validationResult.IsValid)
        {
            return WebJsonGenerationResult.Failure(validationResult);
        }

        var artifacts = document.Languages!.Supported
            .Select(language => language.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .Select(language => new WebJsonArtifact(
                language,
                $"cv.{language}.generated.json",
                CreateLocalizedDocument(document, language)))
            .ToArray();

        return WebJsonGenerationResult.Success(artifacts);
    }

    private static WebCvDocument CreateLocalizedDocument(CvDocument document, string language)
    {
        var profile = document.Profile!;
        var summary = document.Summary!;
        var links = profile.Links;

        return new WebCvDocument
        {
            Language = language,
            Profile = new WebCvProfile
            {
                FirstName = profile.FirstName!,
                LastName = profile.LastName!,
                FullName = $"{profile.FirstName} {profile.LastName}".Trim(),
                Title = Localize(profile.Title!, language),
                Subtitle = Localize(profile.Subtitle!, language),
                Location = profile.Location ?? string.Empty,
                Links = new WebCvLinkCollection
                {
                    Linkedin = links?.Linkedin ?? string.Empty,
                    Github = links?.Github ?? string.Empty,
                    Website = links?.Website ?? string.Empty
                }
            },
            Summary = new WebCvSummary
            {
                Short = Localize(summary.Short!, language),
                Long = Localize(summary.Long!, language)
            },
            Skills = (document.Skills ?? [])
                .Select(group => CreateLocalizedSkillGroup(group!, language))
                .ToArray(),
            SoftSkills = (document.SoftSkills ?? [])
                .Select(group => CreateLocalizedSoftSkillGroup(group!, language))
                .ToArray(),
            SpokenLanguages = (document.SpokenLanguages ?? [])
                .Select(spokenLanguage => CreateLocalizedSpokenLanguage(spokenLanguage!, language))
                .OrderBy(spokenLanguage => spokenLanguage.Order ?? int.MaxValue)
                .ToArray(),
            Education = (document.Education ?? [])
                .Select(education => CreateLocalizedEducation(education!, language))
                .ToArray(),
            ContinuousLearning = document.ContinuousLearning is null
                ? null
                : CreateLocalizedContinuousLearning(document.ContinuousLearning, language),
            Experiences = document.Experiences
                .Where(experience => CreateVisibility(experience.Visibility).Website)
                .Select(experience => CreateLocalizedExperience(experience, language))
                .ToArray()
        };
    }

    private static WebCvSkillGroup CreateLocalizedSkillGroup(CvSkillGroup group, string language)
        => new()
        {
            Name = Localize(group.Name!, language),
            Items = group.Items.ToArray()
        };

    private static WebCvSoftSkillGroup CreateLocalizedSoftSkillGroup(CvSoftSkillGroup group, string language)
        => new()
        {
            Name = Localize(group.Name!, language),
            Items = group.Items
                .Select(item => Localize(item!, language))
                .ToArray()
        };

    private static WebCvSpokenLanguage CreateLocalizedSpokenLanguage(CvSpokenLanguage spokenLanguage, string language)
        => new()
        {
            Name = Localize(spokenLanguage.Name!, language),
            Level = Localize(spokenLanguage.Level!, language),
            Order = spokenLanguage.Order
        };

    private static WebCvEducation CreateLocalizedEducation(CvEducation education, string language)
        => new()
        {
            Institution = education.Institution!,
            Degree = Localize(education.Degree!, language),
            Period = CreateLocalizedPeriod(education.Period!),
            Description = education.Description is null
                ? null
                : Localize(education.Description, language)
        };

    private static WebCvContinuousLearning CreateLocalizedContinuousLearning(
        CvContinuousLearning continuousLearning,
        string language)
        => new()
        {
            Title = Localize(continuousLearning.Title!, language),
            Items = continuousLearning.Items
                .Select(item => Localize(item!, language))
                .ToArray()
        };

    private static WebCvExperience CreateLocalizedExperience(CvExperience experience, string language)
        => new()
        {
            Id = experience.Id!,
            Company = experience.Company!,
            Role = Localize(experience.Role!, language),
            Period = CreateLocalizedPeriod(experience.Period!),
            Visibility = CreateVisibility(experience.Visibility),
            Missions = experience.Missions
                .Select(mission => CreateLocalizedMission(mission, language))
                .ToArray()
        };

    private static WebCvMission CreateLocalizedMission(CvMission mission, string language)
        => new()
        {
            Id = mission.Id!,
            Name = mission.Name!,
            Title = Localize(mission.Title!, language),
            Tags = mission.Tags.ToArray(),
            Bullets = mission.Bullets
                .Select(bullet => Localize(bullet!, language))
                .ToArray()
        };

    private static WebCvPeriod CreateLocalizedPeriod(CvPeriod period)
        => new()
        {
            From = period.From!,
            To = period.To!
        };

    private static WebCvVisibility CreateVisibility(CvVisibility? visibility)
        => new()
        {
            Website = visibility?.Website ?? true,
            ShortCv = visibility?.ShortCv ?? true,
            FullDevCv = visibility?.FullDevCv ?? true,
            FullCompleteCv = visibility?.FullCompleteCv ?? true,
            Linkedin = visibility?.Linkedin ?? true
        };

    private static string Localize(LocalizedText text, string language)
        => language switch
        {
            "fr" => text.Fr!,
            "en" => text.En!,
            "de" => text.De!,
            _ => throw new InvalidOperationException($"Unsupported generated web language: {language}")
        };
}
