import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_URL = process.env.VITE_API_BASE_URL || "http://localhost:8000";

// Safety check — warn if sensitive-looking VITE_ variables are set
const FORBIDDEN_VITE_PATTERNS = ["KEY", "SECRET", "TOKEN", "PASSWORD"];
Object.keys(process.env).forEach((key) => {
  if (key.startsWith("VITE_")) {
    FORBIDDEN_VITE_PATTERNS.forEach((pattern) => {
      if (key.toUpperCase().includes(pattern)) {
        console.warn(
          `⚠️  WARNING: ${key} looks sensitive — it will be public in the bundle`,
        );
      }
    });
  }
});

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(process.env.GITHUB_SHA || 'local'),
  },
  server: {
    port: 3000,
    proxy: {
      "/auth": API_URL,
      "/api": API_URL,
      "/stream": API_URL,
      "/health": API_URL,
    },
  },
});
