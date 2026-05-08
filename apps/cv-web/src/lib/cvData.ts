import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

export const supportedLanguages = ['fr', 'en', 'de'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface GeneratedCvDocument {
  language: SupportedLanguage;
  profile: GeneratedCvProfile;
  summary: GeneratedCvSummary;
  skills: GeneratedCvSkillGroup[];
  softSkills: GeneratedCvSkillGroup[];
  spokenLanguages: GeneratedCvSpokenLanguage[];
  education: GeneratedCvEducation[];
  continuousLearning: GeneratedCvContinuousLearning;
  experiences: GeneratedCvExperience[];
}

export interface GeneratedCvProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  subtitle: string;
  location: string;
  links?: GeneratedCvProfileLinks;
}

export interface GeneratedCvProfileLinks {
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface GeneratedCvSummary {
  short: string;
  long: string;
}

export interface GeneratedCvSkillGroup {
  name: string;
  items: string[];
}

export interface GeneratedCvSpokenLanguage {
  name: string;
  level: string;
  order: number;
}

export interface GeneratedCvEducation {
  institution: string;
  degree: string;
  period: GeneratedCvPeriod;
  description: string;
}

export interface GeneratedCvContinuousLearning {
  title: string;
  items: string[];
}

export interface GeneratedCvExperience {
  id: string;
  company: string;
  role: string;
  period: GeneratedCvPeriod;
  visibility?: GeneratedCvVisibility;
  missions: GeneratedCvMission[];
}

export interface GeneratedCvVisibility {
  website: boolean;
  shortCv: boolean;
  fullDevCv: boolean;
  fullCompleteCv: boolean;
  linkedin: boolean;
}

export interface GeneratedCvPeriod {
  from: string;
  to: string;
}

export interface GeneratedCvMission {
  id: string;
  name: string;
  title: string;
  tags: string[];
  bullets: string[];
}

const generateCommand =
  'dotnet run --project tools/CvGenerator/src/CvGenerator.Cli/CvGenerator.Cli.csproj -- generate --input data/cv.yml --output generated';

const repoRoot = resolve(process.cwd(), '../..');
const generatedWebDirectory = resolve(repoRoot, 'generated/web');

export async function loadAllGeneratedCvDocuments(): Promise<
  Record<SupportedLanguage, GeneratedCvDocument>
> {
  const entries = await Promise.all(
    supportedLanguages.map(async (language) => [language, await loadGeneratedCvDocument(language)] as const)
  );

  return Object.fromEntries(entries) as Record<SupportedLanguage, GeneratedCvDocument>;
}

export async function loadGeneratedCvDocument(
  language: SupportedLanguage
): Promise<GeneratedCvDocument> {
  const filePath = resolve(generatedWebDirectory, `cv.${language}.generated.json`);

  try {
    const file = await readFile(filePath, 'utf8');
    return JSON.parse(file) as GeneratedCvDocument;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(
        [
          `Missing generated CV JSON artifact: ${filePath}`,
          'Generate the web artifacts before building the Astro website:',
          generateCommand
        ].join('\n')
      );
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Generated CV JSON artifact is not valid JSON: ${filePath}`);
    }

    throw error;
  }
}

/**
 * Returns the experiences that are intended for the public website.
 *
 * Experiences without an explicit visibility block are treated as visible so older
 * generated artifacts remain compatible with the website.
 */
export function getWebsiteVisibleExperiences(
  experiences: GeneratedCvExperience[]
): GeneratedCvExperience[] {
  return experiences.filter((experience) => experience.visibility?.website ?? true);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
