import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationOnWarn, sharedDeps } from '../../../config/federation.js';

// Archivist is an MFE remote for The Canonry shell.
// To use Archivist, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'archivist',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './ArchivistRemote': './src/ArchivistRemote.tsx',
      },
      shared: sharedDeps('zustand', '@the-canonry/image-store', '@the-canonry/world-store'),
    }) as PluginOption,
  ],
  // Base path - use /archivist/ in dev (via proxy) and production
  base: '/archivist/',
  build: {
    target: 'esnext',
    minify: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  server: {
    port: 5005,
    strictPort: true,
  },
});
