import { bytesUsed } from "@vantion/module-files/FileStore";
import { CurrentEntitlement } from "@vantion/module-iam/identity/Entitlement";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { apiKeysUsed, seatsUsed } from "@vantion/module-iam/identity/Usage";
import { countForCaller } from "@vantion/module-webhooks/Endpoints";
import { Effect } from "effect";
import { BillingRpcs, UsageRow } from "./BillingRpc.js";

/**
 * Where an organization stands against what its plan allows.
 *
 * It lives in billing because metering is a billing question, and it **composes
 * counts the owning modules export** rather than counting their tables itself:
 * what a seat is belongs to iam, what a byte of storage is belongs to files, and
 * a count written next to the limit is the one that quietly stops matching what
 * the enforcement counts. That divergence is the failure worth naming — a screen
 * saying two of three seats while invitations are being refused sends somebody
 * to support instead of to the upgrade button.
 *
 * Depending on `@vantion/module-files` for one function is the honest cost of
 * that, and the direction is legal: files already depends on iam, billing
 * depends on both, and nothing points back.
 *
 * `webhookEndpoints` was deliberately absent while nothing in the product could
 * register one — a row that could only ever read zero is not a measurement. It
 * arrived with the screen that adds them, which is the rule this file follows:
 * a meter appears when the thing it counts can move.
 */
const megabytes = (mb: number) => mb * 1024 * 1024;

export const usage = Effect.fnUntraced(function*() {
  const entitlement = yield* CurrentEntitlement;
  const { limits } = entitlement;

  /**
   * Four counts, concurrently. They touch different tables and none depends on
   * another, so running them in sequence would make the screen wait for the sum
   * of four round trips to answer one question.
   */
  const [seats, apiKeys, endpoints, bytes] = yield* Effect.all(
    [seatsUsed(), apiKeysUsed(), countForCaller(), bytesUsed],
    { concurrency: 4 },
  );

  return [
    new UsageRow({ metric: "seats", unit: "count", used: seats, allowed: limits.seats }),
    new UsageRow({ metric: "apiKeys", unit: "count", used: apiKeys, allowed: limits.apiKeys }),
    new UsageRow({
      metric: "webhookEndpoints",
      unit: "count",
      used: endpoints,
      allowed: limits.webhookEndpoints,
    }),
    new UsageRow({
      metric: "storage",
      unit: "bytes",
      used: bytes,
      allowed: megabytes(limits.storageMb),
    }),
  ];
});

/**
 * `billing:read`, the same permission the plan panel needs. Usage is what a
 * plan buys, so somebody who may see the bill may see what is being spent
 * against it — and an admin who cannot see it has no way to know why an
 * invitation was refused.
 */
export const GetUsage = BillingRpcs.toLayerHandler(
  "GetUsage",
  () => usage().pipe(withPolicy(permission("billing:read"))),
);
