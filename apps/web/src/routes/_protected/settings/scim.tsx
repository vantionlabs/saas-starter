import {
  deleteScimConnectionAtom,
  generateScimTokenAtom,
  scimConnectionsAtom,
} from "@/atom/scim-atoms.js";
import { sessionAtom } from "@/atom/session-atoms.js";
import { getBilling } from "@/server/reads/billing.js";
import { listScimConnections } from "@/server/reads/scim.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { apiUrl } from "@vantion/core/ApiUrl";
import { billingAtom } from "@vantion/core/atoms/Billing";
import { has } from "@vantion/module-iam/identity/Entitlement";
import { QueryError } from "@vantion/ui/app/query-error";
import { useHydrated } from "@vantion/ui/lib/use-hydrated";
import { ScimPanel } from "@vantion/ui/settings/scim-panel";
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
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const Scim = () => {
  /**
   * Where an identity provider posts: this origin, which forwards
   * `/api/auth/scim/*` to the API like every other auth route.
   *
   * Filled in once React is listening, because the server rendering this page
   * knows its private address and not the one a browser — or an identity
   * provider — reaches it by; rendering either there would disagree with the
   * client.
   */
  const apiBaseUrl = useHydrated() ? apiUrl() : "";
  const connections = useAtomValue(scimConnectionsAtom);
  const billing = useAtomValue(billingAtom);
  const session = useAtomValue(sessionAtom);
  const generate = useAtomSet(generateScimTokenAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteScimConnectionAtom, { mode: "promiseExit" });
  const [busy, setBusy] = React.useState(false);
  /** The one moment a token is on screen. Nothing can show it again. */
  const [token, setToken] = React.useState<string | null>(null);

  const identity = AsyncResult.isSuccess(session) ? session.value : undefined;

  const onGenerate = React.useCallback(() => {
    if (identity === undefined) return;

    setBusy(true);
    /**
     * The provider id is generated rather than asked for. It is an opaque
     * handle an identity provider never sees — the token carries it — and a
     * field for it would be a form asking somebody to invent a name for
     * something they will not refer to again.
     */
    void generate({
      organizationId: identity.orgId,
      providerId: `scim-${crypto.randomUUID().slice(0, 8)}`,
    }).then((exit) => {
      setBusy(false);

      if (!Exit.isSuccess(exit)) return toast.error("That connection could not be created");

      setToken(exit.value.scimToken);
    });
  }, [generate, identity]);

  const onRemove = React.useCallback((providerId: string) => {
    setBusy(true);
    void remove(providerId).then((exit) => {
      setBusy(false);
      if (!Exit.isSuccess(exit)) toast.error("That connection could not be removed");
    });
  }, [remove]);

  if (AsyncResult.isFailure(connections)) {
    return <QueryError result={connections} subject="connections" />;
  }

  /** Hydrated by the loader and by `_protected`, so these are the unreachable arms. */
  const rows = AsyncResult.isSuccess(connections) ? connections.value : [];
  const plan = AsyncResult.isSuccess(billing) ? billing.value.effectivePlan : "free";

  return (
    <>
      <ScimPanel
        connections={rows}
        entitled={has(plan, "scim")}
        canManage={identity?.permissions.includes("scim:manage") ?? false}
        busy={busy}
        baseUrl={apiBaseUrl}
        onGenerate={onGenerate}
        onRemove={onRemove}
      />

      <Dialog open={token !== null} onOpenChange={(next) => !next && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your SCIM token</DialogTitle>
            <DialogDescription>
              Paste it into your identity provider as the bearer token. It is stored hashed, so this
              is the only time it can be shown — to replace it, remove the connection and make
              another.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input readOnly value={token ?? ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(token ?? "");
                toast.success("Copied");
              }}
            >
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const Route = createFileRoute("/_protected/settings/scim")({
  staticData: { crumb: "Directory sync" },
  /** The connections, and the plan — adding one is gated on an entitlement. */
  loader: async () => Promise.all([listScimConnections(), getBilling()]),
  component: Scim,
});
