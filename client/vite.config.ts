import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.CREDAR_API_URL ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true },
      "/ws": { target: backendTarget, ws: true, changeOrigin: true },
    },
  },
});
