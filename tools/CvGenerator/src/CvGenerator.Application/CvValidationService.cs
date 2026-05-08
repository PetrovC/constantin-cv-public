using System.Net.Mail;
using CvGenerator.Domain;

namespace CvGenerator.Application;

public sealed class CvValidationService
{
    private static readonly string[] RequiredLanguages = ["fr", "en", "de"];

    public CvValidationResult Validate(CvDocument document)
    {
        var errors = new List<CvValidationError>();

        ValidateSchemaVersion(document, errors);
        ValidateLanguages(document.Languages, errors);
        ValidateProfile(document.Profile, errors);
        ValidateSummary(document.Summary, errors);
        ValidateSkillGroups(document.Skills, errors);
        ValidateSoftSkillGroups(document.SoftSkills, errors);
        ValidateSpokenLanguages(document.SpokenLanguages, errors);
        ValidateEducation(document.Education, errors);
        ValidateContinuousLearning(document.ContinuousLearning, errors);
        ValidateExperiences(document.Experiences, errors);

        return errors.Count == 0
            ? CvValidationResult.Success()
            : CvValidationResult.Failure(errors);
    }

    private static void ValidateSchemaVersion(CvDocument document, List<CvValidationError> errors)
    {
        if (document.SchemaVersion is null)
        {
            Add(errors, "schemaVersion", "Schema version is required.");
            return;
        }

        if (document.SchemaVersion != 1)
        {
            Add(errors, "schemaVersion", "Schema version must be 1.");
        }
    }

    private static void ValidateLanguages(CvLanguages? languages, List<CvValidationError> errors)
    {
        if (languages is null)
        {
            Add(errors, "languages", "Languages are required.");
            return;
        }

        if (IsBlank(languages.Primary))
        {
            Add(errors, "languages.primary", "Primary language is required.");
        }

        foreach (var language in RequiredLanguages)
        {
            if (!languages.Supported.Contains(language, StringComparer.OrdinalIgnoreCase))
            {
                Add(errors, $"languages.supported.{language}", $"Supported languages must contain '{language}'.");
            }
        }
    }

    private static void ValidateProfile(CvProfile? profile, List<CvValidationError> errors)
    {
        if (profile is null)
        {
            Add(errors, "profile", "Profile is required.");
            return;
        }

        RequireValue(profile.FirstName, "profile.firstName", "First name is required.", errors);
        RequireValue(profile.LastName, "profile.lastName", "Last name is required.", errors);
        ValidateLocalizedText(profile.Title, "profile.title", errors);
        ValidateLocalizedText(profile.Subtitle, "profile.subtitle", errors);

        var email = profile.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email) && !LooksLikeEmail(email))
        {
            Add(errors, "profile.email", "Email must look like a valid email address.");
        }
    }

    private static void ValidateSummary(CvSummary? summary, List<CvValidationError> errors)
    {
        if (summary is null)
        {
            Add(errors, "summary", "Summary is required.");
            return;
        }

        ValidateLocalizedText(summary.Short, "summary.short", errors);
        ValidateLocalizedText(summary.Long, "summary.long", errors);
    }

    private static void ValidateExperiences(IReadOnlyList<CvExperience> experiences, List<CvValidationError> errors)
    {
        if (experiences.Count == 0)
        {
            Add(errors, "experiences", "At least one experience is required.");
            return;
        }

        var experienceIds = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < experiences.Count; index++)
        {
            var experience = experiences[index];
            var path = $"experiences[{index}]";

            var experienceId = experience.Id;
            if (string.IsNullOrWhiteSpace(experienceId))
            {
                Add(errors, $"{path}.id", "Experience id is required.");
            }
            else if (!experienceIds.Add(experienceId))
            {
                Add(errors, $"{path}.id", $"Experience id '{experienceId}' must be unique.");
            }

            RequireValue(experience.Company, $"{path}.company", "Company is required.", errors);
            ValidateLocalizedText(experience.Role, $"{path}.role", errors);
            ValidatePeriod(experience.Period, $"{path}.period", "Experience period is required.", errors);
            ValidateVisibility(experience.Visibility, $"{path}.visibility", errors);
            ValidateMissions(experience.Missions, $"{path}.missions", errors);
        }
    }

    private static void ValidateSkillGroups(
        IReadOnlyList<CvSkillGroup?>? skillGroups,
        List<CvValidationError> errors)
    {
        if (skillGroups is null || skillGroups.Count == 0)
        {
            return;
        }

        for (var index = 0; index < skillGroups.Count; index++)
        {
            var path = $"skills[{index}]";
            var group = skillGroups[index];
            if (group is null)
            {
                Add(errors, path, "Skill group is required.");
                continue;
            }

            ValidateLocalizedText(group.Name, $"{path}.name", errors);
            ValidateStringItems(group.Items, $"{path}.items", "Skill group must contain at least one item.", errors);
        }
    }

    private static void ValidateSoftSkillGroups(
        IReadOnlyList<CvSoftSkillGroup?>? softSkillGroups,
        List<CvValidationError> errors)
    {
        if (softSkillGroups is null || softSkillGroups.Count == 0)
        {
            return;
        }

        for (var index = 0; index < softSkillGroups.Count; index++)
        {
            var path = $"softSkills[{index}]";
            var group = softSkillGroups[index];
            if (group is null)
            {
                Add(errors, path, "Soft skill group is required.");
                continue;
            }

            ValidateLocalizedText(group.Name, $"{path}.name", errors);
            ValidateLocalizedItems(group.Items, $"{path}.items", "Soft skill group must contain at least one item.", errors);
        }
    }

    private static void ValidateSpokenLanguages(
        IReadOnlyList<CvSpokenLanguage?>? spokenLanguages,
        List<CvValidationError> errors)
    {
        if (spokenLanguages is null || spokenLanguages.Count == 0)
        {
            return;
        }

        for (var index = 0; index < spokenLanguages.Count; index++)
        {
            var path = $"spokenLanguages[{index}]";
            var language = spokenLanguages[index];
            if (language is null)
            {
                Add(errors, path, "Spoken language is required.");
                continue;
            }

            ValidateLocalizedText(language.Name, $"{path}.name", errors);
            ValidateLocalizedText(language.Level, $"{path}.level", errors);
        }
    }

    private static void ValidateEducation(
        IReadOnlyList<CvEducation?>? educationEntries,
        List<CvValidationError> errors)
    {
        if (educationEntries is null || educationEntries.Count == 0)
        {
            return;
        }

        for (var index = 0; index < educationEntries.Count; index++)
        {
            var path = $"education[{index}]";
            var education = educationEntries[index];
            if (education is null)
            {
                Add(errors, path, "Education entry is required.");
                continue;
            }

            RequireValue(education.Institution, $"{path}.institution", "Institution is required.", errors);
            ValidateLocalizedText(education.Degree, $"{path}.degree", errors);
            ValidatePeriod(education.Period, $"{path}.period", "Education period is required.", errors);

            if (education.Description is not null)
            {
                ValidateLocalizedText(education.Description, $"{path}.description", errors);
            }
        }
    }

    private static void ValidateContinuousLearning(
        CvContinuousLearning? continuousLearning,
        List<CvValidationError> errors)
    {
        if (continuousLearning is null)
        {
            return;
        }

        ValidateLocalizedText(continuousLearning.Title, "continuousLearning.title", errors);
        ValidateLocalizedItems(
            continuousLearning.Items,
            "continuousLearning.items",
            "Continuous learning must contain at least one item.",
            errors);
    }

    private static void ValidatePeriod(
        CvPeriod? period,
        string path,
        string requiredMessage,
        List<CvValidationError> errors)
    {
        if (period is null)
        {
            Add(errors, path, requiredMessage);
            return;
        }

        RequireValue(period.From, $"{path}.from", "Period from is required.", errors);
        RequireValue(period.To, $"{path}.to", "Period to is required.", errors);
    }

    private static void ValidateVisibility(CvVisibility? visibility, string path, List<CvValidationError> errors)
    {
        if (visibility is null)
        {
            return;
        }

        RequireFlag(visibility.Website, $"{path}.website", "Website visibility flag is required.", errors);
        RequireFlag(visibility.ShortCv, $"{path}.shortCv", "Short CV visibility flag is required.", errors);
        RequireFlag(visibility.FullDevCv, $"{path}.fullDevCv", "Full developer CV visibility flag is required.", errors);
        RequireFlag(
            visibility.FullCompleteCv,
            $"{path}.fullCompleteCv",
            "Full complete CV visibility flag is required.",
            errors);
        RequireFlag(visibility.Linkedin, $"{path}.linkedin", "LinkedIn visibility flag is required.", errors);
    }

    private static void ValidateMissions(
        IReadOnlyList<CvMission> missions,
        string path,
        List<CvValidationError> errors)
    {
        if (missions.Count == 0)
        {
            Add(errors, path, "Every experience must contain at least one mission.");
            return;
        }

        var missionIds = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < missions.Count; index++)
        {
            var mission = missions[index];
            var missionPath = $"{path}[{index}]";

            var missionId = mission.Id;
            if (string.IsNullOrWhiteSpace(missionId))
            {
                Add(errors, $"{missionPath}.id", "Mission id is required.");
            }
            else if (!missionIds.Add(missionId))
            {
                Add(errors, $"{missionPath}.id", $"Mission id '{missionId}' must be unique within the experience.");
            }

            RequireValue(mission.Name, $"{missionPath}.name", "Mission name is required.", errors);
            ValidateLocalizedText(mission.Title, $"{missionPath}.title", errors);
            ValidateBullets(mission.Bullets, $"{missionPath}.bullets", errors);
        }
    }

    private static void ValidateBullets(
        IReadOnlyList<LocalizedText?> bullets,
        string path,
        List<CvValidationError> errors)
    {
        if (bullets.Count == 0)
        {
            Add(errors, path, "Every mission must contain at least one bullet.");
            return;
        }

        for (var index = 0; index < bullets.Count; index++)
        {
            ValidateLocalizedText(bullets[index], $"{path}[{index}]", errors);
        }
    }

    private static void ValidateStringItems(
        IReadOnlyList<string>? items,
        string path,
        string emptyMessage,
        List<CvValidationError> errors)
    {
        if (items is null || items.Count == 0)
        {
            Add(errors, path, emptyMessage);
            return;
        }

        for (var index = 0; index < items.Count; index++)
        {
            RequireValue(items[index], $"{path}[{index}]", "Item is required.", errors);
        }
    }

    private static void ValidateLocalizedItems(
        IReadOnlyList<LocalizedText?>? items,
        string path,
        string emptyMessage,
        List<CvValidationError> errors)
    {
        if (items is null || items.Count == 0)
        {
            Add(errors, path, emptyMessage);
            return;
        }

        for (var index = 0; index < items.Count; index++)
        {
            ValidateLocalizedText(items[index], $"{path}[{index}]", errors);
        }
    }

    private static void ValidateLocalizedText(LocalizedText? text, string path, List<CvValidationError> errors)
    {
        if (text is null)
        {
            Add(errors, path, "Localized text is required.");
            return;
        }

        RequireValue(text.Fr, $"{path}.fr", "French translation is required.", errors);
        RequireValue(text.En, $"{path}.en", "English translation is required.", errors);
        RequireValue(text.De, $"{path}.de", "German translation is required.", errors);
    }

    private static void RequireValue(string? value, string path, string message, List<CvValidationError> errors)
    {
        if (IsBlank(value))
        {
            Add(errors, path, message);
        }
    }

    private static void RequireFlag(bool? value, string path, string message, List<CvValidationError> errors)
    {
        if (value is null)
        {
            Add(errors, path, message);
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

    private static bool IsBlank(string? value)
        => string.IsNullOrWhiteSpace(value);

    private static void Add(List<CvValidationError> errors, string path, string message)
    {
        errors.Add(new CvValidationError(path, message));
    }
}
