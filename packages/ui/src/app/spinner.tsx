import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils.js";

/**
 * The one spinner, for the one case that should still exist.
 *
 * Most of this product's reads arrive with the document — a route's loader runs
 * on the server, so the list is in the HTML and there is nothing to spin for.
 * What remains is work a person just asked for and is waiting on: a mutation in
 * flight, a refetch after one, a file upload.
 *
 * It replaces the `loading…` paragraphs that used to stand in for those. A word
 * in body text reads as content and is indistinguishable from a sentence the
 * page meant to show; a spinner reads as "not yet".
 */
export const Spinner = (props: {
  /** What is being waited for, for a screen reader. Never rendered visually. */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}) => (
  <span role="status" className={cn("inline-flex items-center", props.className)}>
    <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
    {
      /*
      `role="status"` with no accessible name announces nothing, which is the
      failure mode of every spinner nobody tested with a screen reader.
    */
    }
    <span className="sr-only">{props.label ?? "Loading"}</span>
  </span>
);

/**
 * The same thing, centred in the space a panel would occupy.
 *
 * A spinner pinned to the top-left of an empty region makes a page look broken
 * rather than busy.
 */
export const SpinnerPanel = (props: { readonly label?: string | undefined; }) => (
  <div className="flex min-h-32 items-center justify-center">
    <Spinner label={props.label} />
  </div>
);
