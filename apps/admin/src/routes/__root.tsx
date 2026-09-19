import "@/app.css";
import { whoami } from "@/server/staff.js";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type * as React from "react";

/**
 * `noindex, nofollow` and nothing structured.
 *
 * The opposite of `apps/marketing`, deliberately: this is an internal surface
 * and the only thing a crawler could usefully learn from it is that it exists.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Admin" },
    ],
  }),
  /**
   * Resolved before anything renders, so a page never paints tenant data and
   * then discovers the caller should not have seen it.
   */
  beforeLoad: async () => ({ viewer: await whoami() }),
  component: Root,
  shellComponent: Document,
});

function Root() {
  const { viewer } = Route.useRouteContext();

  if (!viewer.staff) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
        <h1 className="text-lg font-semibold">Not available</h1>
        <p className="text-muted-foreground text-sm">
          This surface is for staff. If you think that is wrong, sign in and try again.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <Link to="/" className="text-sm font-semibold">
          Admin
        </Link>
        <p className="text-muted-foreground text-xs">{viewer.email}</p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function Document({ children }: { readonly children: React.ReactNode; }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
