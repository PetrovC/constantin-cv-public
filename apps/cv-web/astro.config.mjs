import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const isPrintBuild = process.env.CV_WEB_BUILD_MODE === 'print';
const astroPrerenderEntrypoint = require.resolve('astro/entrypoints/prerender');

export default defineConfig({
  site: 'https://capetrov.net',
  base: isPrintBuild ? undefined : '/',
  integrations: [vue()],
  outDir: isPrintBuild ? './dist-print' : './dist',
  vite: {
    resolve: {
      preserveSymlinks: true,
      alias: {
        'astro/entrypoints/prerender': astroPrerenderEntrypoint
      }
    }
  }
});
