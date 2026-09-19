import { Link } from "@tanstack/react-router";
import type * as React from "react";

export type MarketingLink = { readonly to: string; readonly label: string; };

/**
 * The header and footer every marketing page wears.
 *
 * Takes its destinations and its name rather than declaring them, for the same
 * reason `Sidebar` does: `to` is typed against a generated route tree that
 * belongs to the application, and a shell that hard-codes paths is a shell only
 * one site can use. It is also what lets `apps/design` render it.
 *
 * Internal links are router links so navigation is a route change; the
 * application's own address is an anchor, because it is a different origin and
 * pretending otherwise breaks the back button.
 */
export const MarketingShell = (props: {
  readonly name: string;
  readonly nav: ReadonlyArray<MarketingLink>;
  readonly footerLinks: ReadonlyArray<MarketingLink>;
  readonly appUrl: string;
  readonly contact: string;
  readonly children: React.ReactNode;
}) => (
  <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
    <header className="flex items-center justify-between gap-6 py-6">
      <Link to="/" className="font-medium">{props.name}</Link>

      <nav aria-label="Main" className="flex items-center gap-5 text-sm">
        {props.nav.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {link.label}
          </Link>
        ))}
        <a href={props.appUrl} className="text-muted-foreground hover:text-foreground">
          Sign in
        </a>
      </nav>
    </header>

    <main className="flex-1">{props.children}</main>

    <footer className="text-muted-foreground mt-16 flex flex-col gap-4 border-t py-8 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        {props.footerLinks.map((link) => (
          <Link key={link.to} to={link.to} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
        <a href={`mailto:${props.contact}`} className="hover:text-foreground">Contact</a>
      </div>
      <div className="flex flex-col gap-1">
        <p>© {new Date().getFullYear()} {props.name}</p>
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
