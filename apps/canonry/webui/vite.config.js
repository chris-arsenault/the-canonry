import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationOnWarn, sharedDeps } from '../../../config/federation.js';

export default defineConfig({
  define: {
    global: 'globalThis',
    // readable-stream@2 (transitive AWS SDK dep) accesses process.browser
    // and process.version without guards — shim them for the browser
    'process.browser': 'true',
    'process.version': '""',
    'process.env': '({})',
  },
  resolve: {
    alias: {
      // AWS SDK uses Node stream.Writable — provide browser-compatible polyfill
      stream: 'readable-stream',
    },
  },
  plugins: [
    react(),
    federation({
      dts: false,
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
      shared: sharedDeps('zustand', '@the-canonry/image-store'),
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
