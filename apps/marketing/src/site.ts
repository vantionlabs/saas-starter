/**
 * The site's own facts, and the only place they are written down.
 *
 * Every page's metadata is derived from this: titles, canonical URLs, the
 * sitemap and the structured data. A marketing site that spells its own URL out
 * in nine places is one where eight of them are wrong after a rename.
 */
export const site = {
  name: "Acme",
  /** The public origin, for canonical URLs and the sitemap. No trailing slash. */
  url: "https://acme.example",
  tagline: "The boring parts of your B2B product, already done.",
  description:
    "Sign-in, organizations, roles, billing and an audit trail — so the first thing you build "
    + "is the thing you are actually selling.",
  /** Where "Start free" goes: the application itself. */
  appUrl: "http://localhost:5173",
  contact: "hello@acme.example",
} as const;

/** Every page, in nav order. The sitemap and the header both read this. */
export const pages = [
  { path: "/", label: "Home", inNav: false },
  { path: "/features", label: "Features", inNav: true },
  { path: "/pricing", label: "Pricing", inNav: true },
  { path: "/about", label: "About", inNav: true },
  { path: "/legal/privacy", label: "Privacy", inNav: false },
  { path: "/legal/terms", label: "Terms", inNav: false },
] as const;

export type PagePath = typeof pages[number]["path"];

/**
 * The head tags for one page.
 *
 * Built in one place because the failure is always the same: a page gains a
 * title and forgets the description, or gains both and forgets the canonical,
 * and nobody notices because none of it is visible. A test asserts every route
 * calls this.
 */
export const meta = (options: {
  readonly title: string;
  readonly description: string;
  readonly path: string;
}) => {
  const canonical = `${site.url}${options.path === "/" ? "" : options.path}`;
  const title = options.path === "/"
    ? `${site.name} — ${site.tagline}`
    : `${options.title} — ${site.name}`;

  return {
    meta: [
      { title },
      { name: "description", content: options.description },
      { property: "og:title", content: title },
      { property: "og:description", content: options.description },
      { property: "og:url", content: canonical },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: site.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: options.description },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
};
