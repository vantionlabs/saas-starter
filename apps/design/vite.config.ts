import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import * as path from "node:path";
import { defineConfig } from "vite";

/**
 * No SSR, no server, no API. This app exists to be looked at.
 *
 * A plain SPA rather than TanStack Start for that reason: there is no session to
 * resolve before render and no data to fetch, so the machinery that makes
 * `apps/web` correct would only be machinery here.
 */
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    conditions: ["development"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: { port: 5274, strictPort: true },
});
