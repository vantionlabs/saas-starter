/**
 * `alchemy.run.ts`, deployed against nothing.
 *
 *   bun run deploy:dry-run                   every stage, as text
 *   bun run deploy:dry-run --stage staging   one stage
 *   bun run deploy:dry-run --json            what `tooling/test/deploy-offline.test.ts` reads
 *
 * The stack's own program, compiled with the stand-ins in
 * `tooling/OfflineRailway.ts` and an in-memory state store, then planned and
 * applied by Alchemy's real engine. No token, no state database, no network:
 * what it prints is every resource a stage would be made of, its settings, and
 * its variables — secrets masked, references left as the `${{…}}` templates
 * Railway would receive.
 *
 * What it cannot say is whether Railway would accept that. `bun run
 * deploy:plan`, with a token, is the other half.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import * as Alchemy from "alchemy";
import * as Core from "alchemy/Test/Core";
import { Console, Effect, Option, Redacted, References } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { deployment } from "./alchemy.run.ts";
import { offlineRailway, type Planned } from "./tooling/OfflineRailway.ts";

const STAGES = ["staging", "prod"] as const;

/**
 * The same answer on every machine.
 *
 * The engine reads `.env` from the working directory beneath the environment,
 * and an empty variable does not mask it — Effect reads empty as missing and
 * falls through. So a developer's own values, an S3 region or a model id,
 * would appear in the dry run as if the stage had them. It therefore runs from
 * an empty directory, with every variable `.env.example` declares removed from
 * its environment, and placeholders for the two it cannot plan without: a dry
 * run shows where a secret goes, never what it is.
 */
const declared = fs.readFileSync(path.join(import.meta.dirname, ".env.example"), "utf8")
  .matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm);
for (const [, name] of declared) if (name !== undefined) delete process.env[name];
for (const name of ["AUTH_SECRET", "RESEND_API_KEY"]) {
  process.env[name] = `placeholder-${name}`;
}
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "vantion-dry-run-")));

/** One stage, applied against the stand-ins; what they were asked to create. */
const dryRun = (stage: string) => {
  const offline = offlineRailway();
  const state = Alchemy.inMemoryState();
  const options = { providers: offline.providers, state };
  const stack = Alchemy.Stack("vantion", options, deployment);

  return Core.toEffect(Core.deploy(options, stack, { stage }), options).pipe(
    Effect.as(offline.planned),
    // The engine narrates every create; what matters here is the result.
    Effect.provideService(References.MinimumLogLevel, "Warn"),
  );
};

/** Secrets as `<secret>`, so the JSON the test reads carries none either. */
const plain = (value: unknown): unknown => {
  if (Redacted.isRedacted(value)) return "<secret>";
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, inner]) =>
        // The project reference is the whole Project resource; its id is
        // what matters and the stand-in invented it.
        key === "project" || inner === undefined ? [] : [[key, plain(inner)]]
      ),
    );
  }
  return value;
};

const render = (stage: string, planned: ReadonlyArray<Planned>) =>
  [
    `\n${stage}: ${planned.length} resources`,
    ...planned.map(({ type, id, props }) => {
      const lines = [`\n  ${type} "${id}"`];

      for (const [key, value] of Object.entries(plain(props) as Record<string, unknown>)) {
        if (key === "watchPatterns" && Array.isArray(value)) {
          lines.push(`    watchPatterns: ${value.length} paths`);
        } else if (key === "env" && typeof value === "object" && value !== null) {
          lines.push("    env:");
          for (const [name, variable] of Object.entries(value)) {
            lines.push(`      ${name} = ${String(variable)}`);
          }
        } else {
          lines.push(`    ${key}: ${JSON.stringify(value)}`);
        }
      }

      return lines.join("\n");
    }),
  ].join("\n");

const command = Command.make(
  "deploy-dry-run",
  {
    stage: Flag.String("stage").pipe(
      Flag.withDescription(`One stage to dry-run (${STAGES.join(", ")}). Omit for every one.`),
      Flag.optional,
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDescription("Print the planned resources as JSON instead of text."),
      Flag.withDefault(false),
    ),
  },
  Effect.fnUntraced(function*({ stage, json }) {
    const stages = Option.match(stage, { onNone: () => [...STAGES], onSome: (one) => [one] });
    const results: Record<string, unknown> = {};

    for (const name of stages) {
      const planned = yield* dryRun(name);

      if (json) {
        results[name] = planned.map(({ type, id, props }) => ({ type, id, props: plain(props) }));
      } else {
        yield* Console.log(render(name, planned));
      }
    }

    if (json) yield* Console.log(JSON.stringify(results));
  }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
