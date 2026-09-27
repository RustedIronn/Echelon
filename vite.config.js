import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],

  server: {
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@features": path.resolve(__dirname, "src/features"),
      "@core": path.resolve(__dirname, "src/core"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
