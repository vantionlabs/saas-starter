import { robots, sitemap } from "@/seo.js";
import { meta, pages, site } from "@/site.js";
import { describe, expect, it } from "@effect/vitest";

describe("the sitemap", () => {
  it("lists every page, with the site's real origin", () => {
    const xml = sitemap();

    for (const page of pages) {
      const loc = `${site.url}${page.path === "/" ? "" : page.path}`;

      expect(xml, `${page.path} is missing from the sitemap`).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("never writes a trailing slash on the home page", () => {
    expect(sitemap()).toContain(`<loc>${site.url}</loc>`);
    expect(sitemap()).not.toContain(`<loc>${site.url}/</loc>`);
  });

  it("is named by robots.txt, which disallows nothing", () => {
    expect(robots()).toContain(`Sitemap: ${site.url}/sitemap.xml`);
    expect(robots()).not.toContain("Disallow:");
  });
});

describe("page metadata", () => {
  it("canonicalises the home page without a trailing slash", () => {
    const head = meta({ title: "Home", description: "d", path: "/" });

    expect(head.links[0]?.href).toBe(site.url);
    // The home page's title is the tagline, not "Home — Acme".
    expect(head.meta[0]?.title).toBe(`${site.name} — ${site.tagline}`);
  });

  it("gives every other page its own canonical and a suffixed title", () => {
    const head = meta({ title: "Pricing", description: "d", path: "/pricing" });

    expect(head.links[0]?.href).toBe(`${site.url}/pricing`);
    expect(head.meta[0]?.title).toBe(`Pricing — ${site.name}`);
  });

  /**
   * The failure this exists to prevent: a page gains a title and forgets the
   * description, or gains both and forgets the Open Graph tags — and nobody
   * notices, because none of it is visible on the page.
   */
  it("always carries a description, a canonical and the social tags", () => {
    const head = meta({ title: "About", description: "Who builds it", path: "/about" });
    const names = head.meta.map((
      tag,
    ) => ("name" in tag ? tag.name : "property" in tag ? tag.property : "title"));

    for (
      const required of ["description", "og:title", "og:description", "og:url", "twitter:card"]
    ) {
      expect(names, `${required} is missing`).toContain(required);
    }
  });
});
