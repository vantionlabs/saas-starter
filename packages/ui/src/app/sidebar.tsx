import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "../ui/button.js";
import { Separator } from "../ui/separator.js";

export type NavItem = {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly exact?: boolean;
};

const item =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const active = "flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent text-foreground";

/**
 * The signed-in chrome down the left.
 *
 * Takes its destinations rather than declaring them: the route union belongs to
 * the application, and a sidebar that hard-codes paths is a sidebar only one
 * application can use. `orgSwitcher` is a slot for the same reason — the real
 * one reads atoms, and this package holds nothing that fetches.
 *
 * Real links throughout, so middle-click and copy-link behave as expected.
 */
export const Sidebar = (props: {
  readonly workspace: string;
  readonly email: string;
  readonly items: ReadonlyArray<NavItem>;
  readonly orgSwitcher?: React.ReactNode;
  readonly onSignOut: () => void;
}) => (
  <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border p-4">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">{props.workspace}</p>
          <p className="text-muted-foreground text-xs">workspace</p>
        </div>
        {props.orgSwitcher}
      </div>

      {/* One line, and the difference between a feature and a secret. */}
      <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
        Search
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </p>

      <Separator />

      <nav className="flex flex-col gap-1">
        {props.items.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            className={item}
            {...(exact === true ? { activeOptions: { exact: true } } : {})}
            activeProps={{ className: active }}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>

    <div className="flex flex-col gap-2">
      <p className="truncate font-mono text-xs text-muted-foreground">{props.email}</p>
      <Button type="button" variant="outline" size="sm" onClick={props.onSignOut}>
        Sign out
      </Button>
    </div>
  </aside>
);
