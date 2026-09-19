import { organization } from "@/server/staff.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ReasonPrompt } from "@vantion/ui/admin/reason-prompt";
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

      <Link to="/" className="text-muted-foreground text-sm underline">
        Back to organizations
      </Link>
    </section>
  );
};

export const Route = createFileRoute("/organizations/$id")({ component: Organization });
