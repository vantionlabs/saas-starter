import { Config, Effect, Layer, Option } from "effect";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ObjectStore, StorageUnavailable } from "./ObjectStore.js";

/**
 * Where a deployment without S3 credentials keeps uploads.
 *
 * `.data/uploads` by default, which is gitignored. Not durable — a container
 * restart loses it — and that is what `durable: false` says to anything that
 * asks. It exists so a fresh clone can upload a file, look at it, and delete it
 * without an AWS account, which is the same bargain the mailer makes without a
 * Resend key.
 */
const root = Config.NonEmptyString("FILES_DIR").pipe(Config.withDefault(".data/uploads"));

/**
 * The equivalent of a presigned URL, on our own API.
 *
 * S3 signs a URL with the account's secret; this signs one with `AUTH_SECRET`,
 * over the key and an expiry, so a link cannot be edited into one for somebody
 * else's object and stops working on its own. The same scheme the outbound
 * webhooks use, for the same reason: the timestamp is inside the HMAC.
 */
export const signPath = (options: {
  readonly secret: string;
  readonly key: string;
  readonly expiresAt: number;
  /**
   * What the response should claim to be, when the link is a download.
   *
   * Inside the signature rather than beside it, because a content type a caller
   * can edit is a stored file that can be served as `text/html` — which is a
   * cross-site scripting hole with an upload form in front of it.
   */
  readonly contentType?: string | undefined;
}): string =>
  createHmac("sha256", options.secret)
    .update(`${options.key}.${options.expiresAt}.${options.contentType ?? ""}`)
    .digest("hex");

export const verifyPath = (options: {
  readonly secret: string;
  readonly key: string;
  readonly expiresAt: number;
  readonly signature: string;
  readonly contentType?: string | undefined;
  readonly now?: number;
}): "ok" | "Expired" | "Mismatch" => {
  const now = options.now ?? Math.floor(Date.now() / 1000);

  if (options.expiresAt < now) return "Expired";

  const expected = Buffer.from(signPath(options));
  const presented = Buffer.from(options.signature);

  // Length has to match before `timingSafeEqual`, which throws otherwise — and
  // comparing lengths is not a leak: the digest length is fixed and public.
  if (expected.length !== presented.length) return "Mismatch";

  return timingSafeEqual(expected, presented) ? "ok" : "Mismatch";
};

/** Kept beside the writer so one function decides what a key may look like. */
export const resolveWithin = (directory: string, key: string): string | undefined => {
  const resolved = path.resolve(directory, key);
  const base = path.resolve(directory);

  // A key is ours to generate, never a caller's to choose — but this is the
  // check that makes that true rather than merely intended, and it is the
  // difference between a storage bug and an arbitrary file write.
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : undefined;
};

/** The resolved path, or a refusal — never a path outside the directory. */
const within = (directory: string, key: string) => {
  const resolved = resolveWithin(directory, key);

  return resolved === undefined
    ? Effect.fail(new StorageUnavailable({ reason: "Rejected" }))
    : Effect.succeed(resolved);
};

export const layerLocal: Layer.Layer<ObjectStore> = Layer.effect(ObjectStore)(
  Effect.gen(function*() {
    const directory = yield* root;
    const baseUrl = yield* Config.NonEmptyString("AUTH_BASE_URL").pipe(
      Config.withDefault("http://localhost:3000"),
    );
    const secret = yield* Config.NonEmptyString("AUTH_SECRET").pipe(
      Config.withDefault("local-development-only"),
    );

    const url = (key: string, expiresInSeconds: number, contentType?: string) => {
      const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
      const signature = signPath({ secret, key, expiresAt, contentType });
      const query = new URLSearchParams({ expires: String(expiresAt), signature });

      if (contentType !== undefined) query.set("type", contentType);

      return `${baseUrl.replace(/\/$/, "")}/files/${encodeURI(key)}?${query.toString()}`;
    };

    const fileFor = (key: string) => within(directory, key);

    return {
      durable: false,

      presignUpload: (key, options) =>
        Effect.succeed({
          url: url(key, options.expiresInSeconds),
          method: "PUT" as const,
          headers: { "content-type": options.contentType },
        }),

      presignDownload: (key, options) =>
        Effect.succeed(url(key, options.expiresInSeconds, options.contentType)),

      size: (key) =>
        Effect.gen(function*() {
          const file = yield* fileFor(key);

          return yield* Effect.tryPromise({
            try: () => fs.stat(file).then((stat) => Option.some(stat.size)),
            catch: () => new StorageUnavailable({ reason: "Unreachable" }),
          }).pipe(Effect.catchTag("StorageUnavailable", () => Effect.succeed(Option.none())));
        }),

      remove: (key) =>
        Effect.gen(function*() {
          const file = yield* fileFor(key);

          // A delete of something already gone is a success: the caller wanted
          // it not to be there, and it is not there.
          yield* Effect.promise(() => fs.rm(file, { force: true }));
        }),
    };
  }),
).pipe(Layer.orDie);

/** Writing and reading the bytes, used by the routes this store needs. */
export const writeLocal = (directory: string, key: string, body: Uint8Array) =>
  Effect.gen(function*() {
    const file = yield* within(directory, key);

    yield* Effect.promise(() => fs.mkdir(path.dirname(file), { recursive: true }));
    yield* Effect.promise(() => fs.writeFile(file, body));
  });

export const readLocal = (directory: string, key: string) =>
  Effect.gen(function*() {
    const file = yield* within(directory, key);

    return yield* Effect.tryPromise({
      try: () => fs.readFile(file),
      catch: () => new StorageUnavailable({ reason: "Unreachable" }),
    });
  });
