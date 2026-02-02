import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

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
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  // Base path - use /coherence-engine/ in dev (via proxy) and production
  base: '/coherence-engine/',
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
  server: {
    port: 5003,
    strictPort: true,
    cors: true,
  },
});
