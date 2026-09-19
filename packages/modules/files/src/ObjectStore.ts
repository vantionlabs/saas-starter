import { Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { StorageUnavailable } from "./FilesErrors.js";

export { StorageUnavailable };

/** Where to send the bytes, and how. */
export type Upload = {
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
};

export interface ObjectStoreService {
  /** Whether this deployment stores uploads anywhere durable. */
  readonly durable: boolean;

  /**
   * A URL the browser may write one object to, and nothing else.
   *
   * Presigned rather than proxied: an upload that goes through the API costs a
   * request handler for the length of somebody's slow connection, and the body
   * has to be buffered or streamed through a process whose job is queries.
   */
  readonly presignUpload: (
    key: string,
    options: { readonly contentType: string; readonly expiresInSeconds: number; },
  ) => Effect.Effect<Upload, StorageUnavailable>;

  /** A URL the browser may read one object from, for a short while. */
  readonly presignDownload: (
    key: string,
    options: {
      readonly expiresInSeconds: number;
      /**
       * What the response should claim to be. Storage knows the type it was
       * given at upload; passing the recorded one makes a PDF open as a PDF
       * rather than downloading as bytes, and it is signed so a caller cannot
       * turn somebody's upload into `text/html`.
       */
      readonly contentType?: string | undefined;
    },
  ) => Effect.Effect<string, StorageUnavailable>;

  /**
   * The object's size, or `None` when it is not there.
   *
   * What confirms an upload actually happened. A client saying "done" is a
   * claim; this is the check, and it is also where a file that was replaced
   * mid-upload with something larger gets caught.
   */
  readonly size: (key: string) => Effect.Effect<Option.Option<number>, StorageUnavailable>;

  readonly remove: (key: string) => Effect.Effect<void, StorageUnavailable>;
}

export class ObjectStore extends Context.Service<ObjectStore, ObjectStoreService>()(
  "ObjectStore",
) {
  /**
   * S3 when it is configured, the local disk when it is not.
   *
   * Unlike Stripe, the credential-free layer here does real work rather than
   * refusing. A fresh clone that cannot upload a file cannot demonstrate the
   * feature at all, and unlike a payment there is nothing dangerous about
   * writing to a directory — the bytes are simply not durable, which the port
   * says with `durable: false`.
   */
  static layer: Layer.Layer<ObjectStore> = Layer.unwrap(
    Effect.gen(function*() {
      const bucket = yield* Config.option(Config.nonEmptyString("S3_BUCKET"));
      const accessKeyId = yield* Config.option(Config.redacted("S3_ACCESS_KEY_ID"));

      if (Option.isNone(bucket) || Option.isNone(accessKeyId)) {
        const { layerLocal } = yield* Effect.promise(() => import("./LocalStore.js"));

        return layerLocal;
      }

      const { layerS3 } = yield* Effect.promise(() => import("./S3Store.js"));

      return layerS3({
        bucket: bucket.value,
        region: yield* Config.nonEmptyString("S3_REGION").pipe(Config.withDefault("auto")),
        // Set for R2, MinIO, Tigris and everything else that speaks S3 without
        // being S3. Left unset for AWS itself, whose endpoint the SDK derives.
        endpoint: Option.getOrUndefined(
          yield* Config.option(Config.nonEmptyString("S3_ENDPOINT")),
        ),
        accessKeyId: Redacted.value(accessKeyId.value),
        secretAccessKey: Redacted.value(yield* Config.redacted("S3_SECRET_ACCESS_KEY")),
      });
    }).pipe(Effect.orDie),
  );
}
