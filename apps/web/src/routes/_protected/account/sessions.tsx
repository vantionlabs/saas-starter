import { sessionsAtom, signOutEverywhereElse } from "@/atom/account-atoms.js";
import { listAccountSessions } from "@/server/reads/account.js";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { QueryError } from "@vantion/ui/app/query-error";
import { SessionTable } from "@vantion/ui/settings/session-table";
import { Button } from "@vantion/ui/ui/button";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

const Sessions = () => {
  const sessions = useAtomValue(sessionsAtom);
  const refresh = useAtomRefresh(sessionsAtom);
  const [busy, setBusy] = React.useState(false);

  if (AsyncResult.isFailure(sessions)) {
    return <QueryError result={sessions} subject="your sessions" />;
  }

  const rows = AsyncResult.isSuccess(sessions) ? sessions.value : [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Sessions</h2>
        <p className="text-muted-foreground text-sm">
          Every browser and device currently signed in as you. Ending one signs it out immediately.
        </p>
      </div>

      <SessionTable sessions={rows} />

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={busy || rows.length < 2}
        onClick={() => {
          setBusy(true);
          void Effect.runPromiseExit(signOutEverywhereElse).then(() => {
            setBusy(false);
            refresh();
          });
        }}
      >
        {busy ? "Signing out…" : "Sign out everywhere else"}
      </Button>
      {rows.length < 2 && (
        <p className="text-muted-foreground text-xs">
          This is your only session, so there is nothing else to sign out.
        </p>
      )}
    </section>
  );
};

export const Route = createFileRoute("/_protected/account/sessions")({
  staticData: { crumb: "Sessions" },
  loader: () => listAccountSessions(),
  component: Sessions,
});
