import { MemberOverrides } from "@/components/access/member-overrides.js";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { membersAtom } from "@vantion/core/atoms/Access";
import { MemberTable } from "@vantion/ui/access/member-table";
import { QueryError } from "@vantion/ui/app/query-error";
import { Skeleton } from "@vantion/ui/ui/skeleton";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

const Members = () => {
  const members = useAtomValue(membersAtom);
  const [expanded, setExpanded] = React.useState<string | undefined>(undefined);

  if (AsyncResult.isInitial(members)) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (AsyncResult.isFailure(members)) {
    return <QueryError result={members} subject="members" />;
  }

  const current = members.value.find((member) => member.memberId === expanded);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Members</h2>

      <MemberTable
        members={members.value}
        expanded={expanded}
        onToggle={(memberId) => setExpanded((open) => open === memberId ? undefined : memberId)}
      />

      {current !== undefined && <MemberOverrides memberId={current.memberId} role={current.role} />}
    </section>
  );
};

export const Route = createFileRoute("/_protected/settings/members")({
  staticData: { crumb: "Members" },
  component: Members,
});
