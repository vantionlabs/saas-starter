import { ScrollText } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

export type StaffTrailRow = {
  readonly id: string;
  readonly staffEmail: string;
  readonly action: string;
  readonly organizationId?: string | undefined;
  readonly reason: string;
  readonly at: string;
};

/**
 * What staff have been doing, which is the one thing on this surface that is
 * not about a customer.
 *
 * The **reason column is the point of the screen** and is given the room to
 * prove it. Every other column says an access happened; only this one says
 * whether it should have, and a table that truncates it to fit a tidy grid is a
 * table nobody can actually review from.
 */
export const StaffTrailTable = (props: {
  readonly entries: ReadonlyArray<StaffTrailRow>;
  readonly onOpenOrganization: (id: string) => void;
}) => {
  if (props.entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Nothing recorded"
        description="No staff member has read across the tenant boundary yet."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-44">When</TableHead>
          <TableHead className="w-56">Who</TableHead>
          <TableHead className="w-40">Did what</TableHead>
          <TableHead className="w-40">To whom</TableHead>
          <TableHead>Why</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {entry.at.slice(0, 19).replace("T", " ")}
            </TableCell>
            <TableCell className="text-sm">{entry.staffEmail}</TableCell>
            <TableCell>
              <Badge variant="outline">{entry.action}</Badge>
            </TableCell>
            <TableCell>
              {entry.organizationId === undefined
                ? (
                  /**
                   * Not an empty cell. A read with no single tenant is a read
                   * of *everybody*, which is the broadest thing anybody can do
                   * here — rendering it as a blank would make the widest
                   * access look like the least.
                   */
                  <span className="text-muted-foreground text-xs italic">every tenant</span>
                )
                : (
                  <button
                    type="button"
                    className="text-primary font-mono text-xs underline underline-offset-2"
                    onClick={() => props.onOpenOrganization(entry.organizationId ?? "")}
                  >
                    {entry.organizationId}
                  </button>
                )}
            </TableCell>
            <TableCell className="text-sm">{entry.reason}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
