import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { textField } from "@vantion/ui/auth/text-field";
import { Button } from "@vantion/ui/ui/button";
import { Effect, Schema } from "effect";

const Reason = Schema.String.check(
  Schema.isNonEmpty({ message: "A reason is needed — this read is recorded against your name." }),
);

const Address = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter the address to look up." }),
  Schema.isIncludes("@", { message: "Look somebody up by their full address." }),
);

/**
 * Nothing is read until somebody says why.
 *
 * The form stands between the page and the data rather than beside it, which is
 * the point: a reason box that can be skipped is a reason box that is always
 * empty. Every read behind it lands in `adminAudit` with whatever is typed
 * here, so the field asks for a ticket reference and not a sentence.
 *
 * Built with effect-form and living in the app, like every other form in this
 * repository. The previous version was a presentational component in
 * `@vantion/ui` hand-rolling its own validation, which is the work effect-form
 * exists to do — and it could not carry the submit, because a shared component
 * takes its action as a prop and a form definition binds it.
 */

/** The reason alone: listing tenants, or opening one already identified. */
const reasonForm = FormReact.make(
  FormBuilder.empty.addField("reason", Reason),
  {
    mode: { validation: "onBlur" },
    fields: { reason: textField({ label: "Why are you looking?" }) },
    onSubmit: (_, { decoded }) => Effect.succeed(decoded.reason),
  },
);

/** A reason and the address it is about, which is one question in two fields. */
const lookupForm = FormReact.make(
  FormBuilder.empty
    .addField("email", Address)
    .addField("reason", Reason),
  {
    mode: { validation: "onBlur" },
    fields: {
      email: textField({ label: "Email address", type: "email" }),
      reason: textField({ label: "Why are you looking?" }),
    },
    onSubmit: (_, { decoded }) => Effect.succeed(decoded),
  },
);

const Frame = (props: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) => (
  <section className="flex max-w-md flex-col gap-4">
    <div>
      <h1 className="text-base font-semibold">{props.title}</h1>
      <p className="text-muted-foreground text-sm">{props.description}</p>
    </div>
    {props.children}
    <p className="text-muted-foreground text-xs">Recorded against your name, and kept.</p>
  </section>
);

export const ReasonPrompt = (props: {
  readonly title: string;
  readonly description: string;
  readonly busy: boolean;
  readonly onSubmit: (reason: string) => void;
}) => {
  const submit = useAtomSet(reasonForm.submit, { mode: "promiseExit" });
  const result = useAtomValue(reasonForm.submit);
  const submitted = useAtomValue(reasonForm.submitCount) > 0;

  return (
    <Frame title={props.title} description={props.description}>
      <reasonForm.Initialize defaultValues={{ reason: "" }}>
        <div className="flex flex-col gap-4">
          <reasonForm.reason submitted={submitted} />
          <Button
            type="button"
            className="self-start"
            disabled={props.busy || result.waiting}
            onClick={() => {
              void submit(undefined).then((exit) => {
                if (exit._tag === "Success") props.onSubmit(exit.value);
              });
            }}
          >
            Continue
          </Button>
        </div>
      </reasonForm.Initialize>
    </Frame>
  );
};

export const LookupPrompt = (props: {
  readonly title: string;
  readonly description: string;
  readonly busy: boolean;
  readonly onSubmit: (values: { readonly email: string; readonly reason: string; }) => void;
}) => {
  const submit = useAtomSet(lookupForm.submit, { mode: "promiseExit" });
  const result = useAtomValue(lookupForm.submit);
  const submitted = useAtomValue(lookupForm.submitCount) > 0;

  return (
    <Frame title={props.title} description={props.description}>
      <lookupForm.Initialize defaultValues={{ email: "", reason: "" }}>
        <div className="flex flex-col gap-4">
          <lookupForm.email submitted={submitted} />
          <lookupForm.reason submitted={submitted} />
          <Button
            type="button"
            className="self-start"
            disabled={props.busy || result.waiting}
            onClick={() => {
              void submit(undefined).then((exit) => {
                if (exit._tag === "Success") props.onSubmit(exit.value);
              });
            }}
          >
            Continue
          </Button>
        </div>
      </lookupForm.Initialize>
    </Frame>
  );
};
