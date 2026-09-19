import { callerCookie } from "@/server/caller.js";
import { apiUrl } from "@vantion/core/ApiUrl";
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
 * Server-to-server, so the **private** address when there is one.
 *
 * `AGENTS.md` is explicit that the web service's `AUTH_BASE_URL` points at the
 * API's private domain: this call never leaves the project, and routing it
 * through the public hostname would send it out to the load balancer and back
 * for every server-rendered page.
 *
 * `apiUrl()` is the fallback and the local answer — it resolves the public
 * `VITE_AUTH_BASE_URL`, which is what a fresh clone has and what the browser
 * uses. Read through `process.env` at run time rather than substituted at build
 * time, because a private hostname is a deployment's fact and not the image's.
 */
const rpcUrl = () => {
  const internal = process.env["AUTH_BASE_URL"];

  return `${
    typeof internal === "string" && internal !== ""
      ? internal.replace(/\/$/, "")
      : apiUrl()
  }/rpc`;
};

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
