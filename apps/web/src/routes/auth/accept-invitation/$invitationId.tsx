import { sessionAtom } from "@/atom/session-atoms.js";
import { authClient } from "@/iam/auth-client.js";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@vantion/ui/auth/auth-card";
import { Button } from "@vantion/ui/ui/button";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

type State =
  | { readonly _tag: "Pending"; }
  | { readonly _tag: "Accepted"; }
  | { readonly _tag: "Failed"; };

/**
 * Where an invitation email lands.
 *
 * Accepting needs a session, and the person following the link usually does not
 * have one — they were invited precisely because they are not here yet. So the
 * signed-out case is the ordinary path rather than the error: it sends them to
 * sign up, and they come back to this URL afterwards.
 */
const AcceptInvitation = () => {
  const { invitationId } = Route.useParams();
  const signedIn = useAtomValue(sessionAtom, AsyncResult.isSuccess);
  const resolved = useAtomValue(sessionAtom, (session) => !AsyncResult.isInitial(session));
  const refresh = useAtomRefresh(sessionAtom);
  const navigate = useNavigate();
  const [state, setState] = React.useState<State>({ _tag: "Pending" });

  React.useEffect(() => {
    if (!signedIn || state._tag !== "Pending") return;

    void authClient.organization.acceptInvitation({ invitationId }).then((result) => {
      if (result.error !== null && result.error !== undefined) {
        setState({ _tag: "Failed" });
        return;
      }

      // The active organization changed, so the identity the rest of the page
      // reads is stale until it is re-read.
      refresh();
      setState({ _tag: "Accepted" });
    });
  }, [signedIn, invitationId, refresh, state._tag]);

  if (!resolved) {
    return (
      <AuthCard title="One moment" description="Checking whether you are signed in.">
        <span />
      </AuthCard>
    );
  }

  if (!signedIn) {
    return (
      <AuthCard
        title="You have been invited"
        description="Create an account or sign in, and the invitation will be waiting."
        footer={<AuthLink to="/auth/sign-in">I already have an account</AuthLink>}
      >
        <Button
          type="button"
          className="w-full"
          onClick={() => void navigate({ to: "/auth/sign-up" })}
        >
          Create an account
        </Button>
      </AuthCard>
    );
  }

  if (state._tag === "Failed") {
    return (
      <AuthCard
        title="That invitation did not work"
        description="It may have been withdrawn, already used, or sent to a different address."
        footer={<AuthLink to="/">Go to the dashboard</AuthLink>}
      >
        <span />
      </AuthCard>
    );
  }

  if (state._tag === "Accepted") {
    return (
      <AuthCard title="You are in" description="The invitation was accepted.">
        <Button type="button" className="w-full" onClick={() => void navigate({ to: "/" })}>
          Continue
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Accepting your invitation" description="This only takes a moment.">
      <span />
    </AuthCard>
  );
};

export const Route = createFileRoute("/auth/accept-invitation/$invitationId")({
  component: AcceptInvitation,
});
