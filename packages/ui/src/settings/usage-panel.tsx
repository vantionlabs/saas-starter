import type { Metric, UsageRow } from "@vantion/module-billing/BillingRpc";

const labels: Record<Metric, string> = {
  seats: "Members",
  apiKeys: "API keys",
  webhookEndpoints: "Webhook endpoints",
  storage: "Storage",
};

/**
 * A byte count somebody can read at a glance, which is the only reason this
 * exists: `104857600` and `100 MB` are the same number and only one of them
 * answers "am I nearly out".
 */
const bytes = (value: number) => {
  const mb = value / (1024 * 1024);

  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  if (value === 0) return "0 MB";

  return `${Math.max(1, Math.round(value / 1024))} KB`;
};

const format = (row: UsageRow, value: number) =>
  row.unit === "bytes" ? bytes(value) : String(value);

/**
 * How full each meter is, clamped.
 *
 * Over the limit is possible and is not a bug to hide: a plan downgrade leaves
 * an organization holding more than its new plan allows, and the honest thing
 * is a full bar and a number above the limit rather than a bar off the end of
 * its track.
 */
const share = (row: UsageRow) => row.allowed === 0 ? 1 : Math.min(1, row.used / row.allowed);

/**
 * What the organization is using against what its plan allows.
 *
 * Beside the plan rather than on a page of its own, because the question it
 * answers is always the next one: somebody looks at what they are paying for
 * immediately after being told they cannot invite a fourth colleague. A number
 * with no limit beside it is trivia; a limit with no number beside it is a
 * price list.
 *
 * Entirely prop-driven, so `apps/design` renders the crowded tenant's version —
 * which is the one worth looking at, since a bar is only interesting once it is
 * nearly full.
 */
export const UsagePanel = (props: { readonly rows: ReadonlyArray<UsageRow>; }) => (
  <section className="flex flex-col gap-4">
    <div>
      <h2 className="text-sm font-medium">Usage</h2>
      <p className="text-muted-foreground text-sm">
        What this organization is using against what the plan allows.
      </p>
    </div>

    <dl className="flex flex-col gap-4">
      {props.rows.map((row) => {
        const full = row.used >= row.allowed;

        return (
          <div key={row.metric} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <dt>{labels[row.metric]}</dt>
              <dd className={full ? "text-destructive font-medium" : "text-muted-foreground"}>
                {format(row, row.used)} of {format(row, row.allowed)}
              </dd>
            </div>
            {
              /*
              `progressbar` with its value, not a coloured div. The bar is the
              whole of what this says, and a screen reader that cannot read it
              is left with two numbers and no sense of which is close.
            */
            }
            <div
              role="progressbar"
              aria-label={labels[row.metric]}
              aria-valuemin={0}
              aria-valuemax={row.allowed}
              aria-valuenow={row.used}
              className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
            >
              <div
                className={`h-full rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${share(row) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </dl>
  </section>
);
