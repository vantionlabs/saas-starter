import { changePassword, renameAccount } from "@/atom/account-atoms.js";
import { sessionAtom } from "@/atom/session-atoms.js";
import { CurrentPassword, NewPassword } from "@/lib/auth/schemas.js";
import { submitMessage } from "@/lib/form/result.js";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute } from "@tanstack/react-router";
import { textField } from "@vantion/ui/auth/text-field";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Separator } from "@vantion/ui/ui/separator";
import { Exit, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

const DisplayName = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter a name." }),
);

const nameForm = FormReact.make(
  FormBuilder.empty.addField("name", DisplayName),
  {
    mode: { validation: "onBlur" },
    fields: { name: textField({ label: "Display name", autoComplete: "name" }) },
    onSubmit: (_, { decoded }) => renameAccount(decoded.name),
  },
);

const passwordForm = FormReact.make(
  FormBuilder.empty
    .addField("currentPassword", CurrentPassword)
    .addField("newPassword", NewPassword),
  {
    mode: { validation: "onBlur" },
    fields: {
      currentPassword: textField({
        label: "Current password",
        type: "password",
        autoComplete: "current-password",
      }),
      newPassword: textField({
        label: "New password",
        type: "password",
        autoComplete: "new-password",
      }),
    },
    onSubmit: (_, { decoded }) => changePassword(decoded),
  },
);

const Profile = () => {
  const session = useAtomValue(sessionAtom);
  const refreshSession = useAtomRefresh(sessionAtom);

  const submitName = useAtomSet(nameForm.submit, { mode: "promiseExit" });
  const nameResult = useAtomValue(nameForm.submit);
  const nameSubmitted = useAtomValue(nameForm.submitCount) > 0;

  const submitPassword = useAtomSet(passwordForm.submit, { mode: "promiseExit" });
  const passwordResult = useAtomValue(passwordForm.submit);
  const passwordReset = useAtomSet(passwordForm.reset);
  const passwordSubmitted = useAtomValue(passwordForm.submitCount) > 0;

  /** Hydrated by `_protected`, so this is the unreachable arm. */
  if (!AsyncResult.isSuccess(session)) return null;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="text-muted-foreground text-sm">
            Your name as colleagues see it, in every organization you belong to.
          </p>
        </div>

        {
          /*
          The address is shown and not editable. Changing it is a verification
          flow of its own — better-auth's `changeEmail` has to mail the new
          address before it takes effect, or an account is stolen by typing —
          and that is a feature rather than a field. `docs/` says so rather than
          this page implying it is coming.
        */
        }
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">Email address</p>
          <p className="font-mono text-sm">{session.value.email}</p>
        </div>

        <nameForm.Initialize defaultValues={{ name: "" }}>
          <div className="flex flex-col gap-4">
            <nameForm.name submitted={nameSubmitted} />
            <Button
              type="button"
              className="self-start"
              disabled={nameResult.waiting}
              onClick={() => {
                void submitName(undefined).then((exit) => {
                  // The shell shows the name, so it has to re-read it.
                  if (Exit.isSuccess(exit)) refreshSession();
                });
              }}
            >
              {nameResult.waiting ? "Saving…" : "Save name"}
            </Button>
            {nameResult._tag === "Failure" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {submitMessage(nameResult, "That name could not be saved.")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </nameForm.Initialize>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Password</h2>
          <p className="text-muted-foreground text-sm">
            Changing it signs out every other session, because the usual reason to change a password
            is that somebody else may know it.
          </p>
        </div>

        <passwordForm.Initialize defaultValues={{ currentPassword: "", newPassword: "" }}>
          <div className="flex flex-col gap-4">
            <passwordForm.currentPassword submitted={passwordSubmitted} />
            <passwordForm.newPassword submitted={passwordSubmitted} />
            <Button
              type="button"
              className="self-start"
              disabled={passwordResult.waiting}
              onClick={() => {
                void submitPassword(undefined).then((exit) => {
                  if (Exit.isSuccess(exit)) passwordReset();
                });
              }}
            >
              {passwordResult.waiting ? "Changing…" : "Change password"}
            </Button>
            {passwordResult._tag === "Failure" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {submitMessage(passwordResult, "That password could not be changed.")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </passwordForm.Initialize>
      </div>
    </section>
  );
};

export const Route = createFileRoute("/_protected/account/")({
  staticData: { crumb: "Profile" },
  component: Profile,
});
