import * as React from "react";
import { useHydrated } from "../lib/use-hydrated.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";

/**
 * Uncontrolled, and that is the whole point on a server-rendered page.
 *
 * This form used to hold both fields in React state. The page is in the
 * document before React attaches to it, so anything typed in that window went
 * into the DOM and never reached the component: the state stayed empty, the
 * button stayed disabled, and the person's typing was discarded with no error
 * anywhere. The browser tests found it as flakiness; a person on a slow
 * connection would have found it as a form that ignores them.
 *
 * The DOM holds the values now and the submit reads them, so text typed before
 * hydration survives it. Nothing here needs to re-render as somebody types,
 * which is the usual reason to control an input and is not a reason that
 * applies.
 */
export const ContactForm = (props: {
  readonly onCreate: (input: { readonly email: string; readonly fullName: string; }) => void;
  readonly pending: boolean;
}) => {
  const hydrated = useHydrated();
  const [problem, setProblem] = React.useState<string | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  const submit = () => {
    const fullName = nameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";

    /**
     * A message, not a disabled button.
     *
     * A control that is dead for a reason it will not state is the harder thing
     * to use: somebody fills one field, finds the button inert and has to guess
     * which one is missing. It also made "disabled" mean two different things —
     * "your input is incomplete" and "React is not ready" — which is exactly
     * the ambiguity that hid the bug above.
     */
    if (fullName === "" || email === "") {
      setProblem("Both a name and an email address are needed.");
      (fullName === "" ? nameRef : emailRef).current?.focus();
      return;
    }

    setProblem(null);
    props.onCreate({ email, fullName });

    if (nameRef.current !== null) nameRef.current.value = "";
    if (emailRef.current !== null) emailRef.current.value = "";
  };

  /** Enter submits, which a `div` full of inputs otherwise does not do. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-border flex flex-wrap items-end gap-2 rounded-md border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input id="contact-name" ref={nameRef} onKeyDown={onKeyDown} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" type="email" ref={emailRef} onKeyDown={onKeyDown} />
      </div>
      <Button
        type="button"
        /**
         * Disabled until React is listening, because until then this button
         * does nothing when pressed. That is honest rather than defensive, and
         * it is also what makes the browser tests deterministic: waiting for it
         * to be enabled is waiting for hydration, which nothing else in the
         * markup says out loud.
         */
        disabled={props.pending || !hydrated}
        onClick={submit}
      >
        Add contact
      </Button>
      {problem !== null && (
        <p role="alert" className="text-destructive w-full text-sm">
          {problem}
        </p>
      )}
    </div>
  );
};
