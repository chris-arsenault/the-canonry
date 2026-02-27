import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { federationOnWarn, sharedDeps } from '../../../config/federation.js';

// Lore Weave is an MFE remote for The Canonry shell.
// To use Lore Weave, run The Canonry (apps/canonry/webui).

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  plugins: [
    react(),
    federation({
      name: 'loreWeave',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './LoreWeaveRemote': './src/LoreWeaveRemote.jsx',
        './SimulationTraceVisx': './src/components/dashboard/trace/SimulationTraceVisx.jsx',
      },
      shared: sharedDeps(),
    }),
    {
      name: 'copy-lore-weave-schemas',
      apply: 'build',
      closeBundle() {
        const sourceDir = resolve(__dirname, '../lib/schemas');
        const targetDir = resolve(__dirname, 'dist/schemas');
        mkdirSync(targetDir, { recursive: true });
        for (const file of readdirSync(sourceDir)) {
          if (!file.endsWith('.schema.json')) continue;
          copyFileSync(join(sourceDir, file), join(targetDir, file));
        }
      },
    },
  ],
  // Base path - use /lore-weave/ in dev (via proxy) and production
  base: '/lore-weave/',
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5004,
    strictPort: true,
  },
});
