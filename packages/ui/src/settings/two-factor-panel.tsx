import { Check, ShieldAlert } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";

/**
 * Enrolment, in the three states it actually has.
 *
 * Presentational only: the secret, the codes and the password all belong to the
 * route, because this package has no auth client and should not grow one.
 */
export const TwoFactorPanel = (props: {
  readonly enabled: boolean;
  readonly required: boolean;
  readonly busy: boolean;
  readonly onEnable: () => void;
  readonly onDisable: () => void;
}) => (
  <section className="flex flex-col gap-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">Two-factor authentication</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          An app on your phone generates a six-digit code. Even somebody who knows your password
          cannot sign in without it.
        </p>
      </div>

      {props.enabled
        ? (
          <Badge variant="secondary" className="gap-1">
            <Check className="size-3" aria-hidden />
            On
          </Badge>
        )
        : (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <ShieldAlert className="size-3" aria-hidden />
            Off
          </Badge>
        )}
    </div>

    {props.required && !props.enabled
      ? (
        <p className="text-sm">
          Your account administers this deployment, so this is <strong>required</strong>{" "}
          — the admin panel stays closed until it is on.
        </p>
      )
      : null}

    {props.enabled
      ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={props.busy}
          onClick={props.onDisable}
        >
          Turn off
        </Button>
      )
      : (
        <Button className="self-start" disabled={props.busy} onClick={props.onEnable}>
          Set up
        </Button>
      )}
  </section>
);

/**
 * Shown once, after enrolling.
 *
 * The codes are the recovery path for a lost phone and there is no second
 * chance to read them — better-auth stores them hashed, so "show them again"
 * is not a feature anybody can build. Saying so is the difference between a
 * customer who saved them and a support ticket.
 */
export const BackupCodes = (props: { readonly codes: ReadonlyArray<string>; }) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm">
      Save these somewhere safe. Each works once, and <strong>they are not shown again</strong>.
    </p>
    <ul className="bg-muted grid grid-cols-2 gap-1 rounded-md p-3 font-mono text-xs">
      {props.codes.map((code) => <li key={code}>{code}</li>)}
    </ul>
  </div>
);
