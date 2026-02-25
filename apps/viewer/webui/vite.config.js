import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@chronicler": resolve(__dirname, "../../chronicler/webui/src"),
    },
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 5008,
    strictPort: true,
  },
});
