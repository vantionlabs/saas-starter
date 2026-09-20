import { submitMessage } from "@/lib/form/result.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { AppRpc } from "@vantion/core/AppRpc";
import { Keys } from "@vantion/core/Keys";
import { EndpointFields } from "@vantion/module-webhooks/WebhooksRpc";
import { textField } from "@vantion/ui/auth/text-field";
import { RevealWhen } from "@vantion/ui/motion/reveal";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Effect, Exit, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

/**
 * Adding an endpoint: a write, and therefore a form, living in the app.
 *
 * The URL rule comes from the contract — `EndpointFields` is what
 * `RegisterEndpoint`'s payload is built from — so the form refuses exactly what
 * the server refuses, including the part that matters: a plain-HTTP address, or
 * one pointing into private network space. That check is the difference between
 * a webhook form and a server-side request forgery with a form in front of it,
 * and declaring it once is what stops the screen and the procedure disagreeing.
 */
const form = FormReact.make(FormBuilder.empty.addField("url", EndpointFields.url), {
  runtime: AppRpc.runtime,
  mode: { validation: "onBlur" },
  /**
   * `billing` as well as `webhooks`, because the usage panel counts endpoints
   * against the plan's limit — adding one changes a number on another screen.
   */
  reactivityKeys: [Keys.webhooks, Keys.billing],
  fields: { url: textField({ label: "Endpoint URL" }) },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("RegisterEndpoint", decoded);
    }),
});

export const EndpointForm = (props: {
  /** Shown once, and only once: we hold the secret but never display it again. */
  readonly onCreated: (secret: string) => void;
}) => {
  const submit = useAtomSet(form.submit, { mode: "promiseExit" });
  const result = useAtomValue(form.submit);
  const reset = useAtomSet(form.reset);
  const submitted = useAtomValue(form.submitCount) > 0;

  /**
   * Running out of endpoints is the one refusal with somewhere to go, so it
   * carries its own sentence and the number — the same rule the invite form
   * follows for seats, and the reason `LimitReached` carries `allowed` at all.
   */
  const rejection = Option.getOrUndefined(AsyncResult.error(result));
  const rejected = rejection?._tag === "LimitReached"
    ? `This plan includes ${rejection.allowed} webhook endpoints.`
    : "That endpoint could not be added.";

  return (
    <form.Initialize defaultValues={{ url: "" }}>
      <div className="border-border flex flex-wrap items-end gap-2 rounded-md border p-4">
        <form.url submitted={submitted} />
        <Button
          type="button"
          disabled={result.waiting}
          onClick={() => {
            void submit(undefined).then((exit) => {
              if (!Exit.isSuccess(exit)) return;

              reset();
              props.onCreated(exit.value.secret);
            });
          }}
        >
          {result.waiting ? "Adding…" : "Add endpoint"}
        </Button>

        <RevealWhen show={result._tag === "Failure"} className="w-full">
          <Alert variant="destructive">
            <AlertDescription>{submitMessage(result, rejected)}</AlertDescription>
          </Alert>
        </RevealWhen>
      </div>
    </form.Initialize>
  );
};
