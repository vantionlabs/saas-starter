import { organizations } from "@/server/staff.js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { AdminOrganizationRow } from "@vantion/ui/admin/organization-table";
import { OrganizationTable } from "@vantion/ui/admin/organization-table";
import { ReasonPrompt } from "@vantion/ui/admin/reason-prompt";
import * as React from "react";

/**
 * The reason comes first, and the list does not exist until it is given.
 *
 * Fetching on mount and asking afterwards would mean every visit read every
 * tenant's name, with the reason recorded as an afterthought or not at all.
 */
const Organizations = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<ReadonlyArray<AdminOrganizationRow> | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (reason: string) => {
    setBusy(true);
    try {
      setRows(await organizations({ data: reason }));
    } finally {
      setBusy(false);
    }
  }, []);

  if (rows === null) {
    return (
      <ReasonPrompt
        title="Organizations"
        description="Every tenant on this deployment. Listing them is recorded."
        busy={busy}
        onSubmit={(reason) => void load(reason)}
      />
    );
  }

  return (
    <OrganizationTable
      organizations={rows}
      onOpen={(id) => void navigate({ to: "/organizations/$id", params: { id } })}
    />
  );
};

export const Route = createFileRoute("/")({ component: Organizations });
