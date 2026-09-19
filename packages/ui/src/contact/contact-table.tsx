import type { Contact, ContactId } from "@vantion/module-contact/ContactRpc";
import { Users } from "lucide-react";
import * as React from "react";
import { Button } from "../ui/button.js";
import { DataTable } from "../ui/data-table.js";
import type { DataColumn } from "../ui/data-table.js";

/**
 * Contacts, which is the list that grows without limit.
 *
 * On `DataTable` rather than plain rows because this is the one a tenant ends
 * up with two thousand of, and at that size a table without sorting or a filter
 * is a table people scroll past rather than use.
 */
export const ContactTable = (props: {
  readonly contacts: ReadonlyArray<Contact>;
  readonly onDelete: (id: ContactId) => void;
}) => {
  /**
   * Memoised because TanStack Table takes the column array as an input: a fresh
   * array every render is a fresh table every render, which throws away sort
   * order and the filter somebody is typing.
   */
  const columns = React.useMemo<Array<DataColumn<Contact>>>(() => [
    { accessorKey: "fullName", header: "Name" },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.email}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => props.onDelete(row.original.id)}
          >
            Delete
          </Button>
        </span>
      ),
    },
  ], [props]);

  return (
    <DataTable
      rows={props.contacts}
      columns={columns}
      filterPlaceholder="Filter contacts"
      empty={{
        icon: Users,
        title: "No contacts yet",
        description: "Contacts are the people this organization keeps track of.",
      }}
    />
  );
};
