import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

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
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
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
      onwarn(warning, warn) {
        const isModuleFederationEval =
          warning.code === 'EVAL' &&
          (warning.id?.includes('@module-federation/sdk') ||
            warning.message.includes('@module-federation/sdk'));
        if (isModuleFederationEval) {
          return;
        }
        warn(warning);
      },
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
