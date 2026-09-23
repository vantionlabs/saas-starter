import { Config, Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { readLocal, verifyPath, writeLocal } from "./LocalStore.js";

/**
 * The upload and download endpoints the local store signs URLs for.
 *
 * These exist only when there is no S3 bucket. With one, the browser talks to
 * storage directly and this application never sees a byte of anybody's file,
 * which is the arrangement worth having — so these routes are not a fallback
 * that stays wired up, they are absent.
 *
 * Authorisation is the signature and nothing else. There is no session here on
 * purpose: the point of a presigned URL is that it can be handed to a browser,
 * an `<img>` tag or a download manager, none of which will send a cookie to a
 * different origin.
 */
export const FilesHttp = Layer.unwrap(
  Effect.gen(function*() {
    const bucket = yield* Config.option(Config.NonEmptyString("S3_BUCKET"));
    const accessKeyId = yield* Config.option(Config.Redacted("S3_ACCESS_KEY_ID"));

    if (Option.isSome(bucket) && Option.isSome(accessKeyId)) return Layer.empty;

    const directory = yield* Config.NonEmptyString("FILES_DIR").pipe(
      Config.withDefault(".data/uploads"),
    );
    const secret = yield* Config.NonEmptyString("AUTH_SECRET").pipe(
      Config.withDefault("local-development-only"),
    );

    return HttpRouter.add(
      "*",
      // Under `/api`, beside `/api/auth`: the web app forwards this prefix to
      // here, and a bare `/files` is the product's own Files page.
      "/api/files/*",
      Effect.fnUntraced(function*(request: HttpServerRequest.HttpServerRequest) {
        const url = new URL(request.url, "http://files.invalid");
        const key = decodeURIComponent(url.pathname.replace(/^\/api\/files\//, ""));
        const expires = Number(url.searchParams.get("expires"));
        const signature = url.searchParams.get("signature") ?? "";
        const contentType = url.searchParams.get("type") ?? undefined;

        if (key === "" || !Number.isFinite(expires)) {
          return HttpServerResponse.text("bad request", { status: 400 });
        }

        const verdict = verifyPath({ secret, key, expiresAt: expires, signature, contentType });

        // A link that has run out and a link that was never valid get the same
        // answer. Distinguishing them tells somebody probing which half to
        // work on.
        if (verdict !== "ok") return HttpServerResponse.text("forbidden", { status: 403 });

        if (request.method === "PUT") {
          const body = yield* HttpServerRequest.toWeb(request).pipe(
            Effect.flatMap((web) => Effect.promise(() => web.arrayBuffer())),
          );

          yield* writeLocal(directory, key, new Uint8Array(body)).pipe(
            Effect.catchTag(
              "StorageUnavailable",
              () => Effect.succeed(undefined),
            ),
          );

          return HttpServerResponse.text("ok");
        }

        if (request.method !== "GET") {
          return HttpServerResponse.text("method not allowed", { status: 405 });
        }

        return yield* readLocal(directory, key).pipe(
          Effect.map((bytes) =>
            HttpServerResponse.uint8Array(new Uint8Array(bytes), {
              // The signed type, never a guess from the key: the key has no
              // extension, and guessing is how an upload ends up served as
              // something it is not.
              contentType: contentType ?? "application/octet-stream",
            })
          ),
          Effect.catchTag(
            "StorageUnavailable",
            () => Effect.succeed(HttpServerResponse.text("not found", { status: 404 })),
          ),
        );
      }),
    );
  }),
);
