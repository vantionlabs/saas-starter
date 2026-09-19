import { sessionAtom } from "@/atom/session-atoms.js";
import {
  registerProviderAtom,
  removeProviderAtom,
  ssoProvidersAtom,
  verifyDomainAtom,
} from "@/atom/sso-atoms.js";
import { getBilling } from "@/server/reads/billing.js";
import { listSsoProviders } from "@/server/reads/sso.js";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { billingAtom } from "@vantion/core/atoms/Billing";
import { has } from "@vantion/module-iam/identity/Entitlement";
import { QueryError } from "@vantion/ui/app/query-error";
import { SsoPanel, verificationRecord } from "@vantion/ui/settings/sso-panel";
import { Button } from "@vantion/ui/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vantion/ui/ui/dialog";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";
import { Cause, Exit, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";
import { toast } from "sonner";

/**
 * The eight things an identity provider's admin console shows you, in the order
 * it usually shows them. Explicit rather than discovered — see `sso-atoms.ts`
 * for why the form cannot simply take an issuer and fetch the rest.
 */
const fields = [
  { key: "domain", label: "Email domain", placeholder: "acme.com" },
  { key: "providerId", label: "Name", placeholder: "acme-okta" },
  { key: "issuer", label: "Issuer", placeholder: "https://acme.okta.com" },
  { key: "clientId", label: "Client ID", placeholder: "" },
  { key: "clientSecret", label: "Client secret", placeholder: "" },
  { key: "authorizationEndpoint", label: "Authorization endpoint", placeholder: "" },
  { key: "tokenEndpoint", label: "Token endpoint", placeholder: "" },
  { key: "jwksEndpoint", label: "JWKS endpoint", placeholder: "" },
] as const;

type Field = (typeof fields)[number]["key"];

const empty: Record<Field, string> = {
  domain: "",
  providerId: "",
  issuer: "",
  clientId: "",
  clientSecret: "",
  authorizationEndpoint: "",
  tokenEndpoint: "",
  jwksEndpoint: "",
};

const Sso = () => {
  const providers = useAtomValue(ssoProvidersAtom);
  const refresh = useAtomRefresh(ssoProvidersAtom);
  const session = useAtomValue(sessionAtom);
  /**
   * The plan lives on the billing state, not on the identity. Reading it here
   * costs a member without `billing:read` the same refusal `/settings/billing`
   * gives them, which is the behaviour that already exists rather than a second
   * one to learn.
   */
  const billing = useAtomValue(billingAtom);

  const register = useAtomSet(registerProviderAtom, { mode: "promiseExit" });
  const remove = useAtomSet(removeProviderAtom, { mode: "promiseExit" });
  const verify = useAtomSet(verifyDomainAtom, { mode: "promiseExit" });

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState(empty);

  /**
   * Shown after registering and never again: the token is what proves the
   * domain, and the only other way to see it is to register the provider a
   * second time.
   */
  const [token, setToken] = React.useState<{ record: string; value: string; } | null>(null);

  if (AsyncResult.isFailure(providers)) {
    return <QueryError result={providers} subject="single sign-on" />;
  }

  /**
   * All three are hydrated before this paints — the providers by this route,
   * the identity and the plan by the ones above it — so this is the
   * unreachable arm rather than a loading state.
   */
  if (
    !AsyncResult.isSuccess(providers) || !AsyncResult.isSuccess(session)
    || !AsyncResult.isSuccess(billing)
  ) {
    return null;
  }

  const identity = session.value;
  const organizationId = identity.orgId;

  /**
   * better-auth returns every provider the caller administers, across
   * organizations. This screen is about one, so it narrows — otherwise an
   * administrator of two tenants sees the other one's identity provider on a
   * page titled with this one's name.
   */
  const mine = providers.value.filter((provider) => provider.organizationId === organizationId);

  const onAdd = async () => {
    setBusy(true);
    const result = await register({ ...draft, organizationId });
    setBusy(false);

    if (!Exit.isSuccess(result)) {
      /**
       * The server's own words when there are any. "This organization's plan
       * does not include single sign-on" is more use than anything this screen
       * could invent, and the endpoint says it precisely.
       */
      const failure = Cause.findErrorOption(result.cause);

      toast.error(
        Option.isSome(failure) ? failure.value.message : "That provider was refused.",
      );
      return;
    }

    setOpen(false);
    setDraft(empty);
    setToken({
      record: verificationRecord(result.value.providerId, result.value.domain),
      value: result.value.domainVerificationToken,
    });
    refresh();
  };

  return (
    <>
      <SsoPanel
        providers={mine.map((provider) => ({
          providerId: provider.providerId,
          domain: provider.domain,
          issuer: provider.issuer,
          domainVerified: provider.domainVerified,
        }))}
        entitled={has(billing.value.effectivePlan, "sso")}
        canManage={identity.permissions.includes("sso:manage")}
        busy={busy}
        onAdd={() => setOpen(true)}
        onRemove={(providerId) => {
          void remove(providerId).then(() => {
            toast.success("Provider removed. Nobody at that domain is sent to it now.");
            refresh();
          });
        }}
        onVerify={(providerId) => {
          void verify(providerId).then((result) => {
            if (Exit.isSuccess(result) && result.value.verified) {
              toast.success("Domain verified. Sign-in through this provider is live.");
            } else {
              toast.error("The record is not visible yet. DNS can take a while to propagate.");
            }
            refresh();
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an identity provider</DialogTitle>
            <DialogDescription>
              Copy these from the OIDC application in your provider's admin console. Nothing is
              fetched from it, so an internal issuer works as well as a hosted one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  value={draft[field.key]}
                  placeholder={field.placeholder}
                  type={field.key === "clientSecret" ? "password" : "text"}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => void onAdd()} disabled={busy}>Add provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={token !== null} onOpenChange={() => setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prove the domain</DialogTitle>
            <DialogDescription>
              The provider exists but routes nobody yet. Add this TXT record, then use
              <strong>Check DNS</strong>. This token is not shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <Label>Record</Label>
              <code className="bg-muted rounded-md px-2 py-1.5 text-xs">{token?.record}</code>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Value</Label>
              <code className="bg-muted rounded-md px-2 py-1.5 text-xs break-all">
                {token?.value}
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const Route = createFileRoute("/_protected/settings/sso")({
  staticData: { crumb: "Single sign-on" },
  /**
   * Two reads, because the screen needs both: the providers it lists and the
   * plan that decides whether single sign-on is available at all. In parallel —
   * neither depends on the other, and doing them in turn would make the page
   * wait for the slower one twice.
   */
  loader: () => Promise.all([listSsoProviders(), getBilling()]),
  component: Sso,
});
