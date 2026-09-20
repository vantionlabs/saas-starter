import { Effect, Layer, Option } from "effect";
import { ObjectStore, StorageUnavailable } from "./ObjectStore.js";

/**
 * The durable store, on Bun's own S3 client.
 *
 * It used to be `@aws-sdk/client-s3` plus `@aws-sdk/s3-request-presigner`,
 * loaded through a dynamic `import` so a deployment without credentials never
 * paid for them. Bun ships an S3 client in the runtime, so there is nothing to
 * load and nothing to install: two dependencies left with this change, and one
 * of them is the package whose absence once surfaced as
 * `Cannot find module '@aws-sdk/client-s3'` from a missing `COPY` line.
 *
 * `Bun.S3Client` rather than an import, deliberately. The global exists wherever
 * this file can run and needs no bundler configuration; `ObjectStore.ts` still
 * reaches this module through a dynamic import, so a process with no bucket
 * never evaluates it at all.
 *
 * Still written against the **S3 API** rather than against AWS: `endpoint` is
 * what makes the same code work on R2, Tigris, MinIO or Backblaze, and that
 * choice belongs to whoever deploys this. Bun defaults to path-style addressing,
 * which is what those need — `virtualHostedStyle` is the opt-out and is not
 * taken here.
 */
export const layerS3 = (options: {
  readonly bucket: string;
  readonly region: string;
  readonly endpoint: string | undefined;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Layer.Layer<ObjectStore> =>
  Layer.effect(ObjectStore)(
    Effect.sync(() => {
      const client = new Bun.S3Client({
        bucket: options.bucket,
        region: options.region,
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }),
      });

      const unreachable = () => new StorageUnavailable({ reason: "Unreachable" });

      return {
        durable: true,

        /**
         * `presign` is synchronous here — it signs a string, it does not call
         * anything — which is why this is `Effect.try` rather than the
         * `tryPromise` the SDK needed. Nothing reaches the network until the
         * browser uses the URL.
         */
        presignUpload: (key, request) =>
          Effect.try({
            try: () =>
              client.presign(key, {
                method: "PUT",
                expiresIn: request.expiresInSeconds,
                type: request.contentType,
              }),
            catch: unreachable,
          }).pipe(
            Effect.map((url) => ({
              url,
              method: "PUT" as const,
              // The signature covers this header, so a browser that omits it
              // gets a 403 from storage rather than an object with the wrong
              // type. It is returned so the client cannot guess wrong.
              headers: { "content-type": request.contentType },
            })),
          ),

        presignDownload: (key, request) =>
          Effect.try({
            try: () =>
              client.presign(key, {
                method: "GET",
                expiresIn: request.expiresInSeconds,
                // Overrides what the object was stored as, and is part of the
                // signature, so the same rule holds here as locally.
                ...(request.contentType === undefined ? {} : { type: request.contentType }),
              }),
            catch: unreachable,
          }),

        size: (key) =>
          Effect.tryPromise({
            try: () => client.stat(key),
            catch: unreachable,
          }).pipe(
            Effect.map((stat) => Option.some(stat.size)),
            // A missing object is an answer, not a failure: it is how an
            // abandoned upload is told apart from a broken bucket.
            Effect.catchTag("StorageUnavailable", () => Effect.succeed(Option.none())),
          ),

        remove: (key) =>
          Effect.tryPromise({
            try: () => client.delete(key),
            catch: unreachable,
          }).pipe(Effect.asVoid),
      };
    }),
  ).pipe(Layer.orDie);
