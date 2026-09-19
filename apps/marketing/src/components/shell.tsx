import { pages, site } from "@/site.js";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

const nav = pages.filter((page) => page.inNav);

/**
 * The header and footer every page wears.
 *
 * Links rather than anchors inside the site, so navigation is a route change
 * rather than a full load — and anchors outward, because the application is a
 * different origin and pretending otherwise breaks the back button.
 */
export const Shell = (props: { readonly children: React.ReactNode; }) => (
  <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
    <header className="flex items-center justify-between gap-6 py-6">
      <Link to="/" className="font-medium">{site.name}</Link>

      <nav aria-label="Main" className="flex items-center gap-5 text-sm">
        {nav.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {page.label}
          </Link>
        ))}
        <a href={site.appUrl} className="text-muted-foreground hover:text-foreground">
          Sign in
        </a>
      </nav>
    </header>

    <main className="flex-1">{props.children}</main>

    <footer className="text-muted-foreground mt-16 flex flex-col gap-4 border-t py-8 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        {pages.filter((page) => page.path !== "/").map((page) => (
          <Link key={page.path} to={page.path} className="hover:text-foreground">
            {page.label}
          </Link>
        ))}
        <a href={`mailto:${site.contact}`} className="hover:text-foreground">Contact</a>
      </div>
      <div className="flex flex-col gap-1">
        <p>© {new Date().getFullYear()} {site.name}</p>
        <p>
          Built on the{" "}
          <a
            href="https://github.com/vantionlabs/saas-starter"
            className="underline underline-offset-2"
          >
            Vantion SaaS starter
          </a>.
        </p>
      </div>
    </footer>
  </div>
);
