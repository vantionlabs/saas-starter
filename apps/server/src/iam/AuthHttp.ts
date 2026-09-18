import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { RateLimiter } from "effect/unstable/persistence";
import { Auth } from "./Auth.js";
import { clientAddress, TrustedProxyCount } from "./ClientAddress.js";

/**
 * Endpoints where throttling *is* the security boundary.
 *
 * A six-digit OTP carries about twenty bits, so it is only as strong as the
 * number of attempts allowed. The same limit protects credential stuffing on
 * sign-in and mail-bombing via magic link.
 */
const CREDENTIAL_PATHS = [
  "/api/auth/sign-in",
  "/api/auth/sign-up",
  "/api/auth/magic-link",
  "/api/auth/email-otp",
  "/api/auth/forget-password",
  "/api/auth/reset-password",
];

const isCredentialPath = (url: string) => CREDENTIAL_PATHS.some((path) => url.startsWith(path));

/**
 * Per-caller identity for the limiter.
 *
 * Keyed on the path as well as the address, so exhausting the sign-in bucket
 * does not also lock the caller out of password reset.
 */
const callerKey = (request: HttpServerRequest.HttpServerRequest, trustedProxies: number) =>
  `auth:${clientAddress(request, trustedProxies)}:${request.url.split("?")[0]}`;

/**
 * Mounts better-auth's own routes under `/api/auth/*`.
 *
 * better-auth speaks web `Request`/`Response`, and v4 converts both ways, so
 * this is a bridge rather than a reimplementation of its endpoints.
 */
export const AuthHttp = Layer.unwrap(
  Effect.gen(function*() {
    // Read once at construction rather than per request: it cannot change while
    // the process runs, and the limiter is on the hot path of every sign-in.
    const trustedProxies = yield* TrustedProxyCount;

    return HttpRouter.add(
      "*",
      "/api/auth/*",
      Effect.fnUntraced(function*(request: HttpServerRequest.HttpServerRequest) {
        const auth = yield* Auth;

        if (request.method === "POST" && isCredentialPath(request.url)) {
          const limiter = yield* RateLimiter.RateLimiter;

          const allowed = yield* limiter.consume({
            key: callerKey(request, trustedProxies),
            limit: 10,
            window: "1 minute",
            onExceeded: "fail",
          }).pipe(
            Effect.as(true),
            // A store failure must not become an outage on the sign-in path, and a
            // exceeded limit is the caller's problem, not a defect.
            Effect.catchTag(
              "RateLimiterError",
              (error) => Effect.succeed(error.reason._tag !== "RateLimitExceeded"),
            ),
          );

          if (!allowed) {
            return HttpServerResponse.text("Too many requests", { status: 429 });
          }
        }

        const webRequest = yield* HttpServerRequest.toWeb(request);
        const webResponse = yield* Effect.promise(() => auth.handler(webRequest));

        return HttpServerResponse.fromWeb(webResponse);
      }),
    );
  }),
);
