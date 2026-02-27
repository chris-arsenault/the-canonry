import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import path from 'node:path';
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
      shared: sharedDeps('zustand', '@penguin-tales/image-store', '@penguin-tales/world-store'),
    }) as PluginOption,
  ],
  resolve: {
    alias: {
      '@penguin-tales/world-store': path.resolve(
        __dirname,
        '../../../packages/world-store/src/index.ts'
      ),
    },
  },
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
