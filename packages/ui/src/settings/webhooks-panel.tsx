import type { WebhookDelivery, WebhookEndpoint } from "@vantion/module-webhooks/WebhooksRpc";
import { Check, PlugZap, TriangleAlert, Webhook } from "lucide-react";
import type * as React from "react";
import { EmptyState } from "../app/empty-state.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

/**
 * Where a tenant's events go, and what happened when we tried.
 *
 * Both halves on one screen deliberately. A list of URLs answers "is it set
 * up"; only the attempts answer "did you send it", which is the question a
 * customer actually arrives with — and "your server returned 500 eleven times"
 * is a different ticket from "we never tried". The `webhookDelivery` table has
 * existed since delivery shipped and nothing read it until this.
 *
 * Prop-driven like every component here, so `apps/design` renders the states
 * that need a receiver to reach: an endpoint switched off, a run of failures,
 * a plan that does not include webhooks at all.
 */

const shortened = (url: string) => url.length <= 48 ? url : `${url.slice(0, 45)}…`;

const Status = (props: { readonly status: WebhookDelivery["status"]; }) => {
  if (props.status === "delivered") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" aria-hidden />
        Delivered
      </Badge>
    );
  }

  return props.status === "failed"
    ? (
      <Badge variant="outline" className="text-destructive gap-1">
        <TriangleAlert className="size-3" aria-hidden />
        Failed
      </Badge>
    )
    : <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
};

const EndpointRow = (props: {
  readonly endpoint: WebhookEndpoint;
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly onRotate: (id: WebhookEndpoint["id"]) => void;
  readonly onRemove: (id: WebhookEndpoint["id"]) => void;
}) => (
  <TableRow>
    <TableCell className="font-mono text-xs" title={props.endpoint.url}>
      {shortened(props.endpoint.url)}
    </TableCell>
    <TableCell>
      {props.endpoint.active
        ? <Badge variant="secondary">Active</Badge>
        : (
          /*
            Switched off after ten consecutive failures, and said plainly. This
            is the state somebody is looking for when deliveries stopped a week
            ago and nobody noticed — hiding it would make the screen agree with
            their wrong theory.
          */
          <Badge variant="outline" className="text-destructive gap-1">
            <TriangleAlert className="size-3" aria-hidden />
            Switched off
          </Badge>
        )}
    </TableCell>
    <TableCell className="text-muted-foreground text-xs">
      {props.endpoint.consecutiveFailures === 0
        ? "—"
        : `${props.endpoint.consecutiveFailures} in a row`}
    </TableCell>
    <TableCell className="text-right">
      {props.canManage && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={props.busy}
            onClick={() => props.onRotate(props.endpoint.id)}
          >
            Rotate secret
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={props.busy}
            onClick={() => props.onRemove(props.endpoint.id)}
          >
            Remove
          </Button>
        </div>
      )}
    </TableCell>
  </TableRow>
);

export const WebhooksPanel = (props: {
  readonly endpoints: ReadonlyArray<WebhookEndpoint>;
  readonly deliveries: ReadonlyArray<WebhookDelivery>;
  /** Whether the plan includes webhooks at all. Reading is never gated on it. */
  readonly entitled: boolean;
  readonly canManage: boolean;
  readonly busy: boolean;
  /** The registration form, which lives in the app because it is effect-form. */
  readonly form?: React.ReactNode;
  readonly onRotate: (id: WebhookEndpoint["id"]) => void;
  readonly onRemove: (id: WebhookEndpoint["id"]) => void;
}) => (
  <section className="flex flex-col gap-8">
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Webhooks</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          We POST an event to every endpoint here as things happen, signed so you can prove it came
          from us. Deliveries are retried, and an endpoint that fails ten times in a row is switched
          off.
        </p>
      </div>

      {
        /*
          The plan gate stops somebody *adding* an endpoint and never stops them
          seeing the ones they have. An organization that downgraded still needs
          to know why deliveries stopped, and still needs to be able to rotate a
          secret it thinks has leaked.
        */
      }
      {!props.entitled && (
        <EmptyState
          icon={PlugZap}
          title="Not on this plan"
          description="Outbound webhooks are part of the Scale plan. Change the plan in Billing to add an endpoint."
        />
      )}

      {props.entitled && props.canManage && props.form}

      {props.endpoints.length === 0
        ? (
          <EmptyState
            icon={Webhook}
            title="No endpoints yet"
            description="Add a URL and we will start sending events to it."
          />
        )
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Failures</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.endpoints.map((endpoint) => (
                <EndpointRow
                  key={endpoint.id}
                  endpoint={endpoint}
                  canManage={props.canManage}
                  busy={props.busy}
                  onRotate={props.onRotate}
                  onRemove={props.onRemove}
                />
              ))}
            </TableBody>
          </Table>
        )}
    </div>

    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium">Recent deliveries</h2>
        <p className="text-muted-foreground text-sm">
          The last fifty attempts. <code>Webhook-Id</code>{" "}
          carries the event id below, so a receiver can ignore one it has already handled.
        </p>
      </div>

      {props.deliveries.length === 0
        ? (
          <p className="text-muted-foreground border-border rounded-md border border-dashed p-4 text-sm">
            Nothing has been sent yet.
          </p>
        )
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <span className="text-sm">{delivery.kind}</span>
                    <span className="text-muted-foreground block font-mono text-[11px]">
                      {delivery.eventId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Status status={delivery.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {
                      /*
                        The response code and the error, because they are
                        different failures: a 404 is a URL somebody typed wrong
                        and a connection refused is a server that is not there.
                      */
                    }
                    {delivery.responseStatus ?? delivery.lastError ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {delivery.attempts}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {delivery.at.slice(0, 16).replace("T", " ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </div>
  </section>
);
