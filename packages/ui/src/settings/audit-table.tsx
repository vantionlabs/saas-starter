import type { AuditEntry, AuditOutcome } from "@vantion/module-iam/audit/Audit";
import { DateTime } from "effect";
import { ScrollText } from "lucide-react";
import * as React from "react";
import { Badge } from "../ui/badge.js";
import { DataTable } from "../ui/data-table.js";
import type { DataColumn } from "../ui/data-table.js";

const variantFor = (outcome: AuditOutcome) =>
  outcome === "ok" ? "secondary" : outcome === "denied" ? "destructive" : "outline";

/**
 * The audit log, which arrives a hundred rows at a time.
 *
 * The reason this one wants a filter more than most: it is read when somebody
 * is looking for a *particular* thing — who changed that role, when did that
 * key get revoked — and a hundred rows of successes is where the one denial
 * hides.
 */
export const AuditTable = (props: { readonly entries: ReadonlyArray<AuditEntry>; }) => {
  const columns = React.useMemo<Array<DataColumn<AuditEntry>>>(() => [
    {
      id: "when",
      header: "When",
      accessorFn: (entry) => DateTime.toEpochMillis(entry.at),
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">
          {DateTime.toDateUtc(row.original.at).toISOString().slice(0, 19).replace("T", " ")}
        </span>
      ),
    },
    {
      accessorKey: "actorEmail",
      header: "Who",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.original.actorEmail}</p>
          <p className="text-muted-foreground font-mono text-[10px]">{row.original.actorRole}</p>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
    },
    {
      accessorKey: "outcome",
      header: "Outcome",
      // A denial is the most security-relevant row in here, so it is the one
      // that stands out rather than being buried in successes.
      cell: ({ row }) => (
        <Badge variant={variantFor(row.original.outcome)}>{row.original.outcome}</Badge>
      ),
    },
    {
      accessorKey: "detail",
      header: "Detail",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-[10px]">{row.original.detail}</span>
      ),
    },
  ], []);

  return (
    <DataTable
      rows={props.entries}
      columns={columns}
      filterPlaceholder="Filter the log"
      empty={{
        icon: ScrollText,
        title: "Nothing recorded yet",
        description: "Every change made in this organization is logged here as it happens.",
      }}
    />
  );
};
