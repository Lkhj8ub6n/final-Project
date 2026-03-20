import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@workspace/ui": path.resolve(__dirname, "../../lib/ui/src"),
      "@workspace/api-client-react": path.resolve(__dirname, "../../lib/api-client-react/src"),
    },
  },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  base: "./",
  server: {
    port: 5174,
    host: true,
    open: false,
  },
});
