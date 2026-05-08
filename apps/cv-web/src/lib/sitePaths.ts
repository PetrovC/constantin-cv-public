import type { SupportedLanguage } from './cvData';

const normalizedBasePath = normalizeBasePath(import.meta.env.BASE_URL);

/**
 * Returns an app-internal absolute path prefixed with Astro's configured base path.
 */
export function getSitePath(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '');

  if (!normalizedPath) {
    return `${normalizedBasePath}/`;
  }

  return `${normalizedBasePath}/${normalizedPath}`;
}

/**
 * Returns the localized portfolio page path for the target language.
 */
export function getLanguagePath(language: SupportedLanguage): string {
  return getSitePath(`${language}/`);
}

function normalizeBasePath(basePath: string): string {
  const withoutTrailingSlash = basePath.replace(/\/+$/, '');

  return withoutTrailingSlash === '' ? '' : withoutTrailingSlash;
}
