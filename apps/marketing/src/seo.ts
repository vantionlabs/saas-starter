// A relative import, not the `@` alias: `vite.config.ts` imports this file and
// the config is loaded by Node, where that alias does not exist yet.
import { pages, site } from "./site.js";

/**
 * The sitemap, from the same list the navigation is built from.
 *
 * Generated rather than written, because a sitemap maintained by hand is a
 * sitemap that lists the page somebody deleted last month and omits the two
 * they added — and neither failure is visible to anybody looking at the site.
 */
export const sitemap = (): string => {
  const urls = pages
    .map((page) => {
      const loc = `${site.url}${page.path === "/" ? "" : page.path}`;
      // The home page is the one worth crawling most often; legal pages
      // change when a lawyer says so, which is not weekly.
      const priority = page.path === "/" ? "1.0" : page.path.startsWith("/legal") ? "0.3" : "0.7";

      return `  <url>\n    <loc>${loc}</loc>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

/**
 * `robots.txt`, naming the sitemap.
 *
 * Nothing is disallowed: every page here is meant to be indexed, and a
 * disallow rule that exists "just in case" is how a site quietly stops ranking.
 */
export const robots = (): string => `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`;
