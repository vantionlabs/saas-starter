import { sessionAtom, signOut } from "@/atom/session-atoms.js";
import { CommandPalette } from "@/components/app/command-palette.js";
import { OrgSwitcher } from "@/components/app/org-switcher.js";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner.js";
import { nav } from "@/nav.js";
import { useAtomRefresh } from "@effect/atom-react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { AppShell as AppShellView } from "@vantion/ui/app/app-shell";
import { Sidebar } from "@vantion/ui/app/sidebar";
import { Effect } from "effect";
import type * as React from "react";

/**
 * The application's chrome: the layout from `@vantion/ui`, with everything that
 * fetches wired into its slots.
 *
 * No session gate of its own. `/_protected` resolves the session on the server
 * and redirects there, so by the time this renders there is a user — which is
 * why it reads one out of route context instead of waiting on an atom and
 * showing a "checking…" state the server already knew the answer to.
 *
 * The session atom is still refreshed on sign-out, because the RPC client caches
 * the identity for everything else on the page.
 */
export const AppShell = (props: { readonly children: React.ReactNode; }) => {
  const { user } = useRouteContext({ from: "/_protected" });
  const refresh = useAtomRefresh(sessionAtom);
  const navigate = useNavigate();

  return (
    <AppShellView
      commandPalette={<CommandPalette />}
      banner={user.emailVerified ? undefined : <VerifyEmailBanner email={user.email} />}
      sidebar={
        <Sidebar
          workspace="vantion"
          email={user.email}
          items={nav}
          orgSwitcher={<OrgSwitcher />}
          onSignOut={() =>
            void Effect.runPromise(signOut).then(() => {
              refresh();
              void navigate({ to: "/auth/sign-in" });
            })}
        />
      }
    >
      {props.children}
    </AppShellView>
  );
};
