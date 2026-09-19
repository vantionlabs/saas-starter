import { Building2, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

export type PersonMembershipRow = {
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string;
};

export type PersonView = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly banned: boolean;
  readonly staff: boolean;
  readonly createdAt: string;
  readonly memberships: ReadonlyArray<PersonMembershipRow>;
};

/**
 * One account, and the tenants it belongs to.
 *
 * This is the only screen here organized by person rather than by organization,
 * because that is how a support ticket arrives: an address, and no idea which
 * customer it belongs to. It carries nothing the person owns — no contacts, no
 * files, not even counts — only where to look next.
 */
export const PersonCard = (props: {
  readonly person: PersonView;
  readonly onOpenOrganization: (id: string) => void;
}) => (
  <section className="flex flex-col gap-6">
    <div className="border-border flex flex-col gap-2 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{props.person.name}</span>
        <span className="text-muted-foreground text-sm">{props.person.email}</span>
        {props.person.staff && (
          <Badge variant="secondary">
            <ShieldCheck className="size-3" aria-hidden />
            Staff
          </Badge>
        )}
        {props.person.banned && <Badge variant="destructive">Banned</Badge>}
        {!props.person.emailVerified && <Badge variant="outline">Unverified</Badge>}
      </div>
      <p className="text-muted-foreground text-xs">
        Signed up {props.person.createdAt.slice(0, 10)} ·{" "}
        <span className="font-mono">{props.person.id}</span>
      </p>
    </div>

    {props.person.memberships.length === 0
      ? (
        /**
         * A real state, not an error: somebody can sign up, never finish, and
         * belong to nothing. Saying so is what stops the next person assuming
         * the lookup broke.
         */
        <p className="text-muted-foreground text-sm">
          This account belongs to no organization.
        </p>
      )
      : (
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4" aria-hidden />
            Organizations
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead className="w-32">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.person.memberships.map((membership) => (
                <TableRow
                  key={membership.organizationId}
                  className="cursor-pointer"
                  onClick={() => props.onOpenOrganization(membership.organizationId)}
                >
                  <TableCell>
                    <span className="font-medium">{membership.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{membership.slug}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{membership.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
  </section>
);
