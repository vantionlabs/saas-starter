import { Check, Wrench } from "lucide-react";

/*
 * Adapted from Beautiful UI's Tool Chips (MIT, © 2026 Shane Levine,
 * https://www.beautifului.dev). The original expands each chip into a diff of
 * the edit it made; ours name the tool and say it ran, because that is all we
 * have to show — a tool here returns rows to the model, not a patch.
 */

export const ToolChip = (props: {
  readonly name: string;
  /** False while it is still running. */
  readonly done?: boolean;
}) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-chip bg-inset py-1 pr-2.5 pl-2 font-mono text-[11.5px] text-ink-2 shadow-hairline"
    style={{ animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" }}
  >
    {props.done === false
      ? <Wrench className="size-3" aria-hidden />
      : <Check className="size-3 text-green" aria-hidden />}
    {props.name}
  </span>
);

export const ToolChips = (props: { readonly names: ReadonlyArray<string>; }) => {
  if (props.names.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {props.names.map((name, index) => <ToolChip key={`${index}-${name}`} name={name} />)}
    </div>
  );
};
