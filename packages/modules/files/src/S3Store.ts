import { Effect, Layer, Option } from "effect";
import { ObjectStore, StorageUnavailable } from "./ObjectStore.js";

/**
 * The durable store, in its own file and imported dynamically, so a deployment
 * without credentials never loads the AWS SDK.
 *
 * Written against the S3 API rather than against AWS: `endpoint` is what makes
 * the same code work on R2, Tigris, MinIO or Backblaze, and that choice belongs
 * to whoever deploys this rather than to this file.
 */
export const layerS3 = (options: {
  readonly bucket: string;
  readonly region: string;
  readonly endpoint: string | undefined;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Layer.Layer<ObjectStore> =>
  Layer.effect(ObjectStore)(
    Effect.gen(function*() {
      const [
        { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client },
        { getSignedUrl },
      ] = yield* Effect.promise(
        () =>
          Promise.all([
            import("@aws-sdk/client-s3"),
            import("@aws-sdk/s3-request-presigner"),
          ]),
      );

      const client = new S3Client({
        region: options.region,
        ...(options.endpoint === undefined
          ? {}
          : { endpoint: options.endpoint, forcePathStyle: true }),
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });

      const unreachable = () => new StorageUnavailable({ reason: "Unreachable" });

      return {
        durable: true,

        presignUpload: (key, request) =>
          Effect.tryPromise({
            try: () =>
              getSignedUrl(
                client,
                new PutObjectCommand({
                  Bucket: options.bucket,
                  Key: key,
                  ContentType: request.contentType,
                }),
                { expiresIn: request.expiresInSeconds },
              ),
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
          Effect.tryPromise({
            try: () =>
              getSignedUrl(
                client,
                new GetObjectCommand({
                  Bucket: options.bucket,
                  Key: key,
                  // Overrides what the object was stored as, and is part of the
                  // signature, so the same rule holds here as locally.
                  ...(request.contentType === undefined
                    ? {}
                    : { ResponseContentType: request.contentType }),
                }),
                { expiresIn: request.expiresInSeconds },
              ),
            catch: unreachable,
          }),

        size: (key) =>
          Effect.tryPromise({
            try: () =>
              client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: key })).then(
                (head) => Option.fromUndefinedOr(head.ContentLength),
              ),
            catch: unreachable,
          }).pipe(
            // A missing object is an answer, not a failure: it is how an
            // abandoned upload is told apart from a broken bucket.
            Effect.catchTag("StorageUnavailable", () => Effect.succeed(Option.none())),
          ),

        remove: (key) =>
          Effect.tryPromise({
            try: () => client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key })),
            catch: unreachable,
          }).pipe(Effect.asVoid),
      };
    }),
  ).pipe(Layer.orDie);
