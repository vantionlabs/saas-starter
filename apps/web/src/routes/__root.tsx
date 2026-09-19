import { useHydratedMatches } from "@/server/hydration.js";
import "@/app.css";
import { installClientTelemetry } from "@/telemetry/install.js";
import { reporter } from "@/telemetry/Reporter.js";
import { HydrationBoundary, RegistryProvider } from "@effect/atom-react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NotFound } from "@vantion/ui/app/not-found";
import { RouteCrash } from "@vantion/ui/app/route-crash";
import { Toaster } from "@vantion/ui/ui/sonner";
import * as React from "react";

/**
 * The whole document, not a subtree.
 *
 * Under Start the root route renders `<html>` down, which is why there is no
 * index.html and no main.tsx — `HeadContent` and `Scripts` are what the server
 * fills in and the browser picks up.
 *
 * `errorComponent` is declared here so it covers every page: routes are lazy, so
 * a boundary on each one would miss the failure that stops a route loading at all.
 */
/**
 * The crash screen, with the crash also written down.
 *
 * An error boundary swallows what it catches: without this the page a user is
 * staring at leaves no record anywhere, which is the one failure worth hearing
 * about first. `RouteCrash` stays presentational and `apps/design` keeps
 * rendering it without a telemetry pipeline behind it.
 */
const ReportedCrash = (props: { readonly error: Error; }) => {
  React.useEffect(() => {
    reporter.error(props.error, { kind: "route-boundary" });
  }, [props.error]);

  return <RouteCrash error={props.error} />;
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "vantion" },
    ],
  }),
  errorComponent: ReportedCrash,
  notFoundComponent: NotFound,
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
});

/** Applies every matched route's server-rendered reads, before anything reads one. */
const Hydrate = ({ children }: Readonly<{ children: React.ReactNode; }>) => (
  <HydrationBoundary state={useHydratedMatches()}>{children}</HydrationBoundary>
);

const RootDocument = ({ children }: Readonly<{ children: React.ReactNode; }>) => {
  // Client-only, and after hydration: installing during render would run on the
  // server too, where there is no window to listen to. The returned undo is the
  // effect's cleanup, which is what keeps a development remount from installing
  // a second pair of listeners.
  React.useEffect(() => installClientTelemetry(), []);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {
          /*
        Atoms are disposed the moment their last subscriber unmounts, unless the
        registry has an idle window — `AtomRegistry` only schedules a node for a
        timed removal when an idle TTL exists, and deletes it outright otherwise.
        With no window, every navigation threw away the page's data and refetched
        it on the way back, even when nothing had changed.

        Thirty seconds is the window, and it bounds how stale a returning page can
        be. That is proportionate: mutations from this tab invalidate their
        reactivity keys immediately regardless, so the only thing this can hold on
        to is a change somebody else made in the last half-minute.
      */
        }
        <RegistryProvider defaultIdleTTL={30_000}>
          {
            /*
            One boundary for the whole document, above the shell.
            `HydrationBoundary` applies a value immediately only for an atom
            with no node yet, and defers an existing one to an effect that never
            runs during SSR — so a boundary inside a route arrived after the
            shell had already read `contactsAtom` and `organizationsAtom`, and
            left exactly those `Initial` on the server.
          */
          }
          <Hydrate>
            <div className="h-dvh flex flex-col overflow-hidden">{children}</div>
            <Toaster position="bottom-right" />
          </Hydrate>
        </RegistryProvider>
        <Scripts />
      </body>
    </html>
  );
};
