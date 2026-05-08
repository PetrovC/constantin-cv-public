import type { GeneratedCvPeriod, SupportedLanguage } from './cvData';

export const uiText = {
  fr: {
    portfolioLabel: 'Portfolio CV',
    brandRole: 'Developpeur fullstack',
    navLabel: 'Navigation principale',
    navProfile: 'Profil',
    navSkills: 'Competences',
    navExperience: 'Experience',
    navContact: 'Contact',
    languageSelectionLabel: 'Selection de langue',
    switchLanguageLabel: 'Afficher la version',
    languageNames: {
      fr: 'francaise',
      en: 'anglaise',
      de: 'allemande'
    },
    heroAction: 'Voir le profil',
    heroDownloadAction: 'PDF a venir',
    locationLabel: 'Localisation',
    linksTitle: 'Liens',
    summaryTitle: 'Profil',
    valueCards: [
      {
        title: 'Moderniser',
        text: 'Faire evoluer des applications existantes sans casser les usages metier.'
      },
      {
        title: 'Construire',
        text: 'Livrer des fonctionnalites fullstack claires, utiles et maintenables.'
      },
      {
        title: 'Fiabiliser',
        text: 'Renforcer tests, qualite et refactoring pour limiter les regressions.'
      }
    ],
    skillsTitle: 'Competences',
    technicalSkillsTitle: 'Competences techniques',
    softSkillsTitle: 'Savoir-etre',
    languagesTitle: 'Langues',
    educationTitle: 'Formation',
    experienceTitle: 'Experience',
    missionSingularTitle: 'Mission',
    missionsTitle: 'Missions',
    tagsTitle: 'Technologies',
    downloadTitle: 'Telechargements',
    downloadText:
      'Les versions PDF professionnelles seront ajoutees plus tard depuis les pages imprimees.',
    downloadPlaceholder: 'PDF a venir',
    contactTitle: 'Contact',
    contactAction: 'Me contacter',
    present: 'aujourd hui',
    profileLinks: {
      linkedin: 'LinkedIn',
      github: 'GitHub',
      website: 'Site web'
    }
  },
  en: {
    portfolioLabel: 'CV portfolio',
    brandRole: 'Fullstack developer',
    navLabel: 'Main navigation',
    navProfile: 'Profile',
    navSkills: 'Skills',
    navExperience: 'Experience',
    navContact: 'Contact',
    languageSelectionLabel: 'Language selection',
    switchLanguageLabel: 'Show the',
    languageNames: {
      fr: 'French version',
      en: 'English version',
      de: 'German version'
    },
    heroAction: 'View profile',
    heroDownloadAction: 'PDF coming soon',
    locationLabel: 'Location',
    linksTitle: 'Links',
    summaryTitle: 'Profile',
    valueCards: [
      {
        title: 'Modernize',
        text: 'Evolve existing applications while protecting business workflows.'
      },
      {
        title: 'Build',
        text: 'Ship clear, useful and maintainable fullstack features.'
      },
      {
        title: 'Stabilize',
        text: 'Improve tests, quality and refactoring to reduce regressions.'
      }
    ],
    skillsTitle: 'Skills',
    technicalSkillsTitle: 'Technical skills',
    softSkillsTitle: 'Soft skills',
    languagesTitle: 'Languages',
    educationTitle: 'Education',
    experienceTitle: 'Experience',
    missionSingularTitle: 'Mission',
    missionsTitle: 'Missions',
    tagsTitle: 'Technologies',
    downloadTitle: 'Downloads',
    downloadText:
      'Professional PDF versions will be added later from dedicated print pages.',
    downloadPlaceholder: 'PDF coming soon',
    contactTitle: 'Contact',
    contactAction: 'Contact me',
    present: 'present',
    profileLinks: {
      linkedin: 'LinkedIn',
      github: 'GitHub',
      website: 'Website'
    }
  },
  de: {
    portfolioLabel: 'CV Portfolio',
    brandRole: 'Fullstack-Entwickler',
    navLabel: 'Hauptnavigation',
    navProfile: 'Profil',
    navSkills: 'Kompetenzen',
    navExperience: 'Erfahrung',
    navContact: 'Kontakt',
    languageSelectionLabel: 'Sprachauswahl',
    switchLanguageLabel: 'Version anzeigen:',
    languageNames: {
      fr: 'Franzoesisch',
      en: 'Englisch',
      de: 'Deutsch'
    },
    heroAction: 'Profil ansehen',
    heroDownloadAction: 'PDF folgt',
    locationLabel: 'Standort',
    linksTitle: 'Links',
    summaryTitle: 'Profil',
    valueCards: [
      {
        title: 'Modernisieren',
        text: 'Bestehende Anwendungen weiterentwickeln, ohne fachliche Ablaeufe zu stoeren.'
      },
      {
        title: 'Bauen',
        text: 'Klare, nuetzliche und wartbare Fullstack-Funktionen liefern.'
      },
      {
        title: 'Stabilisieren',
        text: 'Tests, Qualitaet und Refactoring staerken, um Regressionen zu begrenzen.'
      }
    ],
    skillsTitle: 'Kompetenzen',
    technicalSkillsTitle: 'Technische Kompetenzen',
    softSkillsTitle: 'Soft Skills',
    languagesTitle: 'Sprachen',
    educationTitle: 'Ausbildung',
    experienceTitle: 'Erfahrung',
    missionSingularTitle: 'Mission',
    missionsTitle: 'Missionen',
    tagsTitle: 'Technologien',
    downloadTitle: 'Downloads',
    downloadText:
      'Professionelle PDF-Versionen werden spaeter aus eigenen Druckseiten erzeugt.',
    downloadPlaceholder: 'PDF folgt',
    contactTitle: 'Kontakt',
    contactAction: 'Kontakt aufnehmen',
    present: 'heute',
    profileLinks: {
      linkedin: 'LinkedIn',
      github: 'GitHub',
      website: 'Website'
    }
  }
} as const satisfies Record<SupportedLanguage, LocalizedText>;

interface LocalizedText {
  portfolioLabel: string;
  brandRole: string;
  navLabel: string;
  navProfile: string;
  navSkills: string;
  navExperience: string;
  navContact: string;
  languageSelectionLabel: string;
  switchLanguageLabel: string;
  languageNames: Record<SupportedLanguage, string>;
  heroAction: string;
  heroDownloadAction: string;
  locationLabel: string;
  linksTitle: string;
  summaryTitle: string;
  valueCards: LocalizedValueCard[];
  skillsTitle: string;
  technicalSkillsTitle: string;
  softSkillsTitle: string;
  languagesTitle: string;
  educationTitle: string;
  experienceTitle: string;
  missionSingularTitle: string;
  missionsTitle: string;
  tagsTitle: string;
  downloadTitle: string;
  downloadText: string;
  downloadPlaceholder: string;
  contactTitle: string;
  contactAction: string;
  present: string;
  profileLinks: {
    linkedin: string;
    github: string;
    website: string;
  };
}

interface LocalizedValueCard {
  title: string;
  text: string;
}

export function formatPeriod(period: GeneratedCvPeriod, language: SupportedLanguage): string {
  const to = period.to === 'present' ? uiText[language].present : period.to;

  return `${period.from} - ${to}`;
}
