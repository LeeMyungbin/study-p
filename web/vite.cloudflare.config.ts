import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// Standalone Cloudflare deployment; intentionally does not load Sites hosting.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      configPath: './wrangler.cloudflare.jsonc',
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
