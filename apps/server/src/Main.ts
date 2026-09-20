import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { ApiV1 } from "@vantion/domain/api/v1/Api";
import { AppRpcs } from "@vantion/domain/AppRpcs";
import { AgentModule } from "@vantion/module-agent/Module";
import { AssistantModule } from "@vantion/module-assistant/Module";
import { BillingHttp, BillingModule } from "@vantion/module-billing/Module";
import { ContactModule } from "@vantion/module-contact/Module";
import { FilesHttp, FilesModule } from "@vantion/module-files/Module";
import { HealthHttpRoutes, HealthModule } from "@vantion/module-health/Module";
import { IamHttp, IamModule } from "@vantion/module-iam/Module";
import { NotificationsModule } from "@vantion/module-notifications/Module";
import { WebhooksApi } from "@vantion/module-webhooks/Module";
import { layerPersistence } from "@vantion/redis/PersistenceLive";
import { layerRateLimitStore } from "@vantion/redis/RateLimitStore";
import { ErrorTracker, layerReporting } from "@vantion/telemetry/ErrorTracker";
import { layerTelemetry } from "@vantion/telemetry/Telemetry";
import { Config, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { ApiV1Live } from "./api/v1/Handlers.js";

/**
 * `IamModule` appears three times in this file, and is built once.
 *
 * It carries handlers the RPC server needs and services the public API needs —
 * two places a layer is required, not two layers. Effect memoises by reference
 * within a build, so naming it wherever it is needed is the intended way to say
 * that, rather than something to factor out.
 */
const RpcLive = RpcServer.layer(AppRpcs).pipe(
  /**
   * The assistant and its toolkit come first, because `Layer.provide` feeds
   * everything above it: the tools need `ContactStore`, which `ContactModule`
   * below supplies, and reversing these two leaves the toolkit unprovidable.
   */
  Layer.provide(AssistantModule),
  Layer.provide(AgentModule),
  Layer.provide(IamModule),
  Layer.provide(HealthModule),
  Layer.provide(ContactModule),
  Layer.provide(BillingModule),
  Layer.provide(FilesModule),
  Layer.provide(WebhooksApi),
  Layer.provide(RpcServer.layerProtocolHttp({ path: "/rpc" })),
  Layer.provide(RpcSerialization.layerNdjson),
);

/**
 * The same procedures again, over a websocket.
 *
 * Most products do not need one, and this costs nothing until a client opens it:
 * it is the same `AppRpcs`, the same handlers and the same modules, with a
 * different protocol underneath. What it buys is streaming — `Health.Watch` is
 * one connection producing reports rather than a poll — and a lower per-call
 * cost once a page is making many.
 *
 * The modules are named twice rather than factored out because a layer is
 * memoised by reference: naming `IamModule` in both graphs builds it once.
 */
const RpcWebsocketLive = RpcServer.layer(AppRpcs).pipe(
  Layer.provide(AssistantModule),
  Layer.provide(AgentModule),
  Layer.provide(IamModule),
  Layer.provide(HealthModule),
  Layer.provide(ContactModule),
  Layer.provide(BillingModule),
  Layer.provide(FilesModule),
  Layer.provide(WebhooksApi),
  Layer.provide(RpcServer.layerProtocolWebsocket({ path: "/rpc/ws" })),
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

const Routes = Layer.mergeAll(
  RpcLive,
  RpcWebsocketLive,
  IamHttp,
  BillingHttp,
  FilesHttp,
  HealthHttpRoutes,
  ApiLive,
  CorsLive,
);

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
      /**
       * Registering this is the whole of turning billing on: it satisfies the
       * `EntitlementResolver` that iam's middleware asks for, and every
       * `feature()` policy starts reading real subscriptions. Swap it for
       * `EntitlementResolver.layerFree` to run the product with billing off.
       */
      Layer.provide(BillingModule),
      /**
       * Where the entitlement cache lives. Redis when `REDIS_URL` is set, this
       * process's memory when it is not — and the difference is that a shared
       * store lets a Stripe webhook drop a cancelled plan on every replica at
       * once rather than only on the one that received it.
       */
      Layer.provide(layerPersistence),
      Layer.provide(FilesModule),
      /**
       * Redis when `REDIS_URL` is set, memory when it is not — and the
       * difference is not a performance one. An in-memory store counts per
       * process, so N replicas give a caller N times the limit, and on the OTP
       * path the limit is the security boundary rather than a politeness
       * measure. This used to be `layerStoreMemory` with a comment suggesting
       * the swap as an option.
       */
      Layer.provide(RateLimiter.layer),
      Layer.provide(layerRateLimitStore),
      Layer.provide(PgLive),
      Layer.provide(NotificationsModule),
      Layer.provide(PgPool.layer),
      Layer.provide(BunHttpServer.layer({ port })),
    );
  }),
);

/**
 * Telemetry and error reporting are provided to the running effect rather than
 * into the layer graph.
 *
 * The tracer has to be installed in the context the application *runs in* — a
 * layer nothing names as a dependency is not built, so providing it inside the
 * graph silently did nothing at all. The reporting logger is here for the same
 * reason, and it has to wrap the launch rather than sit inside it: what it is
 * most needed for is the failure that takes the process down, and a logger
 * installed within the graph is gone by the time that is reported.
 */
BunRuntime.runMain(
  Layer.launch(HttpLive).pipe(
    Effect.provide(layerTelemetry("vantion-server")),
    Effect.provide(layerReporting("api").pipe(Layer.provide(ErrorTracker.layer))),
  ),
);
