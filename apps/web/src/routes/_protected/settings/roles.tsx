import { RoleForm } from "@/components/access/role-form.js";
import { RoleTable } from "@/components/access/role-table.js";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { rolesAtom } from "@vantion/core/AccessAtoms";
import type { CustomRole } from "@vantion/module-iam/access/AccessRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { Button } from "@vantion/ui/ui/button";
import { Skeleton } from "@vantion/ui/ui/skeleton";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

const Roles = () => {
  const roles = useAtomValue(rolesAtom);
  const [editing, setEditing] = React.useState<CustomRole | undefined>(undefined);
  const [creating, setCreating] = React.useState(false);

  if (AsyncResult.isInitial(roles)) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (AsyncResult.isFailure(roles)) {
    return <QueryError result={roles} subject="roles" />;
  }

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
        : <RoleTable roles={roles.value} onEdit={setEditing} />}
    </section>
  );
};

export const Route = createFileRoute("/_protected/settings/roles")({
  staticData: { crumb: "Roles" },
  component: Roles,
});
