import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const printDistDirectory = resolve(repoRoot, 'apps/cv-web/dist-print');
const privateOverlayPath = resolve(repoRoot, 'data/private/cv.private.yml');
const frenchPrintRoute = ['fr', 'print'];
const pdfOutputDirectory = resolve(repoRoot, 'generated', 'pdf', 'fr');

const pdfJobs = [
  {
    routeParts: [...frenchPrintRoute, 'one-page'],
    outputPath: resolve(pdfOutputDirectory, 'CV_Constantin_Petrov_One_Page_FR.pdf')
  },
  {
    routeParts: [...frenchPrintRoute, 'full-dev'],
    outputPath: resolve(pdfOutputDirectory, 'CV_Constantin_Petrov_Full_Dev_FR.pdf')
  }
];

try {
  await generatePdfs();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function generatePdfs() {
  await ensurePrivateOverlayExists();
  await runNpmScript('cv:generate');
  await runNpmScript('cv:generate-print');
  await runNpmScript('web:build', { CV_WEB_BUILD_MODE: 'print' });
  await ensureBuiltPrintPagesExist();
  await mkdir(pdfOutputDirectory, { recursive: true });

  const browser = await chromium.launch();

  try {
    for (const job of pdfJobs) {
      const htmlPath = getPrintHtmlPath(job.routeParts);
      const page = await browser.newPage({
        viewport: {
          width: 794,
          height: 1123
        },
        deviceScaleFactor: 1
      });

      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: job.outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        }
      });
      await page.close();

      console.log(`Generated ${job.outputPath} from ${getPrintRouteName(job.routeParts)}`);
    }
  } finally {
    await browser.close();
  }
}

async function ensureBuiltPrintPagesExist() {
  const missingRoutes = [];

  for (const job of pdfJobs) {
    if (!(await exists(getPrintHtmlPath(job.routeParts)))) {
      missingRoutes.push(getPrintRouteName(job.routeParts));
    }
  }

  if (missingRoutes.length > 0) {
    throw new Error(
      [
        'Missing built print pages:',
        ...missingRoutes.map((route) => `- ${route}`),
        'The print-mode web build did not create the expected private print pages.'
      ].join('\n')
    );
  }
}

function getPrintHtmlPath(routeParts) {
  return resolve(printDistDirectory, ...routeParts, 'index.html');
}

function getPrintRouteName(routeParts) {
  return `/${routeParts.join('/')}/`;
}

async function ensurePrivateOverlayExists() {
  if (await exists(privateOverlayPath)) {
    return;
  }

  throw new Error(
    [
      `Missing private CV overlay: ${privateOverlayPath}`,
      'Create it by copying data/private/cv.private.example.yml to data/private/cv.private.yml.',
      'Then replace the placeholder values with private contact details before generating PDFs.'
    ].join('\n')
  );
}

function runNpmScript(scriptName, extraEnvironment = {}) {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm.cmd run ${scriptName}`]
      : ['run', scriptName];

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...extraEnvironment
      },
      stdio: 'inherit'
    });

    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`npm run ${scriptName} failed with exit code ${code}`));
    });
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}
