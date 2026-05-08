using System.Net.Mail;
using CvGenerator.Domain;

namespace CvGenerator.Application;

/// <summary>
/// Generates private print JSON artifacts from the validated CV source.
/// </summary>
public sealed class PrintJsonGenerationService
{
    private readonly CvValidationService validationService;

    public PrintJsonGenerationService(CvValidationService? validationService = null)
    {
        this.validationService = validationService ?? new CvValidationService();
    }

    /// <summary>
    /// Creates one localized print JSON artifact for each supported language.
    /// </summary>
    /// <param name="document">The source CV document.</param>
    /// <returns>The generation result with validation errors when the source is invalid.</returns>
    public PrintJsonGenerationResult Generate(CvDocument document)
    {
        var validationResult = validationService.Validate(document);
        var privateContactValidationResult = ValidatePrivateContact(document.Profile);
        if (!validationResult.IsValid || !privateContactValidationResult.IsValid)
        {
            return PrintJsonGenerationResult.Failure(CvValidationResult.Failure(
                validationResult.Errors.Concat(privateContactValidationResult.Errors).ToArray()));
        }

        var artifacts = document.Languages!.Supported
            .Select(language => language.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .Select(language => new PrintJsonArtifact(
                language,
                $"cv.{language}.print.json",
                CreateLocalizedDocument(document, language)))
            .ToArray();

        return PrintJsonGenerationResult.Success(artifacts);
    }

    private static CvValidationResult ValidatePrivateContact(CvProfile? profile)
    {
        if (profile is null)
        {
            return CvValidationResult.Success();
        }

        var errors = new List<CvValidationError>();
        RequireValue(profile.Email, "profile.email", "Private email is required for print generation.", errors);
        RequireValue(profile.Phone, "profile.phone", "Private telephone is required for print generation.", errors);
        RequireValue(profile.Location, "profile.location", "Private location is required for print generation.", errors);

        var email = profile.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email) && !LooksLikeEmail(email))
        {
            errors.Add(new CvValidationError("profile.email", "Private email must look like a valid email address."));
        }

        return errors.Count == 0
            ? CvValidationResult.Success()
            : CvValidationResult.Failure(errors);
    }

    private static void RequireValue(
        string? value,
        string path,
        string message,
        List<CvValidationError> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add(new CvValidationError(path, message));
        }
    }

    private static bool LooksLikeEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            return string.Equals(address.Address, email.Trim(), StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static PrintCvDocument CreateLocalizedDocument(CvDocument document, string language)
    {
        var profile = document.Profile!;
        var summary = document.Summary!;
        var links = profile.Links;

        return new PrintCvDocument
        {
            Language = language,
            Profile = new PrintCvProfile
            {
                FirstName = profile.FirstName!,
                LastName = profile.LastName!,
                FullName = $"{profile.FirstName} {profile.LastName}".Trim(),
                Title = Localize(profile.Title!, language),
                Subtitle = Localize(profile.Subtitle!, language),
                Contact = new PrintCvContact
                {
                    Email = profile.Email ?? string.Empty,
                    Phone = profile.Phone ?? string.Empty,
                    Location = profile.Location ?? string.Empty
                },
                Links = new PrintCvLinkCollection
                {
                    Linkedin = links?.Linkedin ?? string.Empty,
                    Github = links?.Github ?? string.Empty,
                    Website = links?.Website ?? string.Empty
                }
            },
            Summary = new PrintCvSummary
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
            OnePage = new PrintCvVariant
            {
                Experiences = document.Experiences
                    .Where(experience => CreateVisibility(experience.Visibility).ShortCv)
                    .Select(experience => CreateLocalizedExperience(experience, language))
                    .ToArray()
            },
            FullDev = new PrintCvVariant
            {
                Experiences = document.Experiences
                    .Where(experience => CreateVisibility(experience.Visibility).FullDevCv)
                    .Select(experience => CreateLocalizedExperience(experience, language))
                    .ToArray()
            }
        };
    }

    private static PrintCvSkillGroup CreateLocalizedSkillGroup(CvSkillGroup group, string language)
        => new()
        {
            Name = Localize(group.Name!, language),
            Items = group.Items.ToArray()
        };

    private static PrintCvSoftSkillGroup CreateLocalizedSoftSkillGroup(CvSoftSkillGroup group, string language)
        => new()
        {
            Name = Localize(group.Name!, language),
            Items = group.Items
                .Select(item => Localize(item!, language))
                .ToArray()
        };

    private static PrintCvSpokenLanguage CreateLocalizedSpokenLanguage(CvSpokenLanguage spokenLanguage, string language)
        => new()
        {
            Name = Localize(spokenLanguage.Name!, language),
            Level = Localize(spokenLanguage.Level!, language),
            Order = spokenLanguage.Order
        };

    private static PrintCvEducation CreateLocalizedEducation(CvEducation education, string language)
        => new()
        {
            Institution = education.Institution!,
            Degree = Localize(education.Degree!, language),
            Period = CreateLocalizedPeriod(education.Period!),
            Description = education.Description is null
                ? null
                : Localize(education.Description, language)
        };

    private static PrintCvContinuousLearning CreateLocalizedContinuousLearning(
        CvContinuousLearning continuousLearning,
        string language)
        => new()
        {
            Title = Localize(continuousLearning.Title!, language),
            Items = continuousLearning.Items
                .Select(item => Localize(item!, language))
                .ToArray()
        };

    private static PrintCvExperience CreateLocalizedExperience(CvExperience experience, string language)
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

    private static PrintCvMission CreateLocalizedMission(CvMission mission, string language)
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

    private static PrintCvPeriod CreateLocalizedPeriod(CvPeriod period)
        => new()
        {
            From = period.From!,
            To = period.To!
        };

    private static PrintCvVisibility CreateVisibility(CvVisibility? visibility)
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
            _ => throw new InvalidOperationException($"Unsupported generated print language: {language}")
        };
}
