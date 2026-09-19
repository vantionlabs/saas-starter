import { MonitorSmartphone } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

export type SessionRow = {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
};

/**
 * Enough to recognise a session, and nothing that could be used as one.
 *
 * Deliberately not the session token: better-auth returns it on every row and
 * it *is* the credential. A table that rendered it would be one screenshot away
 * from handing somebody an account.
 *
 * The user agent is shortened rather than shown raw — a full UA string is forty
 * characters of version numbers nobody reads, and what a person is actually
 * looking for is "is that my laptop".
 */
const describe = (userAgent: string | null): string => {
  if (userAgent === null || userAgent === "") return "Unknown device";

  const browser = /Firefox\/|Edg\/|Chrome\/|Safari\//.exec(userAgent)?.[0]?.replace(/\/$/, "");
  const platform = /Macintosh|Windows|Linux|iPhone|iPad|Android/.exec(userAgent)?.[0];

  return [browser === "Edg" ? "Edge" : browser, platform].filter(Boolean).join(" on ")
    || "Unknown device";
};

export const SessionTable = (props: { readonly sessions: ReadonlyArray<SessionRow>; }) => {
  if (props.sessions.length === 0) {
    return (
      <EmptyState
        icon={MonitorSmartphone}
        title="No other sessions"
        description="You are only signed in here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Device</TableHead>
          <TableHead className="w-36">Address</TableHead>
          <TableHead className="w-32">Signed in</TableHead>
          <TableHead className="w-32">Expires</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="text-sm">{describe(session.userAgent)}</TableCell>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {session.ipAddress ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {session.createdAt.slice(0, 10)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {session.expiresAt.slice(0, 10)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
