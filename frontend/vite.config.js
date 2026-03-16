import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_URL = process.env.VITE_API_BASE_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
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
