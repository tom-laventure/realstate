// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://realtybase.ca', // Hardcoded production apex domain — never derived from environment/runtime request data
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});