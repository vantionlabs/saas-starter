import { Building2, Check, ShieldAlert } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

/**
 * Only what the screen renders, and nothing this component would have to be
 * changed to keep in step with better-auth. The route passes its own richer
 * provider through; this narrows it at the boundary so `packages/ui` does not
 * depend on an auth client it cannot see.
 */
export type SsoProviderRow = {
  readonly providerId: string;
  readonly domain: string;
  readonly issuer: string;
  readonly domainVerified: boolean;
};

/**
 * The TXT record better-auth looks for, built exactly as it builds it:
 * `_${tokenPrefix}-${providerId}` at the provider's own domain, with the
 * default prefix. Getting this wrong produces a verification that never
 * succeeds and an error message that says only "not verified", so it is derived
 * from one place rather than written out in prose.
 */
export const verificationRecord = (providerId: string, domain: string) =>
  `_better-auth-token-${providerId}.${domain}`;

const Unverified = () => (
  <Badge variant="outline" className="text-muted-foreground gap-1">
    <ShieldAlert className="size-3" aria-hidden />
    Not verified
  </Badge>
);

const Verified = () => (
  <Badge variant="secondary" className="gap-1">
    <Check className="size-3" aria-hidden />
    Verified
  </Badge>
);

export const SsoPanel = (props: {
  readonly providers: ReadonlyArray<SsoProviderRow>;
  readonly entitled: boolean;
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (providerId: string) => void;
  readonly onVerify: (providerId: string) => void;
}) => (
  <section className="flex flex-col gap-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">Single sign-on</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Let people sign in with your company's identity provider. Anyone whose email address ends
          in a verified domain is sent there instead of being asked for a password.
        </p>
      </div>

      {props.entitled && props.canManage
        ? (
          <Button onClick={props.onAdd} disabled={props.busy}>
            Add a provider
          </Button>
        )
        : null}
    </div>

    {!props.entitled
      ? (
        <EmptyState
          icon={Building2}
          title="Not on this plan"
          description="Single sign-on is part of the Scale plan. Change the plan in Billing to switch it on."
        />
      )
      : props.providers.length === 0
      ? (
        <EmptyState
          icon={Building2}
          title="No providers yet"
          description={props.canManage
            ? "Add your identity provider's endpoints, then prove the domain with a DNS record."
            : "An owner or admin of this organization can add one."}
        />
      )
      : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.providers.map((provider) => (
              <TableRow key={provider.providerId}>
                <TableCell className="font-medium">{provider.domain}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{provider.issuer}</TableCell>
                <TableCell>
                  {provider.domainVerified ? <Verified /> : <Unverified />}
                </TableCell>
                <TableCell className="text-right">
                  {props.canManage
                    ? (
                      <div className="flex justify-end gap-1">
                        {provider.domainVerified ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={props.busy}
                            onClick={() => props.onVerify(provider.providerId)}
                          >
                            Check DNS
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={props.busy}
                          onClick={() => props.onRemove(provider.providerId)}
                        >
                          Remove
                        </Button>
                      </div>
                    )
                    : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

    {props.entitled && props.providers.some((provider) => !provider.domainVerified)
      ? (
        <p className="text-muted-foreground max-w-prose text-xs">
          A provider routes nobody until its domain is proved. Add a TXT record at{" "}
          <code className="text-foreground">
            {verificationRecord("<provider>", "<your-domain>")}
          </code>{" "}
          with the token shown when it was added, then use{" "}
          <strong>Check DNS</strong>. Until then people at that domain keep signing in as they do
          now.
        </p>
      )
      : null}
  </section>
);
