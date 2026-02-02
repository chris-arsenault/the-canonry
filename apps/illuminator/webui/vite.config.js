import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { resolve } from 'path';

// Illuminator is an MFE remote for The Canonry shell.
// To use Illuminator, run The Canonry (apps/canonry/webui).

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  plugins: [
    react(),
    federation({
      name: 'illuminator',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './IlluminatorRemote': './src/IlluminatorRemote.jsx',
        './entityRepository': './src/lib/db/entityRepository.ts',
        './eventRepository': './src/lib/db/eventRepository.ts',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        zustand: { singleton: true },
        '@penguin-tales/image-store': { singleton: true },
      },
    }),
  ],
  // Base path - use /illuminator/ in dev (via proxy) and production
  base: '/illuminator/',
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
    port: 5006,
    strictPort: true,
  },
});
