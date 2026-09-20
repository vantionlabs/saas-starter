import { Building2, Plug, Trash2 } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

/**
 * What the screen renders, narrowed at the boundary so `packages/ui` does not
 * depend on an auth client it cannot see — the same move `SsoProviderRow`
 * makes.
 */
export type ScimConnection = {
  readonly id: string;
  readonly providerId: string;
};

/**
 * Directory provisioning: the identity provider's side of the same deal as
 * single sign-on.
 *
 * SSO decides *who may sign in*; SCIM decides *who exists*. A customer buying
 * both expects somebody removed from their directory on a Friday to lose access
 * without anybody here being told — which is the part that sells, and the part
 * that cannot be done by SSO alone.
 *
 * There is exactly one control that matters and it is worth being blunt about:
 * a token is shown **once**. It is stored hashed, so nothing can show it again,
 * and rotating means deleting the connection and making another.
 */
export const ScimPanel = (props: {
  readonly connections: ReadonlyArray<ScimConnection>;
  /** Whether the plan includes provisioning. Reading is never gated on it. */
  readonly entitled: boolean;
  readonly canManage: boolean;
  readonly busy: boolean;
  /** Where an identity provider should point, shown so nobody has to guess. */
  readonly baseUrl: string;
  readonly onGenerate: () => void;
  readonly onRemove: (providerId: string) => void;
}) => (
  <section className="flex flex-col gap-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">Directory sync</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Let your identity provider create and disable people here automatically. Single sign-on
          decides who may sign in; this decides who exists, so somebody removed from your directory
          loses access without anyone telling us.
        </p>
      </div>

      {props.entitled && props.canManage && (
        <Button onClick={props.onGenerate} disabled={props.busy}>
          New connection
        </Button>
      )}
    </div>

    {!props.entitled
      ? (
        <EmptyState
          icon={Building2}
          title="Not on this plan"
          description="Directory sync is part of the Scale plan. Change the plan in Billing to connect a provider."
        />
      )
      : props.connections.length === 0
      ? (
        <EmptyState
          icon={Plug}
          title="No connection yet"
          description="Generate a token, then paste it into your identity provider alongside the SCIM base URL below."
        />
      )
      : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.connections.map((connection) => (
              <TableRow key={connection.id}>
                <TableCell className="font-mono text-xs">{connection.providerId}</TableCell>
                <TableCell className="text-right">
                  {props.canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={props.busy}
                      onClick={() => props.onRemove(connection.providerId)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

    {props.entitled && (
      <div className="border-border flex flex-col gap-1 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">SCIM base URL</p>
        <code className="text-muted-foreground text-xs">{props.baseUrl}/api/auth/scim/v2</code>
        <p className="text-muted-foreground mt-1 text-xs">
          Okta, Entra and OneLogin all ask for this and a bearer token. Users only — groups are not
          provisioned, so roles stay yours to set here.
        </p>
      </div>
    )}
  </section>
);
