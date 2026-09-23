import { callerCookie } from "@/server/caller.js";
import { apiOrigin } from "@/server/proxy.js";
import { AppRpcs } from "@vantion/domain/AppRpcs";
import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

/**
 * The RPC client as the *server* uses it, for reads that belong in the document.
 *
 * `packages/core`'s `AppRpc` is the client for a browser and a phone: it sends
 * `credentials: "include"` and lets the platform attach the session. There is no
 * platform here, only the request being handled, so the cookie is forwarded
 * explicitly — the same job `server/session.ts` does for better-auth, for the
 * same reason.
 *
 * This is not a second contract. `AppRpcs` is the same group both ends compile
 * against; what differs is one header and where the effect runs.
 */

/**
 * Server-to-server, so the API's **private** address: the one `server/proxy.ts`
 * forwards the browser's requests to. This call never leaves the project, and
 * routing it through a public hostname would send every server-rendered page
 * out to the load balancer and back.
 */
const rpcUrl = () => `${apiOrigin()}/rpc`;

/**
 * One layer per request, because the caller is per request.
 *
 * Cheap enough to build each time — a `fetch` client and an ndjson codec, no
 * pool and no connection — and the alternative is a module-level client holding
 * one caller's session, which is the shape of bug that serves one tenant's data
 * to another.
 */
const protocol = (cookie: string) =>
  RpcClient.layerProtocolHttp({
    url: rpcUrl(),
    transformClient: HttpClient.mapRequest(HttpClientRequest.setHeader("cookie", cookie)),
  }).pipe(
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(FetchHttpClient.layer),
  );

const makeClient = RpcClient.make(AppRpcs, { flatten: true });

/** The flattened client, named by inference so it cannot drift from the group. */
type Client = Effect.Success<typeof makeClient>;

/**
 * Runs one procedure **as the caller who made this request**.
 *
 * Flattened like `AppRpc`, so a call reads the same on both sides:
 * `serverRpc((client) => client("ListContacts", undefined))`.
 *
 * Authentication is not this function's decision and not the route guard's
 * either: the cookie goes to the API, and `AuthMiddleware` there refuses what
 * it should. A loader that forgot its guard would render an error, not somebody
 * else's data.
 */
export const serverRpc = <A, E>(use: (client: Client) => Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(
    makeClient.pipe(
      Effect.flatMap(use),
      Effect.provide(protocol(callerCookie())),
      Effect.scoped,
    ),
  );
