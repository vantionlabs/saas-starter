import * as React from "react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";

/**
 * Nothing is read until somebody says why.
 *
 * The form stands between the page and the data rather than beside it, which is
 * the point: a reason box that can be skipped is a reason box that is always
 * empty. Every read behind it lands in `adminAudit` with whatever is typed
 * here, so the field asks for a ticket reference and not a sentence.
 */
export const ReasonPrompt = (props: {
  readonly title: string;
  readonly description: string;
  readonly busy: boolean;
  readonly onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = React.useState("");

  return (
    <section className="flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-base font-semibold">{props.title}</h1>
        <p className="text-muted-foreground text-sm">{props.description}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Why are you looking?</Label>
        <Input
          id="reason"
          value={reason}
          placeholder="SUP-1024"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">Recorded against your name, and kept.</p>
      </div>

      <Button
        className="self-start"
        disabled={props.busy || reason.trim() === ""}
        onClick={() => props.onSubmit(reason)}
      >
        Continue
      </Button>
    </section>
  );
};
