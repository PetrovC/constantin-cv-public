import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import type { SupportedLanguage } from './cvData';

export type PrintCvVariantKey = 'onePage' | 'fullDev';

export interface GeneratedPrintCvDocument {
  language: SupportedLanguage;
  profile: GeneratedPrintCvProfile;
  summary: GeneratedPrintCvSummary;
  skills: GeneratedPrintCvSkillGroup[];
  softSkills: GeneratedPrintCvSoftSkillGroup[];
  spokenLanguages: GeneratedPrintCvSpokenLanguage[];
  education: GeneratedPrintCvEducation[];
  continuousLearning?: GeneratedPrintCvContinuousLearning;
  onePage: GeneratedPrintCvVariant;
  fullDev: GeneratedPrintCvVariant;
}

export interface GeneratedPrintCvProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  subtitle: string;
  contact: GeneratedPrintCvContact;
  links: GeneratedPrintCvProfileLinks;
}

export interface GeneratedPrintCvContact {
  email: string;
  phone: string;
  location: string;
}

export interface GeneratedPrintCvProfileLinks {
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface GeneratedPrintCvSummary {
  short: string;
  long: string;
}

export interface GeneratedPrintCvSkillGroup {
  name: string;
  items: string[];
}

export interface GeneratedPrintCvSoftSkillGroup {
  name: string;
  items: string[];
}

export interface GeneratedPrintCvSpokenLanguage {
  name: string;
  level: string;
  order: number;
}

export interface GeneratedPrintCvEducation {
  institution: string;
  degree: string;
  period: GeneratedPrintCvPeriod;
  description?: string;
}

export interface GeneratedPrintCvContinuousLearning {
  title: string;
  items: string[];
}

export interface GeneratedPrintCvVariant {
  experiences: GeneratedPrintCvExperience[];
}

export interface GeneratedPrintCvExperience {
  id: string;
  company: string;
  role: string;
  period: GeneratedPrintCvPeriod;
  visibility: GeneratedPrintCvVisibility;
  missions: GeneratedPrintCvMission[];
}

export interface GeneratedPrintCvVisibility {
  website: boolean;
  shortCv: boolean;
  fullDevCv: boolean;
  fullCompleteCv: boolean;
  linkedin: boolean;
}

export interface GeneratedPrintCvPeriod {
  from: string;
  to: string;
}

export interface GeneratedPrintCvMission {
  id: string;
  name: string;
  title: string;
  tags: string[];
  bullets: string[];
}

const generateCommand =
  'npm run cv:generate-print';

const repoRoot = resolve(process.cwd(), '../..');
const generatedPrintDirectory = resolve(repoRoot, 'generated/print');

/**
 * Loads the private print CV data generated from the YAML source.
 *
 * The public portfolio does not import this module, which keeps phone and raw
 * email data scoped to print and PDF pages.
 */
export async function loadGeneratedPrintCvDocument(
  language: SupportedLanguage
): Promise<GeneratedPrintCvDocument> {
  const filePath = resolve(generatedPrintDirectory, `cv.${language}.print.json`);

  try {
    const file = await readFile(filePath, 'utf8');
    return JSON.parse(file) as GeneratedPrintCvDocument;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(
        [
          `Missing generated print CV JSON artifact: ${filePath}`,
          'Generate the CV artifacts before building the print pages:',
          generateCommand
        ].join('\n')
      );
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Generated print CV JSON artifact is not valid JSON: ${filePath}`);
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
