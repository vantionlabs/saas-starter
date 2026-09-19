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
    /**
     * The one refusal here that names itself. Everything else says the same
     * thing whether the caller is signed out, a customer, or banned — but
     * somebody holding the staff role has already proved who they are, and
     * telling them to enrol is the only way they get in.
     */
    const needsTwoFactor = "needsTwoFactor" in viewer && viewer.needsTwoFactor;

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
        <h1 className="text-lg font-semibold">
          {needsTwoFactor ? "Set up two-factor first" : "Not available"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {needsTwoFactor
            ? "This panel reads across every customer, so it needs a second factor. Enrol one in your account settings and come back."
            : "This surface is for staff. If you think that is wrong, sign in and try again."}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-sm font-semibold">
            Admin
          </Link>
          {
            /*
            The trail is in the navigation rather than somewhere a reviewer has
            to know the URL of. A log that takes effort to find is a log nobody
            reads, and this one exists to be read by the people it records.
          */
          }
          <Link to="/audit" className="text-muted-foreground text-xs hover:underline">
            Staff trail
          </Link>
        </nav>
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
