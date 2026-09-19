import { submitMessage } from "@/lib/form/result.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { AppRpc } from "@vantion/core/AppRpc";
import { Keys } from "@vantion/core/Keys";
import { ContactFields } from "@vantion/module-contact/ContactRpc";
import { textField } from "@vantion/ui/auth/text-field";
import { RevealWhen } from "@vantion/ui/motion/reveal";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Effect, Exit } from "effect";

/**
 * Creating a contact: a write, and therefore a form.
 *
 * It lives in the app rather than in `@vantion/ui`, which is the same place the
 * auth forms live and for the same reason — effect-form binds the submit into
 * the form definition, so a presentational component taking `onCreate` as a
 * prop cannot be one. The version that tried hand-rolled validation, dirty
 * tracking and error display that this already does. `apps/design` renders
 * plain inputs for the layout, as it does for sign-in, because none of that
 * behaviour is how the screen looks.
 *
 * This is the client half of the split: the list on this page is rendered by
 * the server, and the write stays where the person making it is.
 */
const form = FormReact.make(
  FormBuilder.empty
    /**
     * The contract's own field schemas, not a copy. The procedure this submits
     * to is built from the same two, so the form refuses exactly what the
     * server would refuse — and the messages a person reads are declared once,
     * where the rule is.
     */
    .addField("fullName", ContactFields.fullName)
    .addField("email", ContactFields.email),
  {
    /**
     * The RPC client's runtime. Without it `onSubmit` could not reach `AppRpc`
     * — the default is an empty layer.
     */
    runtime: AppRpc.runtime,
    mode: { validation: "onBlur" },
    /**
     * What the write invalidates, declared with the write rather than at the
     * call site — the same rule `packages/core/src/atoms` follows, so "what
     * does this refresh" has one answer next to the thing that does it.
     */
    reactivityKeys: [Keys.contacts],
    fields: {
      fullName: textField({ label: "Name" }),
      email: textField({ label: "Email", type: "email", autoComplete: "email" }),
    },
    onSubmit: (_, { decoded }) =>
      Effect.gen(function*() {
        const client = yield* AppRpc;

        return yield* client("CreateContact", decoded);
      }),
  },
);

export const ContactForm = () => {
  /**
   * `promiseExit`, so the reset can wait for the write without a `useEffect`
   * watching the result. The fields are cleared only on success — clearing
   * them first would throw away what somebody typed if the write failed.
   */
  const submit = useAtomSet(form.submit, { mode: "promiseExit" });
  const result = useAtomValue(form.submit);
  const reset = useAtomSet(form.reset);
  /** Reveal errors from the first submit attempt, not only failed ones. */
  const submitted = useAtomValue(form.submitCount) > 0;

  return (
    <form.Initialize defaultValues={{ fullName: "", email: "" }}>
      <div className="border-border flex flex-wrap items-end gap-2 rounded-md border p-4">
        <form.fullName submitted={submitted} />
        <form.email submitted={submitted} />
        <Button
          type="button"
          disabled={result.waiting}
          onClick={() => {
            void submit(undefined).then((exit) => {
              if (Exit.isSuccess(exit)) reset();
            });
          }}
        >
          {result.waiting ? "Adding…" : "Add contact"}
        </Button>
        {
          /*
          One alert for the two ways a submit fails, which `submitMessage` tells
          apart: the form not validating, or the request being refused. Telling
          somebody to "check the fields" when their permission was denied sends
          them looking in the wrong place.

          `RevealWhen` rather than a conditional, because an element being
          removed cannot animate itself out — by the time React has removed it
          there is nothing left to animate. This is also exactly what motion is
          for here: something that appeared *because a person did something*,
          not content that came down with the page.
        */
        }
        <RevealWhen show={result._tag === "Failure"} className="w-full">
          <Alert variant="destructive">
            <AlertDescription>
              {submitMessage(result, "That contact could not be added.")}
            </AlertDescription>
          </Alert>
        </RevealWhen>
      </div>
    </form.Initialize>
  );
};
