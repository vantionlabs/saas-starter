import { hydrated } from "@/server/hydration.js";
import { listAuditLog } from "@/server/reads/organization.js";
import { HydrationBoundary, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { auditLogAtom } from "@vantion/core/atoms/Organization";
import { QueryError } from "@vantion/ui/app/query-error";
import { AuditTable } from "@vantion/ui/settings/audit-table";
import { AsyncResult } from "effect/unstable/reactivity";

const Audit = () => {
  const entries = useAtomValue(auditLogAtom);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Audit log</h2>
        <p className="text-muted-foreground text-sm">
          Every change made in this organization, and every attempt that was refused. Recorded
          centrally, so a new capability is covered without anybody remembering to log it.
        </p>
      </div>

      {
        /*
        No skeleton arm: the rows are hydrated before this paints. An empty list
        is the unreachable fallback, and the table's own empty state says more
        than a grey rectangle would.
      */
      }
      {AsyncResult.isFailure(entries)
        ? <QueryError result={entries} subject="the audit log" />
        : <AuditTable entries={AsyncResult.isSuccess(entries) ? entries.value : []} />}
    </section>
  );
};

const AuditRoute = () => (
  <HydrationBoundary state={hydrated(Route.useLoaderData())}>
    <Audit />
  </HydrationBoundary>
);

export const Route = createFileRoute("/_protected/settings/audit")({
  staticData: { crumb: "Audit log" },
  loader: () => listAuditLog(),
  component: AuditRoute,
});
