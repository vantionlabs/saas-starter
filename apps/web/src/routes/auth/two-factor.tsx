import { sessionAtom } from "@/atom/session-atoms.js";
import { signInWithBackupCode, signInWithTotp } from "@/atom/two-factor-atoms.js";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@vantion/ui/auth/auth-card";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";
import { Cause, Effect, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

/**
 * Where a sign-in stops when the account has a second factor.
 *
 * The password was right — better-auth answers `twoFactorRedirect` rather than
 * a session, and the client sends the browser here. Nothing about this page is
 * optional: without it that response looks like a silent success followed by no
 * session, which is indistinguishable from a broken cookie.
 */
const TwoFactor = () => {
  const [code, setCode] = React.useState("");
  const [backup, setBackup] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const refresh = useAtomRefresh(sessionAtom);
  const signedIn = useAtomValue(sessionAtom, AsyncResult.isSuccess);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (signedIn) void navigate({ to: "/" });
  }, [signedIn, navigate]);

  const submit = async () => {
    setBusy(true);
    setFailed(null);

    const exit = await Effect.runPromiseExit(
      backup ? signInWithBackupCode(code) : signInWithTotp(code),
    );

    setBusy(false);

    if (exit._tag === "Failure") {
      const error = Cause.findErrorOption(exit.cause);

      setFailed(
        Option.isSome(error) ? error.value.message : "That code was not accepted.",
      );

      return;
    }

    // Two steps, as everywhere else here: the code landing is not the same
    // event as the session being readable, and navigating on the first races
    // the second.
    refresh();
  };

  return (
    <AuthCard
      title="One more step"
      description={backup
        ? "Type one of the backup codes you saved."
        : "Type the six-digit code from your authenticator app."}
      footer={
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="text-left underline"
            onClick={() => {
              setBackup(!backup);
              setCode("");
              setFailed(null);
            }}
          >
            {backup ? "Use the app instead" : "Lost your phone? Use a backup code"}
          </button>
          <AuthLink to="/auth/sign-in">Back to sign in</AuthLink>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">{backup ? "Backup code" : "Code"}</Label>
          <Input
            id="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        {failed === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>{failed}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={busy || code === ""}
          onClick={() => void submit()}
        >
          Continue
        </Button>
      </div>
    </AuthCard>
  );
};

export const Route = createFileRoute("/auth/two-factor")({ component: TwoFactor });
