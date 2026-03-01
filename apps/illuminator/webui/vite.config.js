import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { resolve } from "node:path";
import { federationOnWarn, sharedDeps } from "../../../config/federation.js";

// Illuminator is an MFE remote for The Canonry shell.
// To use Illuminator, run The Canonry (apps/canonry/webui).

export default defineConfig({
  resolve: {
    alias: {
      "@lib": resolve(__dirname, "../lib"),
    },
  },
  plugins: [
    react(),
    federation({
      name: "illuminator",
      filename: "remoteEntry.js",
      manifest: true,
      exposes: {
        "./IlluminatorRemote": "./src/IlluminatorRemote.jsx",
        "./entityRepository": "./src/lib/db/entityRepository.ts",
        "./eventRepository": "./src/lib/db/eventRepository.ts",
        "./relationshipRepository": "./src/lib/db/relationshipRepository.ts",
        "./coordinateStateRepository": "./src/lib/db/coordinateStateRepository.ts",
        "./schemaRepository": "./src/lib/db/schemaRepository.ts",
      },
      shared: sharedDeps("zustand", "@the-canonry/image-store"),
    }),
  ],
  // Base path - use /illuminator/ in dev (via proxy) and production
  base: "/illuminator/",
  build: {
    target: "esnext",
    minify: false,
    rollupOptions: {
      onwarn: federationOnWarn,
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5006,
    strictPort: true,
  },
});
