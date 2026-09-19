#!/usr/bin/env tsx
/**
 * Syncs the Effect skill guides from `lucas-barake/dotfiles` into
 * `knowledge/skills/`, then re-applies the corrections that bring them in line
 * with the `effect` version pinned in `pnpm-workspace.yaml`.
 *
 * The upstream guides are not pinned to our Effect version and carry API
 * spellings that no longer exist in v4. Every correction below was verified
 * against `repos/effect` before being encoded here. See `AGENTS.md`.
 *
 *   pnpm sync:skills
 *   pnpm sync:skills --dry-run
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Upstream moved, and the corrections below no longer describe it.
 *
 * A failure rather than a warning, and nothing is written: a guide that still
 * carries a v4-invalid API is worse than no guide, because an agent reads it
 * and believes it.
 */
class DriftSurvived extends Data.TaggedError("DriftSurvived")<{
  readonly failures: ReadonlyArray<string>;
}> {
  get message() {
    return [
      "Uncorrected v4 drift survived the sync. Nothing was written.",
      "",
      ...this.failures.map((failure) => `  ${failure}`),
      "",
      "Upstream likely changed. Verify against repos/effect, then update the corrections"
      + " in this script.",
    ].join("\n");
  }
}

class UpstreamUnreadable extends Data.TaggedError("UpstreamUnreadable")<{
  readonly what: string;
}> {
  get message() {
    return this.what;
  }
}

const OWNER = "lucas-barake";
const REPO = "dotfiles";
const REF = "main";
const UPSTREAM_DIR = "ai/canonical/project-skills";

const TARGET_DIR = path.join(import.meta.dirname, "..", "knowledge", "skills");

/** Only the v4 guides. The repo also carries v3 copies we do not want. */
const WANTED = /^effect-.*-v4\.md$/;

/** Ours, not upstream's. Never overwritten. */
const PRESERVE = new Set(["README.md"]);

// --------------------------------------------------------------------------
// Corrections
//
// `file: "*"` applies everywhere. Structural corrections run before the global
// renames, so their `find` text matches upstream verbatim.
// `required: false` means the correction is allowed to not match.
// --------------------------------------------------------------------------

const STRUCTURAL = [
  {
    file: "effect-core-v4.md",
    why: "v4 inverted this: services, Config and errors ARE Effects and pipe directly",
    find: `## Yieldable Protocol and \`asEffect()\`

In v4, many types implement \`Yieldable\`: Effects, services, Options, Results,
Configs, and errors. \`yield*\` in \`Effect.gen\` calls \`.asEffect()\` internally.

**Being yieldable does NOT make something an Effect.** Outside generators, you
must call \`.asEffect()\` explicitly to get a pipeable \`Effect\`:

\`\`\`ts
const program = Effect.gen(function*() {
  const db = yield* Database;
});

const program = Database.asEffect().pipe(
  Effect.flatMap((db) => db.query("SELECT 1")),
);
\`\`\`

What \`.asEffect()\` does per type:

| Type                 | \`.asEffect()\` returns                                         |
| -------------------- | ------------------------------------------------------------- |
| \`Effect<A, E, R>\`    | itself                                                        |
| \`ServiceMap.Service\` | \`Effect<Shape, never, Identifier>\` (reads from fiber context) |
| \`Option.Some<A>\`     | \`Effect.succeed(value)\`                                       |
| \`Option.None\`        | \`Effect.fail(new NoSuchElementError())\`                       |
| \`Result.Success<A>\`  | \`Effect.succeed(value)\`                                       |
| \`Result.Failure<E>\`  | \`Effect.fail(error)\`                                          |
| \`YieldableError\`     | \`Effect.fail(this)\`                                           |
| \`Config<A>\`          | reads from ConfigProvider                                     |

\`Effect.fromYieldable(yieldable)\` is the explicit converter (just calls
\`.asEffect()\`).`,
    replace: `## Yieldable Protocol

In v4, many types are yieldable in \`Effect.gen\`: Effects, services, Options,
Results, Configs, and errors.

Most of them **are** Effects, not merely yieldable, so outside generators you
pipe them directly. There is no \`.asEffect()\` conversion step:

\`\`\`ts
const program = Effect.gen(function*() {
  const db = yield* Database;
});

const program = Database.pipe(
  Effect.flatMap((db) => db.query("SELECT 1")),
);
\`\`\`

| Type              | Outside a generator                                            |
| ----------------- | -------------------------------------------------------------- |
| \`Effect<A, E, R>\` | itself                                                         |
| \`Context.Service\` | already an \`Effect<Shape, never, Identifier>\`; pipe directly   |
| \`Config<A>\`       | already an \`Effect<A, ConfigError>\`; pipe directly             |
| \`YieldableError\`  | already an \`Effect<never, this>\`; pipe directly                |
| \`Option<A>\`       | not an Effect. Convert with \`Effect.fromOption(option)\`        |
| \`Result<A, E>\`    | not an Effect. Convert with \`Effect.fromResult(result)\`        |`,
  },
  {
    file: "effect-core-v4.md",
    why: "Effect.fromYieldable does not exist in v4",
    find: "| Yieldable to Effect       | `service.asEffect()` / `Effect.fromYieldable(x)`    |",
    replace: "| Option/Result to Effect   | `Effect.fromOption(o)` / `Effect.fromResult(r)`     |",
  },
  {
    file: "effect-config-v4.md",
    why: "Config<T> extends Effect<T, ConfigError>",
    find: `Outside generators, call \`.asEffect()\` to get a pipeable
\`Effect<T, ConfigError>\`:

\`\`\`ts
Config.port("PORT").asEffect().pipe(`,
    replace: `\`Config<T>\` extends \`Effect<T, ConfigError>\`, so outside generators you pipe it
directly:

\`\`\`ts
Config.port("PORT").pipe(`,
  },
  {
    file: "effect-config-v4.md",
    why: "same",
    find: "Config.unwrap(config).asEffect().pipe(",
    replace: "Config.unwrap(config).pipe(",
  },
  {
    file: "effect-layers-v4.md",
    why: "a service key IS an Effect",
    find: `### \`.asEffect()\`

Returns \`Effect<Shape, never, Identifier>\`. Equivalent to \`yield*\` but
usable outside generators:

\`\`\`ts
const program = Database.asEffect().pipe(`,
    replace: `### Using a service outside a generator

A service key *is* an \`Effect<Shape, never, Identifier>\`, so pipe it directly:

\`\`\`ts
const program = Database.pipe(`,
  },
  {
    file: "effect-rpc-v4.md",
    why: "service keys pipe directly",
    find: "CurrentUser.asEffect().pipe(Rpc.fork)",
    replace: "CurrentUser.pipe(Rpc.fork)",
  },
  {
    file: "effect-sql-v4.md",
    why: "statements are Effects; no conversion needed",
    find:
      "so `yield* sql\\`...\\``works in generators. In callback based APIs,`.asEffect()` can still be useful.",
    replace:
      "so `yield* sql\\`...\\`` works in generators and the statement can be piped directly outside them.",
  },
  {
    file: "effect-schema-v4.md",
    why: "schemas expose .make(), not .makeUnsafe()",
    find: "`withConstructorDefault`: optional in `makeUnsafe` and class construction.",
    replace: "`withConstructorDefault`: optional in `make` and class construction.",
  },
  {
    file: "effect-rpc-testing-v4.md",
    why: "@effect/platform does not exist in v4",
    find: "import { HttpClient, HttpClientRequest, HttpRouter } from \"@effect/platform\";",
    replace: "import { HttpClient, HttpClientRequest, HttpRouter } from \"effect/unstable/http\";",
  },
  {
    file: "effect-rpc-testing-v4.md",
    why: "SocketServer moved to effect/unstable/socket",
    find: "import { SocketServer } from \"@effect/platform\";",
    replace: "import { SocketServer } from \"effect/unstable/socket\";",
  },
  {
    file: "effect-rpc-testing-v4.md",
    why: "Headers is not exported from the effect root",
    find:
      "| `import { Headers } from \"@effect/platform\"`         | `import { Headers } from \"effect\"`                   |",
    replace:
      "| `import { Headers } from \"@effect/platform\"`         | `import { Headers } from \"effect/unstable/http\"`     |",
  },
  {
    file: "*",
    why: "asEffect is gone; keep it only as a search trigger, not as description prose",
    find: "tap overloads, asEffect() and Yieldable protocol,",
    replace: "tap overloads, Yieldable protocol,",
    required: false,
  },
];

/** Applied to every file, after the structural corrections. */
const RENAMES = [
  { from: /ServiceMap/g, to: "Context", why: "no ServiceMap module in v4" },
  { from: /TaggedErrorClass/g, to: "TaggedError", why: "Schema.TaggedError in v4" },
];

// --------------------------------------------------------------------------
// Guards — if any of these survive, the sync failed and we do not write.
// --------------------------------------------------------------------------

const GUARDS = [
  { re: /ServiceMap/, why: "renamed to Context in v4" },
  { re: /TaggedErrorClass/, why: "Schema.TaggedError in v4" },
  { re: /fromYieldable/, why: "does not exist in v4" },
  {
    re: /from "@effect\/platform"/,
    why: "use effect/unstable/* in v4",
    // Migration-table cells legitimately quote the v3 import.
    allow: /^\|/,
  },
  {
    re: /\.asEffect\(\)/,
    why: "removed in v4",
    // Kept deliberately in the prose that says it is gone, and in search triggers.
    allow: /There is no|Triggers on|^description:/,
  },
];

// --------------------------------------------------------------------------

type Report = { readonly applied: Array<string>; readonly missed: Array<string>; };

const applyCorrections = (name: string, text: string, report: Report) => {
  let out = text;

  for (const c of STRUCTURAL) {
    if (c.file !== "*" && c.file !== name) continue;
    if (out.includes(c.find)) {
      out = out.replaceAll(c.find, c.replace);
      report.applied.push(`${name}: ${c.why}`);
    } else if (c.required !== false) {
      report.missed.push(`${name}: no longer matches upstream — ${c.why}`);
    }
  }

  for (const r of RENAMES) {
    const hits = out.match(r.from)?.length ?? 0;
    if (hits > 0) {
      out = out.replace(r.from, r.to);
      report.applied.push(`${name}: ${hits} x ${r.why}`);
    }
  }

  return out;
};

const checkGuards = (name: string, text: string) => {
  const failures: Array<string> = [];
  text.split("\n").forEach((line, i) => {
    for (const g of GUARDS) {
      if (!g.re.test(line)) continue;
      if (g.allow?.test(line)) continue;
      failures.push(`${name}:${i + 1} ${g.why} — ${line.trim().slice(0, 90)}`);
    }
  });
  return failures;
};

const sync = Effect.fnUntraced(function*(dryRun: boolean) {
  const listUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${UPSTREAM_DIR}?ref=${REF}`;

  const res = yield* Effect.promise(() =>
    fetch(listUrl, { headers: { accept: "application/vnd.github+json" } })
  );

  if (!res.ok) {
    return yield* new UpstreamUnreadable({
      what: `listing ${UPSTREAM_DIR} failed: ${res.status} ${res.statusText}`,
    });
  }

  const listing = (yield* Effect.promise(() => res.json())) as ReadonlyArray<
    { type: string; name: string; download_url: string; }
  >;

  const upstream = listing.filter((entry) => entry.type === "file" && WANTED.test(entry.name));

  if (upstream.length === 0) {
    return yield* new UpstreamUnreadable({
      what: `no files matched ${WANTED} in ${UPSTREAM_DIR}`,
    });
  }

  const report: Report = { applied: [], missed: [] };
  const written: Array<{ name: string; corrected: string; }> = [];
  const failures: Array<string> = [];

  for (const entry of upstream) {
    const raw = yield* Effect.promise(() => fetch(entry.download_url));

    if (!raw.ok) {
      return yield* new UpstreamUnreadable({
        what: `fetching ${entry.name} failed: ${raw.status}`,
      });
    }

    const corrected = applyCorrections(
      entry.name,
      yield* Effect.promise(() => raw.text()),
      report,
    );

    failures.push(...checkGuards(entry.name, corrected));
    written.push({ name: entry.name, corrected });
  }

  if (failures.length > 0) return yield* new DriftSurvived({ failures });

  if (!dryRun) {
    for (const { corrected, name } of written) {
      yield* Effect.promise(() => fs.writeFile(path.join(TARGET_DIR, name), corrected));
    }
  }

  const existing = yield* Effect.promise(() => fs.readdir(TARGET_DIR));
  const upstreamNames = new Set(written.map((w) => w.name));
  const localOnly = existing.filter(
    (file) => file.endsWith(".md") && !upstreamNames.has(file) && !PRESERVE.has(file),
  );

  yield* Console.log(
    `${dryRun ? "[dry run] " : ""}synced ${written.length} guides from ${UPSTREAM_DIR}`,
  );
  yield* Console.log(`corrections applied: ${report.applied.length}`);
  for (const applied of report.applied) yield* Console.log(`  + ${applied}`);

  if (report.missed.length > 0) {
    yield* Console.log(`\ncorrections that no longer match upstream: ${report.missed.length}`);
    for (const missed of report.missed) yield* Console.log(`  ! ${missed}`);
    yield* Console.log("  (upstream changed — re-verify these against repos/effect)");
  }

  if (localOnly.length > 0) {
    yield* Console.log(`\nkept, not present upstream: ${localOnly.join(", ")}`);
  }

  yield* Console.log(`\npreserved: ${[...PRESERVE].join(", ")}`);
});

const command = Command.make(
  "sync-skills",
  {
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Fetch and correct, report what would change, and write nothing."),
    ),
  },
  ({ dryRun }) => sync(dryRun),
);

NodeRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(NodeServices.layer)),
);
