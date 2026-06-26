import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the local Express server so the browser stays same-origin
    // (cookies + no CORS) — mirrors the all-on-Vercel single-domain setup in production.
    proxy: { "/api": "http://localhost:4000" },
  },
});
