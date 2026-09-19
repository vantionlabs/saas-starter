import { ReasonPrompt } from "@/components/reason-prompt.js";
import { organization } from "@/server/queries/organizations.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

type Detail = Awaited<ReturnType<typeof organization>>;

const counts = (detail: Detail) => [
  { label: "Members", value: detail.organization.members },
  { label: "Contacts", value: detail.contacts },
  { label: "Files", value: detail.files },
  { label: "API keys", value: detail.apiKeys },
  { label: "Webhook endpoints", value: detail.webhookEndpoints },
];

/**
 * Counts, never contents.
 *
 * A support engineer answering "is their import stuck" needs to know there are
 * nine hundred contacts, not who they are. Every number here crossed the tenant
 * boundary to get onto the screen, and every one of them is in `adminAudit`
 * under the reason typed below.
 */
const Organization = () => {
  const { id } = Route.useParams();
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (reason: string) => {
    setBusy(true);
    try {
      setDetail(await organization({ data: { id, reason } }));
    } catch {
      // The attempt is recorded either way; what is left is to say so.
      setMissing(true);
    } finally {
      setBusy(false);
    }
  }, [id]);

  if (missing) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-base font-semibold">No such organization</h1>
        <p className="text-muted-foreground text-sm">
          It may have been deleted. The attempt was recorded.
        </p>
        <Link to="/" className="text-sm underline">
          Back to organizations
        </Link>
      </section>
    );
  }

  if (detail === null) {
    return (
      <ReasonPrompt
        title="Open an organization"
        description="You will see counts, never anybody's records."
        busy={busy}
        onSubmit={(reason) => void load(reason)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-base font-semibold">{detail.organization.name}</h1>
        <p className="text-muted-foreground text-sm">
          {detail.organization.slug} · {detail.organization.plan}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {counts(detail).map((count) => (
          <div key={count.label} className="border-border rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">{count.label}</dt>
            <dd className="text-lg font-semibold">{count.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Subscription</h2>
        {detail.subscription === null
          ? (
            /**
             * Never subscribed, which reads differently from cancelled and is
             * a different ticket: one has never been charged, the other has.
             */
            <p className="text-muted-foreground text-sm">
              No subscription has ever been created for this organization.
            </p>
          )
          : (
            <dl className="border-border grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-xs">Status</dt>
                <dd className="text-sm font-medium">{detail.subscription.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Seats paid for</dt>
                <dd className="text-sm font-medium">{detail.subscription.seats}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Period ends</dt>
                <dd className="text-sm font-medium">
                  {detail.subscription.currentPeriodEnd?.slice(0, 10) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Cancelling</dt>
                <dd className="text-sm font-medium">
                  {detail.subscription.cancelAtPeriodEnd ? "at period end" : "no"}
                </dd>
              </div>
            </dl>
          )}
        {detail.subscription !== null && detail.subscription.plan !== detail.organization.plan && (
          /**
           * The two disagreeing is the state worth surfacing rather than
           * leaving somebody to spot: a `canceled` subscription falls back to
           * free while the row still says what was bought.
           */
          <p className="text-muted-foreground text-xs">
            Stripe says{" "}
            <span className="font-medium">{detail.subscription.plan}</span>; the product is
            enforcing <span className="font-medium">{detail.organization.plan}</span>.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Background work</h2>
        <dl className="grid grid-cols-3 gap-4">
          {[
            { label: "Outbox waiting", value: detail.health.outboxPending },
            { label: "Failed deliveries", value: detail.health.failedDeliveries },
            { label: "Endpoints switched off", value: detail.health.disabledEndpoints },
          ].map((count) => (
            <div key={count.label} className="border-border rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">{count.label}</dt>
              <dd
                className={count.value > 0
                  ? "text-destructive text-lg font-semibold"
                  : "text-lg font-semibold"}
              >
                {count.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Link to="/" className="text-muted-foreground text-sm underline">
        Back to organizations
      </Link>
    </section>
  );
};

export const Route = createFileRoute("/organizations/$id")({ component: Organization });
