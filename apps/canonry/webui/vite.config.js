import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationOnWarn, sharedDeps } from '../../../config/federation.js';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    federation({
      name: 'canonry',
      remotes: {
        // Remotes are loaded via path prefixes through the dev proxy (localhost:3000)
        // This avoids CORS issues by keeping everything on the same origin
        nameForge: {
          type: 'module',
          name: 'nameForge',
          entry: '/name-forge/remoteEntry.js',
          entryGlobalName: 'nameForge',
        },
        cosmographer: {
          type: 'module',
          name: 'cosmographer',
          entry: '/cosmographer/remoteEntry.js',
          entryGlobalName: 'cosmographer',
        },
        coherenceEngine: {
          type: 'module',
          name: 'coherenceEngine',
          entry: '/coherence-engine/remoteEntry.js',
          entryGlobalName: 'coherenceEngine',
        },
        loreWeave: {
          type: 'module',
          name: 'loreWeave',
          entry: '/lore-weave/remoteEntry.js',
          entryGlobalName: 'loreWeave',
        },
        illuminator: {
          type: 'module',
          name: 'illuminator',
          entry: '/illuminator/remoteEntry.js',
          entryGlobalName: 'illuminator',
        },
        archivist: {
          type: 'module',
          name: 'archivist',
          entry: '/archivist/remoteEntry.js',
          entryGlobalName: 'archivist',
        },
        chronicler: {
          type: 'module',
          name: 'chronicler',
          entry: '/chronicler/remoteEntry.js',
          entryGlobalName: 'chronicler',
        },
      },
      shared: sharedDeps('zustand', '@penguin-tales/image-store'),
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  server: {
    port: 5000,
    strictPort: true,
  },
});
