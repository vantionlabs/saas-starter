import { MemberOverrides } from "@/components/access/member-overrides.js";
import { hydrated } from "@/server/hydration.js";
import { listMembers } from "@/server/reads/access.js";
import { HydrationBoundary, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { membersAtom } from "@vantion/core/atoms/Access";
import { MemberTable } from "@vantion/ui/access/member-table";
import { QueryError } from "@vantion/ui/app/query-error";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

const Members = () => {
  const members = useAtomValue(membersAtom);
  const [expanded, setExpanded] = React.useState<string | undefined>(undefined);

  if (AsyncResult.isFailure(members)) {
    return <QueryError result={members} subject="members" />;
  }

  /**
   * Hydrated before first paint, so there is no loading arm. An empty list is
   * the unreachable fallback rather than a skeleton — if it were ever reached,
   * the table's own empty state says more than a grey rectangle.
   */
  const rows = AsyncResult.isSuccess(members) ? members.value : [];
  const current = rows.find((member) => member.memberId === expanded);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Members</h2>

      <MemberTable
        members={rows}
        expanded={expanded}
        onToggle={(memberId) => setExpanded((open) => open === memberId ? undefined : memberId)}
      />

      {current !== undefined && <MemberOverrides memberId={current.memberId} role={current.role} />}
    </section>
  );
};

const MembersRoute = () => (
  <HydrationBoundary state={hydrated(Route.useLoaderData())}>
    <Members />
  </HydrationBoundary>
);

export const Route = createFileRoute("/_protected/settings/members")({
  staticData: { crumb: "Members" },
  loader: () => listMembers(),
  component: MembersRoute,
});
