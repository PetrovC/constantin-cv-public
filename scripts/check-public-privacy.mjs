import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');

const sourceFileExtensions = new Set([
  '.astro',
  '.cs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml'
]);

const publicArtifactFileExtensions = new Set([
  '',
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml'
]);

const textMarker = (...parts) => parts.join('');
const pathMarker = (...parts) => parts.join('/');
const routeMarker = (...parts) => `/${pathMarker(...parts)}`;

const blockedContentMarkers = [
  {
    name: 'consumer webmail provider marker',
    value: textMarker('g', 'mail'),
    ignoreCase: true
  },
  {
    name: 'Belgian phone country prefix',
    value: textMarker('+', '32'),
    ignoreCase: false
  },
  {
    name: 'private phone number fragment',
    value: textMarker('4', '87'),
    ignoreCase: false
  },
  {
    name: 'precise location marker A',
    value: textMarker('Houf', 'falize'),
    ignoreCase: true
  },
  {
    name: 'precise location marker B',
    value: textMarker('Nad', 'rin'),
    ignoreCase: true
  },
  {
    name: 'direct email link scheme',
    value: textMarker('mail', 'to'),
    ignoreCase: true
  },
  {
    name: 'encoded direct email link marker A',
    value: textMarker('mail', 'to%3a'),
    ignoreCase: true
  },
  {
    name: 'encoded direct email link marker B',
    value: textMarker('mail', 'to&#58;'),
    ignoreCase: true
  },
  {
    name: 'encoded direct email link marker C',
    value: textMarker('mail', 'to&#x3a;'),
    ignoreCase: true
  },
  {
    name: 'private print artifact directory marker',
    value: pathMarker('generated', 'print'),
    ignoreCase: false
  },
  {
    name: 'private PDF artifact directory marker',
    value: pathMarker('generated', 'pdf'),
    ignoreCase: false
  },
  {
    name: 'compact private print route marker',
    value: routeMarker('print', 'one-page'),
    ignoreCase: false
  },
  {
    name: 'developer private print route marker',
    value: routeMarker('print', 'full-dev'),
    ignoreCase: false
  }
];

const forbiddenTrackedPathRules = [
  {
    name: 'generated artifact path',
    matches: (repoPath) => repoPath === 'generated' || repoPath.startsWith('generated/')
  },
  {
    name: 'private reference path',
    matches: (repoPath) =>
      repoPath === pathMarker('references', 'private') ||
      repoPath.startsWith(`${pathMarker('references', 'private')}/`)
  },
  {
    name: 'private CV overlay',
    matches: (repoPath) => repoPath === pathMarker('data', 'private', 'cv.private.yml')
  },
  {
    name: 'public web build output path',
    matches: (repoPath) =>
      repoPath === pathMarker('apps', 'cv-web', 'dist') ||
      repoPath.startsWith(`${pathMarker('apps', 'cv-web', 'dist')}/`)
  }
];

const publicArtifactDirectories = [
  {
    name: 'public web JSON',
    repoPath: pathMarker('generated', 'web')
  },
  {
    name: 'public Astro build output',
    repoPath: pathMarker('apps', 'cv-web', 'dist')
  }
];

const forbiddenBuildPathMarkers = [
  pathMarker('fr', 'print', 'one-page'),
  pathMarker('fr', 'print', 'full-dev')
];

const failures = [];

try {
  await runPrivacyChecks();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error('Public privacy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log('Public privacy check passed.');
}

async function runPrivacyChecks() {
  const trackedFiles = await getTrackedFiles();
  verifyForbiddenTrackedPaths(trackedFiles);
  await scanTrackedSourceFiles(trackedFiles);
  await scanPublicArtifacts();
  await verifyPublicBuildDoesNotContainPrintRoutes();
}

async function getTrackedFiles() {
  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024
  });

  return stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map(toPosixPath);
}

function verifyForbiddenTrackedPaths(trackedFiles) {
  for (const repoPath of trackedFiles) {
    const matchedRule = forbiddenTrackedPathRules.find((rule) => rule.matches(repoPath));

    if (matchedRule) {
      failures.push(`Tracked ${matchedRule.name}: ${repoPath}`);
    }
  }
}

async function scanTrackedSourceFiles(trackedFiles) {
  const sourceFiles = trackedFiles.filter(isSourceFile);
  await scanRepoFiles(sourceFiles, 'tracked source file');
}

async function scanPublicArtifacts() {
  for (const artifactDirectory of publicArtifactDirectories) {
    const absolutePath = toAbsolutePath(artifactDirectory.repoPath);

    if (!(await exists(absolutePath))) {
      failures.push(
        `Missing ${artifactDirectory.name}: ${artifactDirectory.repoPath}. Run public generation and build first.`
      );
      continue;
    }

    const artifactFiles = await listPublicArtifactFiles(artifactDirectory.repoPath);
    await scanRepoFiles(artifactFiles, artifactDirectory.name);
  }
}

async function verifyPublicBuildDoesNotContainPrintRoutes() {
  const distPath = pathMarker('apps', 'cv-web', 'dist');
  const absoluteDistPath = toAbsolutePath(distPath);

  if (!(await exists(absoluteDistPath))) {
    return;
  }

  const artifactFiles = await listPublicArtifactFiles(distPath);

  for (const repoPath of artifactFiles) {
    for (const marker of forbiddenBuildPathMarkers) {
      if (repoPath.includes(marker)) {
        failures.push(`Private print route found in public build output: ${repoPath}`);
      }
    }
  }
}

async function scanRepoFiles(repoPaths, sourceName) {
  for (const repoPath of repoPaths) {
    const absolutePath = toAbsolutePath(repoPath);
    const content = await readFile(absolutePath, 'utf8');

    for (const marker of blockedContentMarkers) {
      const match = findMarker(content, marker);

      if (match) {
        failures.push(
          `${sourceName} contains ${marker.name}: ${repoPath}:${match.line}:${match.column}`
        );
      }
    }
  }
}

function findMarker(content, marker) {
  const haystack = marker.ignoreCase ? content.toLowerCase() : content;
  const needle = marker.ignoreCase ? marker.value.toLowerCase() : marker.value;
  const index = haystack.indexOf(needle);

  if (index === -1) {
    return undefined;
  }

  const beforeMatch = content.slice(0, index);
  const line = beforeMatch.split('\n').length;
  const lastLineBreakIndex = beforeMatch.lastIndexOf('\n');
  const column = index - lastLineBreakIndex;

  return { line, column };
}

async function listPublicArtifactFiles(repoDirectoryPath) {
  const absoluteDirectoryPath = toAbsolutePath(repoDirectoryPath);
  const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childRepoPath = pathMarker(repoDirectoryPath, entry.name);
    const childAbsolutePath = toAbsolutePath(childRepoPath);

    if (entry.isDirectory()) {
      files.push(...(await listPublicArtifactFiles(childRepoPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (await isReadableTextArtifact(childAbsolutePath)) {
      files.push(childRepoPath);
    }
  }

  return files;
}

async function isReadableTextArtifact(absolutePath) {
  if (!publicArtifactFileExtensions.has(extname(absolutePath).toLowerCase())) {
    return false;
  }

  const fileStat = await stat(absolutePath);

  if (fileStat.size > 5 * 1024 * 1024) {
    return false;
  }

  await access(absolutePath, fsConstants.R_OK);
  return true;
}

function isSourceFile(repoPath) {
  if (repoPath.endsWith('package-lock.json')) {
    return false;
  }

  return sourceFileExtensions.has(extname(repoPath).toLowerCase());
}

async function exists(absolutePath) {
  try {
    await access(absolutePath, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function toAbsolutePath(repoPath) {
  return resolve(repoRoot, repoPath.split('/').join(sep));
}

function toPosixPath(filePath) {
  return filePath.replaceAll('\\', '/');
}
