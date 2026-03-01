import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
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
      shared: sharedDeps("zustand", "@the-canonry/image-store", "@the-canonry/narrative-store", "@the-canonry/world-store"),
    }) as PluginOption,
  ],
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
