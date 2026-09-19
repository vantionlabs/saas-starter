import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import * as path from "node:path";
import { defineConfig } from "vite";

/**
 * A brand kit, which is a document: it has to read without JavaScript.
 *
 * `pnpm build` renders the page to `index.html` after Vite bundles it (see
 * `prerender.mjs`), which is why this is a plain SPA config rather than
 * TanStack Start: there is no session to resolve, nothing to fetch and one
 * route, so a server would be machinery with nothing to do — but a crawler and
 * a link preview still need real HTML.
 */
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    conditions: ["development"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: { port: 5276, strictPort: true },
});
