import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationOnWarn, sharedDeps } from '../../../config/federation.js';

// Coherence Engine is an MFE remote for The Canonry shell.
// To use Coherence Engine, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'coherenceEngine',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './CoherenceEngineRemote': './src/CoherenceEngineRemote.jsx',
      },
      shared: sharedDeps(),
    }),
  ],
  // Base path - use /coherence-engine/ in dev (via proxy) and production
  base: '/coherence-engine/',
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  server: {
    port: 5003,
    strictPort: true,
    cors: true,
  },
});
