import { RoleForm } from "@/components/access/role-form.js";
import { RoleTable } from "@/components/access/role-table.js";
import { hydrated } from "@/server/hydration.js";
import { listRoles } from "@/server/reads.js";
import { HydrationBoundary, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { rolesAtom } from "@vantion/core/atoms/Access";
import type { CustomRole } from "@vantion/module-iam/access/AccessRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { Button } from "@vantion/ui/ui/button";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

const Roles = () => {
  const roles = useAtomValue(rolesAtom);
  const [editing, setEditing] = React.useState<CustomRole | undefined>(undefined);
  const [creating, setCreating] = React.useState(false);

  if (AsyncResult.isFailure(roles)) {
    return <QueryError result={roles} subject="roles" />;
  }

  /** Hydrated before first paint; the empty list is the unreachable arm. */
  const rows = AsyncResult.isSuccess(roles) ? roles.value : [];
  const open = creating || editing !== undefined;
  const close = () => {
    setCreating(false);
    setEditing(undefined);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Custom roles</h2>
        {!open && (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>New role</Button>
        )}
      </div>

      {open
        ? <RoleForm editing={editing} onDone={close} />
        : <RoleTable roles={rows} onEdit={setEditing} />}
    </section>
  );
};

const RolesRoute = () => (
  <HydrationBoundary state={hydrated(Route.useLoaderData())}>
    <Roles />
  </HydrationBoundary>
);

export const Route = createFileRoute("/_protected/settings/roles")({
  staticData: { crumb: "Roles" },
  loader: () => listRoles(),
  component: RolesRoute,
});
