import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import { resolve } from 'path'

// Name Forge is now an MFE remote only - standalone mode has been removed.
// To use Name Forge, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'nameForge',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './NameForgeRemote': './src/NameForgeRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  // Base path - use /name-forge/ in dev (via proxy) and production
  base: '/name-forge/',
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  optimizeDeps: {
    include: ['seedrandom', 'zod'],
  },
  server: {
    port: 5001,
    strictPort: true,
    cors: true,
  },
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      onwarn(warning, warn) {
        const isModuleFederationEval =
          warning.code === 'EVAL' &&
          (warning.id?.includes('@module-federation/sdk') ||
            warning.message.includes('@module-federation/sdk'))
        if (isModuleFederationEval) {
          return
        }
        warn(warning)
      },
    },
  },
})
