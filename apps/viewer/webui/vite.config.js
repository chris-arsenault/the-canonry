import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'viewer',
      remotes: {
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
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        zustand: { singleton: true },
        '@penguin-tales/image-store': { singleton: true },
        '@penguin-tales/narrative-store': { singleton: true },
      },
    }),
  ],
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
    port: 5008,
    strictPort: true,
    proxy: {
      '/archivist': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/chronicler': {
        target: 'http://localhost:5007',
        changeOrigin: true,
      },
    },
  },
});
