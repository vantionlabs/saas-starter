import type { LinkProps } from "@tanstack/react-router";
import { LayoutDashboard, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Where the sidebar and the command palette can go, so the two cannot list
 * different pages.
 *
 * It lives in the application rather than in `@vantion/ui` because `to` is typed
 * against the generated route tree, which only exists here. A sidebar that
 * hard-coded these would be a sidebar only this application could use.
 */
export const nav: ReadonlyArray<{
  readonly to: NonNullable<LinkProps["to"]>;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly exact?: boolean;
}> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  // `/settings` rather than a subpage: it redirects to General, and matching
  // non-exactly is what keeps this item lit on every settings page instead of
  // only one of them.
  { to: "/settings", label: "Settings", icon: Settings },
];
