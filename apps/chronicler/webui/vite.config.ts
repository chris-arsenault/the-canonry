import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import path from "node:path";
import { federationOnWarn, sharedDeps } from "../../../config/federation.js";

// Chronicler is an MFE remote for The Canonry shell.
// To use Chronicler, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "chronicler",
      filename: "remoteEntry.js",
      manifest: true,
      exposes: {
        "./ChroniclerRemote": "./src/ChroniclerRemote.tsx",
      },
      shared: sharedDeps("zustand", "@penguin-tales/image-store", "@penguin-tales/narrative-store", "@penguin-tales/world-store"),
    }) as PluginOption,
  ],
  resolve: {
    alias: {
      "@penguin-tales/world-store": path.resolve(
        __dirname,
        "../../../packages/world-store/src/index.ts"
      ),
    },
  },
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
  // Base path - use /chronicler/ in dev (via proxy) and production
  base: "/chronicler/",
  build: {
    target: "esnext",
    minify: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  server: {
    port: 5007,
    strictPort: true,
  },
});
