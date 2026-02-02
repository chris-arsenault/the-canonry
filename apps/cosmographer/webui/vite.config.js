import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { resolve } from 'path';

// Cosmographer is now an MFE remote only - standalone mode has been removed.
// To use Cosmographer, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'cosmographer',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './CosmographerRemote': './src/CosmographerRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  // Base path - use /cosmographer/ in dev (via proxy) and production
  base: '/cosmographer/',
  resolve: {
    alias: {
      // Import name-forge lib directly for name generation
      '@name-forge': resolve(__dirname, '../../name-forge/lib'),
    },
  },
  optimizeDeps: {
    include: ['seedrandom', 'zod'],
  },
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
    port: 5002,
    strictPort: true,
    cors: true,
  },
});
