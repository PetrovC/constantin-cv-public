import { defineConfig } from 'astro/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const astroPrerenderEntrypoint = require.resolve('astro/entrypoints/prerender');

export default defineConfig({
  site: 'https://capetrov.net',
  base: '/',
  outDir: './dist',
  vite: {
    resolve: {
      preserveSymlinks: true,
      alias: {
        'astro/entrypoints/prerender': astroPrerenderEntrypoint
      }
    }
  }
});
