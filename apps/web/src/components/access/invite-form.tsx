import { inviteMember } from "@/atom/invite-atoms.js";
import { submitMessage } from "@/lib/form/result.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Link } from "@tanstack/react-router";
import { AppRpc } from "@vantion/core/AppRpc";
import type { Role } from "@vantion/module-iam/identity/Permission";
import { textField } from "@vantion/ui/auth/text-field";
import { RevealWhen } from "@vantion/ui/motion/reveal";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Label } from "@vantion/ui/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vantion/ui/ui/select";
import { Exit, Option, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";

/**
 * Inviting a colleague, from the wizard and from the members screen.
 *
 * One component in both places because the invitation is the same act — the
 * wizard's second step is not a different feature from the one in settings, it
 * is the same one offered at the moment somebody has a reason to use it. A
 * second copy would be the one that stops naming the seat limit.
 *
 * `/settings/members` is where it lives permanently, and this repository had
 * the whole of the receiving half — the email, the accept page, the seat limit
 * — with no way to start one. An invitation flow nobody can begin is a feature
 * that exists only in the tests.
 */

/**
 * Somebody else's address, so the sentences differ from `lib/auth/schemas.ts`'s
 * `Email` and the schema is its own rather than a reused one saying "your".
 * The permissiveness is the same judgement: mail arriving is the only proof.
 */
const InviteeEmail = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter an email address." }),
  Schema.isIncludes("@", { message: "That does not look like an email address." }),
);

/**
 * The role is a **submit argument**, not a field.
 *
 * effect-form fields carry validation, dirty tracking and an error — none of
 * which a select of three fixed values has any use for, since every value it
 * can hold is already valid. Keeping it outside means the form's schema
 * describes what can actually be wrong.
 */
const form = FormReact.make(FormBuilder.empty.addField("email", InviteeEmail), {
  runtime: AppRpc.runtime,
  mode: { validation: "onBlur" },
  onSubmit: (role: Role, { decoded }) => inviteMember({ email: decoded.email, role }),
  fields: {
    email: textField({ label: "Email", type: "email", autoComplete: "off" }),
  },
});

const roles: ReadonlyArray<Role> = ["member", "admin", "owner"];

export const InviteForm = () => {
  const submit = useAtomSet(form.submit, { mode: "promiseExit" });
  const result = useAtomValue(form.submit);
  const reset = useAtomSet(form.reset);
  const submitted = useAtomValue(form.submitCount) > 0;
  const [role, setRole] = React.useState<Role>("member");
  const id = React.useId();

  /**
   * The typed error lives in the result's `Cause`, so it is read out rather
   * than off the result. `InviteFailed` already carries the sentence to show —
   * `submitMessage`'s fallback is for a rejection with nothing to say, and this
   * one has something worth saying.
   */
  const rejection = Option.getOrUndefined(AsyncResult.error(result));
  const noSeats = rejection?._tag === "InviteFailed" && rejection.reason === "NoSeats";

  return (
    <form.Initialize defaultValues={{ email: "" }}>
      <div className="border-border flex flex-wrap items-end gap-2 rounded-md border p-4">
        <form.email submitted={submitted} />

        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>Role</Label>
          <Select value={role} onValueChange={(next) => setRole(next as Role)}>
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          disabled={result.waiting}
          onClick={() => {
            void submit(role).then((exit) => {
              if (Exit.isSuccess(exit)) reset();
            });
          }}
        >
          {result.waiting ? "Sending…" : "Send invitation"}
        </Button>

        <RevealWhen show={result._tag === "Failure"} className="w-full">
          <Alert variant="destructive">
            <AlertDescription>
              {submitMessage(
                result,
                rejection?._tag === "InviteFailed"
                  ? rejection.message
                  : "That invitation could not be sent.",
              )}
              {noSeats && (
                <>
                  {" "}
                  <Link
                    to="/settings/billing"
                    search={{ checkout: undefined }}
                    className="underline underline-offset-4"
                  >
                    See plans
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        </RevealWhen>
      </div>
    </form.Initialize>
  );
};
