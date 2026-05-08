using CvGenerator.Domain;

namespace CvGenerator.Tests;

internal static class CvDocumentFactory
{
    public static CvDocument ValidMinimal()
        => new()
        {
            SchemaVersion = 1,
            Languages = new CvLanguages
            {
                Primary = "fr",
                Supported = ["fr", "en", "de"]
            },
            Profile = new CvProfile
            {
                FirstName = "Constantin",
                LastName = "Petrov",
                Title = Text(
                    "Développeur .NET et web",
                    ".NET and web developer",
                    ".NET- und Webentwickler"),
                Subtitle = Text(
                    "Applications métier maintenables",
                    "Maintainable business applications",
                    "Wartbare Geschäftsanwendungen"),
                Location = "Belgique / Luxembourg"
            },
            Summary = new CvSummary
            {
                Short = Text(
                    "Résumé court",
                    "Short summary",
                    "Kurze Zusammenfassung"),
                Long = Text(
                    "Résumé long",
                    "Long summary",
                    "Lange Zusammenfassung")
            },
            Experiences =
            [
                new CvExperience
                {
                    Id = "experience-1",
                    Company = "Example Company",
                    Role = Text(
                        "Développeur logiciel",
                        "Software developer",
                        "Softwareentwickler"),
                    Period = new CvPeriod
                    {
                        From = "2023-01",
                        To = "present"
                    },
                    Visibility = Visibility(),
                    Missions =
                    [
                        new CvMission
                        {
                            Id = "mission-1",
                            Name = "Platform",
                            Title = Text(
                                "Développement plateforme",
                                "Platform development",
                                "Plattformentwicklung"),
                            Tags = [".NET", "Vue.js"],
                            Bullets =
                            [
                                Text(
                                    "Livraison d'applications web maintenables",
                                    "Delivered maintainable web applications",
                                    "Lieferung wartbarer Webanwendungen")
                            ]
                        }
                    ]
                }
            ]
        };

    public static CvDocument ValidFullSections()
    {
        var document = ValidMinimal();

        return document with
        {
            Profile = document.Profile! with
            {
                Links = new CvLinkCollection
                {
                    Linkedin = "https://www.linkedin.com/in/constantin-petrov",
                    Github = "https://github.com/constantin-petrov",
                    Website = "https://constantin-petrov.example.com"
                }
            },
            Skills =
            [
                new CvSkillGroup
                {
                    Name = Text(
                        "Développement backend",
                        "Backend development",
                        "Backend-Entwicklung"),
                    Items = [".NET", "C#", "SQL Server"]
                }
            ],
            SoftSkills =
            [
                new CvSoftSkillGroup
                {
                    Name = Text(
                        "Collaboration",
                        "Collaboration",
                        "Zusammenarbeit"),
                    Items =
                    [
                        Text(
                            "Communication claire",
                            "Clear communication",
                            "Klare Kommunikation")
                    ]
                }
            ],
            SpokenLanguages =
            [
                new CvSpokenLanguage
                {
                    Name = Text("Français", "French", "Französisch"),
                    Level = Text("Courant", "Fluent", "Fließend"),
                    Order = 1
                },
                new CvSpokenLanguage
                {
                    Name = Text("Anglais", "English", "Englisch"),
                    Level = Text("Professionnel", "Professional", "Beruflich"),
                    Order = 2
                }
            ],
            Education =
            [
                new CvEducation
                {
                    Institution = "Haute école exemple",
                    Degree = Text(
                        "Bachelier en informatique de gestion",
                        "Bachelor's degree in business computing",
                        "Bachelor in Wirtschaftsinformatik"),
                    Period = new CvPeriod
                    {
                        From = "2018-09",
                        To = "2021-06"
                    },
                    Description = Text(
                        "Formation axée sur les applications métier",
                        "Training focused on business applications",
                        "Ausbildung mit Fokus auf Geschäftsanwendungen")
                }
            ],
            ContinuousLearning = new CvContinuousLearning
            {
                Title = Text(
                    "Formation continue",
                    "Continuous learning",
                    "Kontinuierliches Lernen"),
                Items =
                [
                    Text(
                        "Veille régulière sur .NET",
                        "Regular learning about .NET",
                        "Regelmäßige Weiterbildung zu .NET")
                ]
            }
        };
    }

    public static CvDocument WithPrivateContact(CvDocument document)
        => document with
        {
            Profile = document.Profile! with
            {
                Email = "private.contact@example.test",
                Phone = "PRIVATE_PHONE_PLACEHOLDER",
                Location = "PRIVATE_LOCATION_PLACEHOLDER"
            }
        };

    public static CvPrivateOverlay PrivateOverlay()
        => new()
        {
            Profile = new CvPrivateProfile
            {
                Email = "private.contact@example.test",
                Phone = "PRIVATE_PHONE_PLACEHOLDER",
                Location = "PRIVATE_LOCATION_PLACEHOLDER"
            }
        };

    public static CvVisibility Visibility()
        => new()
        {
            Website = true,
            ShortCv = true,
            FullDevCv = true,
            FullCompleteCv = true,
            Linkedin = true
        };

    public static LocalizedText Text(string value)
        => new()
        {
            Fr = value,
            En = value,
            De = value
        };

    public static LocalizedText Text(string fr, string en, string de)
        => new()
        {
            Fr = fr,
            En = en,
            De = de
        };
}
