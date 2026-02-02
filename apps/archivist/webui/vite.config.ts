import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

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
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        zustand: { singleton: true },
        '@penguin-tales/image-store': { singleton: true },
      },
    }) as PluginOption,
  ],
  // Base path - use /archivist/ in dev (via proxy) and production
  base: '/archivist/',
  build: {
    target: 'esnext',
    minify: true,
    chunkSizeWarningLimit: 2000,
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
    port: 5005,
    strictPort: true,
  },
});
