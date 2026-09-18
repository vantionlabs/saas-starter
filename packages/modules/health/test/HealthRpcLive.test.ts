import { HealthRpcs } from "@/HealthRpc.js";
import { HealthRpcLive } from "@/HealthRpcLive.js";
import { describe, expect, it } from "@effect/vitest";
import { PgTest, testDbUrl, withTransactionRollback } from "@vantion/database/PgTest";
import { Effect, Layer, Stream } from "effect";
import { RpcTest } from "effect/unstable/rpc";

// `provideMerge` keeps `SqlClient` in the test context so `withTransactionRollback`
// can reach it, while still feeding it to the handler layer.
const TestLayer = HealthRpcLive.pipe(Layer.provideMerge(PgTest));

describe.skipIf(testDbUrl() === undefined)("HealthRpcLive", () => {
  it.layer(TestLayer)("against a real Postgres", (it) => {
    it.effect("Ping succeeds", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(HealthRpcs);

        expect(yield* client.Ping()).toBeUndefined();
      }));

    /**
     * The worked streaming procedure, over the in-memory transport.
     *
     * `RpcTest` uses the same client and server machinery the websocket and HTTP
     * endpoints use without opening either, so this exercises the handler and
     * the stream framing rather than a socket.
     *
     * One report, not two. That the schedule then repeats is `Schedule.spaced`'s
     * guarantee and Effect's to test; what belongs here is that the handler
     * queries the database and puts a report on the stream, and that the first
     * one does not wait for the interval — a watcher that says nothing until the
     * period elapses looks broken for exactly that long.
     */
    it.effect("Watch reports without waiting for its interval", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(HealthRpcs);

        const reports = yield* client.Watch({ every: 60 }).pipe(
          Stream.take(1),
          Stream.runCollect,
        );

        expect(reports).toHaveLength(1);
        expect(reports[0]?.status).toBe("Ok");
        expect(reports[0]?.database).toBe(true);
      }));

    it.effect("Check reports a reachable database", () =>
      withTransactionRollback(
        Effect.gen(function*() {
          const client = yield* RpcTest.makeClient(HealthRpcs);

          const report = yield* client.Check();

          expect(report.status).toBe("Ok");
          expect(report.database).toBe(true);
        }),
      ));
  });
});
