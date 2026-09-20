import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { HttpClient } from "effect/unstable/http";
import { Outbound } from "./Outbound.js";
import { WebhooksRpcLive } from "./WebhooksRpcLive.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * The HTTP client the delivery job needs, and the permit pool that bounds how
 * many requests it may have open. Endpoints and deliveries are functions called
 * inside somebody else's transaction, and the job itself is something a worker
 * chooses to run — neither is a service an application provides.
 *
 * `fetch` rather than a Node-specific client: it is what runs in both the worker
 * and the API, and a delivery that behaves differently depending on which
 * process sent it is a delivery nobody can reason about.
 *
 * `Outbound` is here rather than left to the host because there is one right
 * answer — a number from `WEBHOOK_CONCURRENCY` — and an application that forgot
 * to provide it would be an application with no limit at all.
 */
export const WebhooksModule: Layer.Layer<HttpClient.HttpClient | Outbound> = Layer.mergeAll(
  FetchHttpClient.layer,
  Outbound.layer,
);

/**
 * The settings screen's procedures, exported **separately** from the delivery
 * machinery above.
 *
 * Two exports rather than one, and the compiler is what says so — the same
 * split `IamModule`/`IamHttp` makes. These handlers require `AuthMiddleware`,
 * which only exists where there is a caller; `apps/worker` has none, and
 * folding them into `WebhooksModule` would make the module unregisterable in
 * the one process that does the actual delivering.
 *
 * It is also the honest description: managing endpoints and delivering to them
 * are two jobs that happen in two processes.
 */
export const WebhooksApi = WebhooksRpcLive;
