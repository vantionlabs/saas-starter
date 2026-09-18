import type * as React from "react";
import { Breadcrumbs } from "./breadcrumbs.js";

/**
 * Signed-in chrome: fixed sidebar, scrolling content pane.
 *
 * Layout and nothing else. Everything that fetches — the sidebar's session, the
 * command palette's list, the unverified-email banner — arrives as a slot, so
 * this composes the same way against a live application and against fixtures.
 *
 * The breadcrumb row is mounted here rather than pasted into a dozen route
 * files, so a new page gets a trail by declaring a `crumb` and nothing else.
 */
export const AppShell = (props: {
  readonly sidebar: React.ReactNode;
  readonly commandPalette?: React.ReactNode;
  readonly banner?: React.ReactNode;
  readonly children: React.ReactNode;
}) => (
  <div className="flex min-h-0 flex-1">
    {props.commandPalette}
    {props.sidebar}
    <div className="flex min-w-0 flex-1 flex-col overflow-auto">
      {props.banner !== undefined && <div className="p-4 pb-0">{props.banner}</div>}
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-8">
        <Breadcrumbs />
        {props.children}
      </main>
    </div>
  </div>
);
