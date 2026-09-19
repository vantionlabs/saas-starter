import { Building2 } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

export type AdminOrganizationRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly members: number;
  readonly plan: string;
  readonly createdAt: string;
};

/**
 * Every tenant, which is the one screen in this product that shows more than
 * one. Counts only — there is nothing here belonging to any of them.
 */
export const OrganizationTable = (props: {
  readonly organizations: ReadonlyArray<AdminOrganizationRow>;
  readonly onOpen: (id: string) => void;
}) => {
  if (props.organizations.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No organizations"
        description="Nobody has signed up yet."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Plan</TableHead>
          <TableHead className="w-24">Members</TableHead>
          <TableHead className="w-32">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.organizations.map((organization) => (
          <TableRow
            key={organization.id}
            className="cursor-pointer"
            onClick={() => props.onOpen(organization.id)}
          >
            <TableCell>
              <span className="font-medium">{organization.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{organization.slug}</span>
            </TableCell>
            <TableCell>
              <Badge variant={organization.plan === "free" ? "outline" : "secondary"}>
                {organization.plan}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{organization.members}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {organization.createdAt.slice(0, 10)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
