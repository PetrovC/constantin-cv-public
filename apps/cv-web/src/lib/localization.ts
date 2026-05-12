import type { GeneratedCvPeriod, SupportedLanguage } from './cvData';

export const uiText = {
  fr: {
    portfolioLabel: 'Portfolio CV',
    brandRole: 'Developpeur fullstack',
    navLabel: 'Navigation principale',
    navProfile: 'Profil',
    navSkills: 'Competences',
    navExperience: 'Experience',
    navCvRequest: 'CV',
    navContact: 'Contact',
    languageSelectionLabel: 'Selection de langue',
    switchLanguageLabel: 'Afficher la version',
    languageNames: {
      fr: 'francaise',
      en: 'anglaise',
      de: 'allemande'
    },
    heroAction: 'Voir le profil',
    heroDownloadAction: 'Demander mon CV',
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
    cvRequest: {
      kicker: 'CV sur demande',
      title: 'Demander mon CV',
      intro:
        'Vous etes sur le site CV/portfolio officiel de Constantin Petrov. Ce formulaire sert uniquement aux demandes professionnelles de CV; chaque demande est examinee manuellement avant toute suite.',
      privacy:
        'Les informations envoyees restent limitees au traitement de la demande. Aucun CV prive ni lien de telechargement prive direct n est expose publiquement.',
      trustNote:
        'Note de confiance: aucune demande de mot de passe, paiement, information bancaire, piece d identite ou identifiant sensible. Ce site ne propose aucun telechargement executable.',
      fullNameLabel: 'Nom complet',
      emailLabel: 'Email professionnel',
      organizationLabel: 'Entreprise / organisation',
      profileUrlLabel: 'URL LinkedIn ou site web (optionnel)',
      cvTypeLabel: 'Type de CV demande',
      cvTypeOptions: {
        onePage: 'CV une page',
        fullDeveloper: 'CV developpeur complet'
      },
      languageLabel: 'Langue demandee',
      languageOptions: {
        fr: 'Francais',
        en: 'Anglais',
        de: 'Allemand'
      },
      reasonLabel: 'Raison / contexte de la demande',
      reasonPlaceholder: 'Recrutement, mission potentielle, entretien technique...',
      turnstileLabel: 'Verification anti-spam',
      submitLabel: 'Envoyer la demande',
      submittingLabel: 'Envoi en cours...',
      successTitle: 'Demande recue',
      successMessage:
        'Merci. La demande a ete transmise et sera examinee avant tout envoi.',
      validationTitle: 'Informations a corriger',
      validationMessage: 'Verifiez les champs indiques puis renvoyez la demande.',
      antiSpamRequiredTitle: 'Verification requise',
      antiSpamRequiredMessage:
        'Completez la verification anti-spam avant d envoyer la demande.',
      antiSpamFailureTitle: 'Verification anti-spam echouee',
      antiSpamFailureMessage:
        'La verification anti-spam a echoue. Rechargez la verification puis reessayez.',
      temporaryErrorTitle: 'Service temporairement indisponible',
      temporaryErrorMessage:
        'La demande n a pas pu etre traitee maintenant. Reessayez plus tard.',
      configurationTitle: 'Formulaire non configure',
      configurationMessage:
        'La demande de CV n est pas disponible sur cette version du site.',
      validationFieldLabels: {
        fullName: 'Nom complet',
        requesterEmail: 'Email professionnel',
        company: 'Entreprise / organisation',
        profileUrl: 'URL LinkedIn ou site web',
        requestedCvType: 'Type de CV demande',
        requestedLanguage: 'Langue demandee',
        reason: 'Raison / contexte',
        turnstileToken: 'Verification anti-spam',
        body: 'Requete'
      },
      validationErrorMessages: {
        required: 'champ requis',
        too_long: 'champ trop long',
        invalid_email: 'adresse email invalide',
        invalid_url: 'URL HTTPS invalide',
        unsupported_cv_type: 'type de CV non pris en charge',
        unsupported_language: 'langue non prise en charge',
        invalid_json: 'requete JSON invalide',
        invalid_payload: 'format de demande invalide'
      }
    },
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
    navCvRequest: 'CV request',
    navContact: 'Contact',
    languageSelectionLabel: 'Language selection',
    switchLanguageLabel: 'Show the',
    languageNames: {
      fr: 'French version',
      en: 'English version',
      de: 'German version'
    },
    heroAction: 'View profile',
    heroDownloadAction: 'Request my CV',
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
    cvRequest: {
      kicker: 'CV on request',
      title: 'Request my CV',
      intro:
        'You are on the official CV and portfolio site of Constantin Petrov. This form is only for professional CV requests; each request is manually reviewed before any follow-up.',
      privacy:
        'Submitted details are limited to handling the request. No private CV file or direct private download link is exposed publicly.',
      trustNote:
        'Trust note: no password, payment, banking information, identity document, or sensitive credentials are ever requested here. This site offers no executable download.',
      fullNameLabel: 'Full name',
      emailLabel: 'Professional email',
      organizationLabel: 'Company / organization',
      profileUrlLabel: 'LinkedIn or website URL (optional)',
      cvTypeLabel: 'Requested CV type',
      cvTypeOptions: {
        onePage: 'One-page CV',
        fullDeveloper: 'Full developer CV'
      },
      languageLabel: 'Requested language',
      languageOptions: {
        fr: 'French',
        en: 'English',
        de: 'German'
      },
      reasonLabel: 'Reason / context of request',
      reasonPlaceholder: 'Recruiting, potential mission, technical interview...',
      turnstileLabel: 'Anti-spam verification',
      submitLabel: 'Send request',
      submittingLabel: 'Sending...',
      successTitle: 'Request received',
      successMessage:
        'Thank you. The request was sent and will be reviewed before anything is shared.',
      validationTitle: 'Information to correct',
      validationMessage: 'Check the listed fields and send the request again.',
      antiSpamRequiredTitle: 'Verification required',
      antiSpamRequiredMessage: 'Complete the anti-spam verification before sending the request.',
      antiSpamFailureTitle: 'Anti-spam verification failed',
      antiSpamFailureMessage:
        'The anti-spam verification failed. Reload the verification and try again.',
      temporaryErrorTitle: 'Service temporarily unavailable',
      temporaryErrorMessage:
        'The request could not be processed right now. Please try again later.',
      configurationTitle: 'Form not configured',
      configurationMessage:
        'CV requests are not available in this version of the site.',
      validationFieldLabels: {
        fullName: 'Full name',
        requesterEmail: 'Professional email',
        company: 'Company / organization',
        profileUrl: 'LinkedIn or website URL',
        requestedCvType: 'Requested CV type',
        requestedLanguage: 'Requested language',
        reason: 'Reason / context',
        turnstileToken: 'Anti-spam verification',
        body: 'Request'
      },
      validationErrorMessages: {
        required: 'required field',
        too_long: 'field is too long',
        invalid_email: 'invalid email address',
        invalid_url: 'invalid HTTPS URL',
        unsupported_cv_type: 'unsupported CV type',
        unsupported_language: 'unsupported language',
        invalid_json: 'invalid JSON request',
        invalid_payload: 'invalid request format'
      }
    },
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
    navCvRequest: 'CV anfragen',
    navContact: 'Kontakt',
    languageSelectionLabel: 'Sprachauswahl',
    switchLanguageLabel: 'Version anzeigen:',
    languageNames: {
      fr: 'Franzoesisch',
      en: 'Englisch',
      de: 'Deutsch'
    },
    heroAction: 'Profil ansehen',
    heroDownloadAction: 'CV anfragen',
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
    cvRequest: {
      kicker: 'CV auf Anfrage',
      title: 'CV anfragen',
      intro:
        'Sie sind auf der offiziellen CV- und Portfolio-Website von Constantin Petrov. Dieses Formular ist nur fuer berufliche CV-Anfragen gedacht; jede Anfrage wird vor jeder Rueckmeldung manuell geprueft.',
      privacy:
        'Gesendete Angaben bleiben auf die Bearbeitung der Anfrage beschraenkt. Kein privater CV und kein direkter privater Download-Link wird oeffentlich bereitgestellt.',
      trustNote:
        'Vertrauenshinweis: Hier werden niemals Passwort, Zahlung, Bankdaten, Ausweisdokumente oder sensible Zugangsdaten angefragt. Diese Website bietet keinen Download ausfuehrbarer Dateien an.',
      fullNameLabel: 'Vollstaendiger Name',
      emailLabel: 'Berufliche E-Mail',
      organizationLabel: 'Unternehmen / Organisation',
      profileUrlLabel: 'LinkedIn- oder Website-URL (optional)',
      cvTypeLabel: 'Gewuenschter CV-Typ',
      cvTypeOptions: {
        onePage: 'Einseitiger CV',
        fullDeveloper: 'Vollstaendiger Entwickler-CV'
      },
      languageLabel: 'Gewuenschte Sprache',
      languageOptions: {
        fr: 'Franzoesisch',
        en: 'Englisch',
        de: 'Deutsch'
      },
      reasonLabel: 'Grund / Kontext der Anfrage',
      reasonPlaceholder: 'Recruiting, moegliche Mission, technisches Gespraech...',
      turnstileLabel: 'Anti-Spam-Verifikation',
      submitLabel: 'Anfrage senden',
      submittingLabel: 'Wird gesendet...',
      successTitle: 'Anfrage erhalten',
      successMessage:
        'Danke. Die Anfrage wurde gesendet und wird vor einem Versand geprueft.',
      validationTitle: 'Angaben korrigieren',
      validationMessage: 'Pruefen Sie die genannten Felder und senden Sie die Anfrage erneut.',
      antiSpamRequiredTitle: 'Verifikation erforderlich',
      antiSpamRequiredMessage:
        'Schliessen Sie die Anti-Spam-Verifikation ab, bevor Sie die Anfrage senden.',
      antiSpamFailureTitle: 'Anti-Spam-Verifikation fehlgeschlagen',
      antiSpamFailureMessage:
        'Die Anti-Spam-Verifikation ist fehlgeschlagen. Laden Sie die Verifikation neu und versuchen Sie es erneut.',
      temporaryErrorTitle: 'Service voruebergehend nicht verfuegbar',
      temporaryErrorMessage:
        'Die Anfrage konnte jetzt nicht verarbeitet werden. Bitte versuchen Sie es spaeter erneut.',
      configurationTitle: 'Formular nicht konfiguriert',
      configurationMessage:
        'CV-Anfragen sind in dieser Version der Website nicht verfuegbar.',
      validationFieldLabels: {
        fullName: 'Vollstaendiger Name',
        requesterEmail: 'Berufliche E-Mail',
        company: 'Unternehmen / Organisation',
        profileUrl: 'LinkedIn- oder Website-URL',
        requestedCvType: 'Gewuenschter CV-Typ',
        requestedLanguage: 'Gewuenschte Sprache',
        reason: 'Grund / Kontext',
        turnstileToken: 'Anti-Spam-Verifikation',
        body: 'Anfrage'
      },
      validationErrorMessages: {
        required: 'Pflichtfeld',
        too_long: 'Feld ist zu lang',
        invalid_email: 'ungueltige E-Mail-Adresse',
        invalid_url: 'ungueltige HTTPS-URL',
        unsupported_cv_type: 'nicht unterstuetzter CV-Typ',
        unsupported_language: 'nicht unterstuetzte Sprache',
        invalid_json: 'ungueltige JSON-Anfrage',
        invalid_payload: 'ungueltiges Anfrageformat'
      }
    },
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
  navCvRequest: string;
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
  cvRequest: LocalizedCvRequest;
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

interface LocalizedCvRequest {
  kicker: string;
  title: string;
  intro: string;
  privacy: string;
  trustNote: string;
  fullNameLabel: string;
  emailLabel: string;
  organizationLabel: string;
  profileUrlLabel: string;
  cvTypeLabel: string;
  cvTypeOptions: {
    onePage: string;
    fullDeveloper: string;
  };
  languageLabel: string;
  languageOptions: Record<SupportedLanguage, string>;
  reasonLabel: string;
  reasonPlaceholder: string;
  turnstileLabel: string;
  submitLabel: string;
  submittingLabel: string;
  successTitle: string;
  successMessage: string;
  validationTitle: string;
  validationMessage: string;
  antiSpamRequiredTitle: string;
  antiSpamRequiredMessage: string;
  antiSpamFailureTitle: string;
  antiSpamFailureMessage: string;
  temporaryErrorTitle: string;
  temporaryErrorMessage: string;
  configurationTitle: string;
  configurationMessage: string;
  validationFieldLabels: Record<
    | 'fullName'
    | 'requesterEmail'
    | 'company'
    | 'profileUrl'
    | 'requestedCvType'
    | 'requestedLanguage'
    | 'reason'
    | 'turnstileToken'
    | 'body',
    string
  >;
  validationErrorMessages: Record<
    | 'required'
    | 'too_long'
    | 'invalid_email'
    | 'invalid_url'
    | 'unsupported_cv_type'
    | 'unsupported_language'
    | 'invalid_json'
    | 'invalid_payload',
    string
  >;
}

export function formatPeriod(period: GeneratedCvPeriod, language: SupportedLanguage): string {
  const to = period.to === 'present' ? uiText[language].present : period.to;

  return `${period.from} - ${to}`;
}
