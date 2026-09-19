import { Email } from "@/lib/auth/schemas.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { AppRpc } from "@vantion/core/AppRpc";
import { Keys } from "@vantion/core/Keys";
import { textField } from "@vantion/ui/auth/text-field";
import { Button } from "@vantion/ui/ui/button";
import { Effect, Exit, Schema } from "effect";

const FullName = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter a name." }),
);

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
    .addField("fullName", FullName)
    .addField("email", Email),
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
      </div>
    </form.Initialize>
  );
};
