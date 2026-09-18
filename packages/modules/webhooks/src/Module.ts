import type { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { HttpClient } from "effect/unstable/http";

/**
 * Everything this module implements, as one layer to register.
 *
 * Only the HTTP client the delivery job needs. Endpoints and deliveries are
 * functions called inside somebody else's transaction, and the job itself is
 * something a worker chooses to run — neither is a service an application
 * provides.
 *
 * `fetch` rather than a Node-specific client: it is what runs in both the worker
 * and the API, and a delivery that behaves differently depending on which
 * process sent it is a delivery nobody can reason about.
 */
export const WebhooksModule: Layer.Layer<HttpClient.HttpClient> = FetchHttpClient.layer;
