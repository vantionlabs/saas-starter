import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { ApiV1 } from "@vantion/domain/api/v1/Api";
import { AppRpcs } from "@vantion/domain/AppRpcs";
import { ContactModule } from "@vantion/module-contact/Module";
import { HealthHttpRoutes, HealthModule } from "@vantion/module-health/Module";
import { IamHttp, IamModule } from "@vantion/module-iam/Module";
import { NotificationsModule } from "@vantion/module-notifications/Module";
import { Config, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import * as Http from "node:http";
import { ApiV1Live } from "./api/v1/Handlers.js";
import { TelemetryLive } from "./Telemetry.js";

/**
 * `IamModule` appears three times in this file, and is built once.
 *
 * It carries handlers the RPC server needs and services the public API needs —
 * two places a layer is required, not two layers. Effect memoises by reference
 * within a build, so naming it wherever it is needed is the intended way to say
 * that, rather than something to factor out.
 */
const RpcLive = RpcServer.layer(AppRpcs).pipe(
  Layer.provide(IamModule),
  Layer.provide(HealthModule),
  Layer.provide(ContactModule),
  Layer.provide(RpcServer.layerProtocolHttp({ path: "/rpc" })),
  Layer.provide(RpcSerialization.layerNdjson),
);

/**
 * The public API, mounted beside the RPC router rather than inside it.
 *
 * `HttpApiBuilder.layer` also serves the OpenAPI document generated from the
 * same declaration that types the handlers, so the documentation cannot drift
 * from the implementation the way a hand-written one does.
 */
const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(ApiV1, { openapiPath: "/api/v1/openapi.json" }),
  HttpApiScalar.layer(ApiV1, { path: "/api/v1/docs" }),
).pipe(Layer.provide(ApiV1Live));

/**
 * The browser talks to this server directly, from the web app's origin.
 *
 * That makes every request cross-origin, so the browser demands CORS before it
 * will send one — and `credentials` because the session cookie is the whole
 * point. `WEB_URL` is the only origin allowed: it is already the trusted origin
 * better-auth checks, so widening this would let a request through that
 * better-auth then refuses anyway.
 */
const CorsLive = Layer.unwrap(
  Effect.gen(function*() {
    const webUrl = yield* Config.nonEmptyString("WEB_URL").pipe(
      Config.withDefault("http://localhost:5173"),
    );

    return HttpRouter.cors({ allowedOrigins: [webUrl], credentials: true });
  }),
);

const Routes = Layer.mergeAll(RpcLive, IamHttp, HealthHttpRoutes, ApiLive, CorsLive);

const HttpLive = Layer.unwrap(
  Effect.gen(function*() {
    const port = yield* Config.port("PORT").pipe(Config.withDefault(3000));

    // `serve` materialises the requirements the route handlers declared, so the
    // application layers are provided here rather than to `Routes`. `PgPool` is
    // provided once for the whole tree, so layer memoisation guarantees the
    // SqlClient and better-auth share a single connection pool.
    return HttpRouter.serve(Routes).pipe(
      Layer.provide(IamModule),
      Layer.provide(ContactModule),
      // Swap `layerStoreMemory` for `layerStoreRedis` to share limits across workers.
      Layer.provide(RateLimiter.layer),
      Layer.provide(RateLimiter.layerStoreMemory),
      Layer.provide(PgLive),
      Layer.provide(NotificationsModule),
      Layer.provide(PgPool.layer),
      Layer.provide(NodeHttpServer.layer(() => Http.createServer(), { port })),
    );
  }),
);

/**
 * Telemetry is provided to the running effect rather than into the layer graph.
 *
 * The tracer has to be installed in the context the application *runs in* — a
 * layer nothing names as a dependency is not built, so providing it inside the
 * graph silently did nothing at all.
 */
NodeRuntime.runMain(Layer.launch(HttpLive).pipe(Effect.provide(TelemetryLive)));
