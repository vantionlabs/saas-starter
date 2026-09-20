import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CreditCard,
  Fingerprint,
  KeyRound,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Exported so the command palette can offer the same destinations. Two lists
 * would mean a settings page that exists in the sidebar and not in ⌘K.
 */
export const settingsGroups: ReadonlyArray<{
  readonly label: string;
  readonly items: ReadonlyArray<{
    readonly to: NonNullable<LinkProps["to"]>;
    readonly label: string;
    readonly icon: LucideIcon;
  }>;
}> = [
  {
    label: "Organization",
    items: [
      { to: "/settings/general", label: "General", icon: Building2 },
      { to: "/settings/members", label: "Members", icon: Users },
      { to: "/settings/roles", label: "Roles", icon: ShieldCheck },
      { to: "/settings/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Developer",
    items: [
      { to: "/settings/api-keys", label: "API keys", icon: KeyRound },
      { to: "/settings/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    label: "Governance",
    items: [
      /**
       * Single sign-on is here and two-factor is not, which is the line this
       * whole split is drawn on: SSO decides how an *organization* admits
       * people, a second factor is one person's own credential. That one used
       * to sit here and now lives under `/account`.
       */
      { to: "/settings/sso", label: "Single sign-on", icon: Fingerprint },
      { to: "/settings/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

/**
 * Personal settings, which are deliberately **not** part of the organization
 * dashboard.
 *
 * Everything under `/settings` belongs to a workspace and is gated on what
 * somebody may do inside it; everything here belongs to the person and follows
 * them between organizations. Mixing them is how "delete account" ends up next
 * to "delete organization", and how a member with no admin rights finds their
 * own password behind a permission check.
 */
export const accountItems: ReadonlyArray<{
  readonly to: NonNullable<LinkProps["to"]>;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { to: "/account", label: "Profile", icon: UserRound },
  { to: "/account/security", label: "Security", icon: ShieldCheck },
  { to: "/account/sessions", label: "Sessions", icon: MonitorSmartphone },
];

const item =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const active = "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs bg-accent text-foreground";

/**
 * A second, narrower sidebar inside the settings pane.
 *
 * Grouped and deliberately quieter than the app's own navigation — smaller type,
 * no accent — so that two vertical navs side by side still read as a hierarchy
 * rather than as competing menus.
 */
export const SettingsNav = () => (
  <nav className="flex w-44 shrink-0 flex-col gap-4">
    {settingsGroups.map((group) => (
      <div key={group.label} className="flex flex-col gap-1">
        <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {group.label}
        </p>
        {group.items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={item} activeProps={{ className: active }}>
            <Icon className="size-3.5" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    ))}
  </nav>
);

/** The same narrow nav, for the account pane. */
export const AccountNav = () => (
  <nav className="flex w-44 shrink-0 flex-col gap-1">
    {accountItems.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        className={item}
        activeProps={{ className: active }}
        activeOptions={{ exact: to === "/account" }}
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
      </Link>
    ))}
  </nav>
);
