// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: import('@astrojs/cloudflare').then(mod => mod.default()),
  vite: {
    plugins: [tailwindcss()]
  }
});