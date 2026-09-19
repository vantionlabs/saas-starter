import { Ban, Check } from "lucide-react";

/*
 * Adapted from Beautiful UI's Tool Chips (MIT, © 2026 Shane Levine,
 * https://www.beautifului.dev). The original expands each chip into a diff of
 * the edit it made; ours name the tool and say it ran, because that is all we
 * have to show — a tool here returns rows to the model, not a patch.
 */

export const ToolChip = (props: {
  readonly name: string;
  /** The permission it lacked, when the tool refused rather than ran. */
  readonly refused?: string | undefined;
}) => (
  <span
    className={props.refused === undefined
      ? "inline-flex items-center gap-1.5 rounded-chip bg-inset py-1 pr-2.5 pl-2 font-mono text-[11.5px] text-ink-2 shadow-hairline"
      : "inline-flex items-center gap-1.5 rounded-chip bg-red-tint py-1 pr-2.5 pl-2 font-mono text-[11.5px] text-red"}
    style={{ animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" }}
  >
    {props.refused === undefined
      ? <Check className="size-3 text-green" aria-hidden />
      : <Ban className="size-3" aria-hidden />}
    {props.name}
    {
      /*
      The permission is named rather than "not allowed", because that is the
      thing somebody has to go and ask an admin for.
    */
    }
    {props.refused !== undefined && <span className="opacity-80">· {props.refused}</span>}
  </span>
);

export const ToolChips = (props: {
  readonly tools: ReadonlyArray<{ readonly name: string; readonly refused?: string | undefined; }>;
}) => {
  if (props.tools.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {props.tools.map((tool, index) => (
        <ToolChip key={`${index}-${tool.name}`} name={tool.name} refused={tool.refused} />
      ))}
    </div>
  );
};
