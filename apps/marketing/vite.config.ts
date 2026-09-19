import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

import { robots, sitemap } from "./src/seo.js";

/**
 * Server-rendered, because this is the page search engines and link previews
 * read.
 *
 * The first version of this app was a single prerendered page, which is fine
 * for one route and wrong for a site: a marketing site has several pages, each
 * needs its own title, description and canonical URL, and `robots.txt` and
 * `sitemap.xml` have to be served rather than pasted. Start gives all of that
 * for the same reasons `apps/web` uses it, minus the session.
 */
/**
 * `robots.txt` and `sitemap.xml`, written from the site's own page list.
 *
 * A plugin rather than a build script because this config is TypeScript that
 * Vite already compiles, so it can import the same module the pages do — and
 * because serving them in dev too means the thing that is tested is the thing
 * that ships.
 */
const seo = (): Plugin => ({
  name: "marketing-seo",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const body = request.url === "/robots.txt"
        ? robots()
        : request.url === "/sitemap.xml"
        ? sitemap()
        : undefined;

      if (body === undefined) return next();

      response.setHeader(
        "content-type",
        request.url === "/robots.txt" ? "text/plain" : "application/xml",
      );
      response.end(body);
    });
  },
  writeBundle: () => {
    const out = path.resolve(import.meta.dirname, ".output", "public");

    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "robots.txt"), robots());
    fs.writeFileSync(path.join(out, "sitemap.xml"), sitemap());
  },
});

export default defineConfig(({ command }) => ({
  // `seo()` first: its dev middleware has to run before Start's handler,
  // which otherwise answers /robots.txt with the router's not-found page.
  plugins: [seo(), tanstackStart(), nitro(), tailwindcss(), react()],
  // See apps/web: inline dependencies for the image, externalise them in dev.
  ssr: command === "build" ? { noExternal: true } : {},
  resolve: {
    conditions: ["development"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: { port: 5275, strictPort: true },
}));
