import "@/app.css";
import { pages, site } from "@/site.js";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { MarketingShell } from "@vantion/ui/marketing/shell";
import type * as React from "react";

/**
 * The document, and the tags that are the same on every page.
 *
 * Per-page titles, descriptions and canonicals are each route's own business
 * (see `meta` in `site.ts`); what lives here is the structured data and the
 * things a crawler reads once — the language, the viewport, the site name.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "index, follow" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        /**
         * Structured data, so a search result can show more than a blue link.
         * `Organization` rather than `SoftwareApplication`: the latter wants a
         * price and an operating system, and claiming either here would be
         * making something up for a machine to read.
         */
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: site.url,
          description: site.description,
          contactPoint: {
            "@type": "ContactPoint",
            email: site.contact,
            contactType: "sales",
          },
        }),
      },
    ],
  }),
  component: () => (
    <RootDocument>
      <MarketingShell
        name={site.name}
        nav={pages.filter((page) => page.inNav).map(({ path, label }) => ({ to: path, label }))}
        footerLinks={pages
          .filter((page) => page.path !== "/")
          .map(({ path, label }) => ({ to: path, label }))}
        appUrl={site.appUrl}
        contact={site.contact}
      >
        <Outlet />
      </MarketingShell>
    </RootDocument>
  ),
  notFoundComponent: () => (
    <div className="flex flex-col items-start gap-3 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">No such page</h1>
      <p className="text-muted-foreground text-sm">
        The link may be old. Everything this site has is in the navigation above.
      </p>
    </div>
  ),
});

const RootDocument = ({ children }: Readonly<{ children: React.ReactNode; }>) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body className="bg-background text-foreground font-sans antialiased">
      {children}
      <Scripts />
    </body>
  </html>
);
