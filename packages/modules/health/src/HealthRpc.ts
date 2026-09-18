import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { DatabaseUnreachable, HealthReport } from "./Health.js";

export const HealthRpcs = RpcGroup.make(
  Rpc.make("Ping"),
  Rpc.make("Check", {
    success: HealthReport,
    error: DatabaseUnreachable,
  }),
  /**
   * The same check, repeated, as a stream.
   *
   * It exists to be the worked example of a streaming procedure rather than
   * because a dashboard needs it — a group with no stream in it is a group
   * nobody can copy from, and the websocket transport would be a feature with
   * nothing exercising it.
   *
   * Over HTTP this arrives as ndjson; over the websocket endpoint it arrives as
   * frames on one connection. The declaration is the same either way, which is
   * the point: a handler does not know which transport carried it.
   */
  Rpc.make("Watch", {
    payload: Schema.Struct({
      /** Seconds between reports. Bounded, so a client cannot ask for a flood. */
      every: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 60 })),
    }),
    success: HealthReport,
    error: DatabaseUnreachable,
    stream: true,
  }),
);
