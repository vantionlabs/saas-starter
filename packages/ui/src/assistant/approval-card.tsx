import { Check, ShieldQuestion, X } from "lucide-react";
import { Button } from "../ui/button.js";

/*
 * Adapted from Beautiful UI's Approval Card (MIT, © 2026 Shane Levine,
 * https://www.beautifului.dev). The original is a multi-question wizard the
 * agent walks somebody through — three questions, a counter, skip and
 * continue. Ours asks one thing, because that is the shape of the decision the
 * product actually has: the model has proposed a write and will not perform it
 * until this is answered.
 *
 * The card's job is to make the proposal checkable. It names the tool and its
 * arguments rather than summarising them in prose, because what a person is
 * agreeing to is the call, and a paraphrase is the model's account of its own
 * intention.
 */

export const ApprovalCard = (props: {
  readonly tool: string;
  /** The arguments, already rendered as `key: value` text. */
  readonly summary: string;
  readonly busy?: boolean;
  readonly onDecide: (approved: boolean) => void;
  /** Set once answered, so the card states the outcome instead of vanishing. */
  readonly decided?: "approved" | "declined" | undefined;
}) => {
  if (props.decided !== undefined) {
    return (
      <div
        className="flex w-full max-w-md items-center gap-2"
        style={{ animation: "pop-in 260ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        <span
          className={props.decided === "approved"
            ? "inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1.5 text-[12.5px] font-medium text-green"
            : "inline-flex items-center gap-1.5 rounded-full bg-red-tint py-1 pr-2.5 pl-1.5 text-[12.5px] font-medium text-red"}
        >
          {props.decided === "approved"
            ? <Check className="size-3.5" aria-hidden />
            : <X className="size-3.5" aria-hidden />}
          {props.decided === "approved" ? "Approved" : "Declined"}
        </span>
        <span className="font-mono text-[11.5px] text-ink-3">{props.tool}</span>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-md overflow-hidden rounded-card bg-surface shadow-card"
      style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <div className="primitive-card-pad flex flex-col gap-2">
        <div className="flex items-center gap-2 text-ink">
          <ShieldQuestion className="size-4 text-ink-2" aria-hidden />
          <p className="text-[14px] font-medium">Approve this action?</p>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          The assistant will not do this unless you say so.
        </p>
        <p className="rounded-control bg-inset px-2.5 py-2 font-mono text-[12px] break-words text-ink">
          {props.summary}
        </p>
      </div>

      <div className="primitive-card-footer flex items-center justify-end gap-2 border-t border-line">
        <Button
          variant="ghost"
          size="sm"
          disabled={props.busy === true}
          onClick={() => props.onDecide(false)}
        >
          Decline
        </Button>
        <Button size="sm" disabled={props.busy === true} onClick={() => props.onDecide(true)}>
          Approve
        </Button>
      </div>
    </div>
  );
};
