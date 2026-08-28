import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // The optional HEIC decoder is large when minified but remains lazy-loaded.
    // `scripts/check-bundle-budget.mjs` enforces tighter gzip budgets by chunk role.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalizedId = id.replaceAll("\\", "/");
          if (normalizedId.includes("/node_modules/")) {
            if (
              normalizedId.includes("/node_modules/react/") ||
              normalizedId.includes("/node_modules/react-dom/") ||
              normalizedId.includes("/node_modules/react-router/") ||
              normalizedId.includes("/node_modules/react-router-dom/")
            ) {
              return "vendor-react";
            }
            if (normalizedId.includes("/@tanstack/")) {
              return "vendor-query";
            }
            if (normalizedId.includes("/@radix-ui/")) {
              return "vendor-radix";
            }
            if (normalizedId.includes("/framer-motion/")) {
              return "vendor-motion";
            }
            if (normalizedId.includes("/lucide-react/")) {
              return "vendor-icons";
            }
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
