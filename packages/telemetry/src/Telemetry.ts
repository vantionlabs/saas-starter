// The subpath, not the barrel: the package index also exports `WebSdk`, which
// imports @opentelemetry/sdk-trace-web — a browser dependency this server has no
// reason to install, and whose absence stops the process booting at all.
import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Config, Effect, Option, Redacted } from "effect";

/**
 * Tracing, when somewhere is configured to receive it.
 *
 * `RULES.md` tells contributors not to add manual logging on error paths
 * because "OTEL spans already capture failures and context". That was only true
 * of the spans themselves — nothing exported them, so the context existed and
 * went nowhere. This is the other half.
 *
 * The exporter is installed only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and
 * off is the honest default for a boilerplate: an exporter pointed at nothing
 * retries on a schedule and fills the log with connection failures.
 *
 * That decision is made by *omitting* `spanProcessor` rather than by returning
 * an empty layer. `NodeSdk.layer` already installs a tracer only when it has a
 * processor, and a branch that returns `Layer.empty` types the whole thing as
 * providing nothing — so nothing depends on it, and it is never built at all.
 *
 * `Effect.withSpan` and `Effect.fn` are what produce the spans; this only
 * decides where they go.
 *
 * The same endpoint carries the **metrics** in `packages/telemetry/Metrics.ts`,
 * on the same switch and for the same reason. Spans and aggregates answer
 * different questions — one says what a request did, the other says how deep
 * the outbox is right now — and a deployment that had to configure two
 * destinations to get both would configure one.
 */
export const layerTelemetry = (defaultServiceName: string) =>
  NodeSdk.layer(Effect.gen(function*() {
    const endpoint = yield* Config.option(
      Config.NonEmptyString("OTEL_EXPORTER_OTLP_ENDPOINT"),
    );

    /**
     * Each process names itself, and the environment can override it.
     *
     * The API and the worker fail in different ways for different reasons, and
     * two services reporting under one name is a trace nobody can read.
     */
    const serviceName = yield* Config.NonEmptyString("OTEL_SERVICE_NAME").pipe(
      Config.withDefault(defaultServiceName),
    );

    /**
     * Sent as an `Authorization` header when present, which is what every
     * hosted collector wants. Redacted so a crash trace cannot carry the token.
     */
    const headers = yield* Config.option(Config.Redacted("OTEL_EXPORTER_OTLP_HEADERS"));

    return {
      resource: { serviceName },
      ...(Option.isNone(endpoint) ? {} : {
        /**
         * Pulled on an interval rather than pushed per update: a counter is
         * incremented on hot paths, and exporting each increment would make
         * the collector part of every webhook delivery.
         */
        metricReader: new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${endpoint.value.replace(/\/$/, "")}/v1/metrics`,
            ...(Option.isNone(headers)
              ? {}
              : { headers: { authorization: Redacted.value(headers.value) } }),
          }),
        }),
        // Batched rather than simple: exporting a span per request synchronously
        // would put the collector on the critical path of every response.
        spanProcessor: new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: `${endpoint.value.replace(/\/$/, "")}/v1/traces`,
            ...(Option.isNone(headers)
              ? {}
              : { headers: { authorization: Redacted.value(headers.value) } }),
          }),
        ),
      }),
    };
  }));
