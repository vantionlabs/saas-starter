#!/usr/bin/env tsx
/**
 * Re-vendors a read-only upstream copy under `repos/`.
 *
 * `git subtree pull` is not used, and cannot be: this repository's history is
 * squashed at publication and every repository generated from the template
 * starts with no history at all, so there is no merge base for a pull to find.
 * Removing the directory and adding the subtree afresh works in any history,
 * and it never conflicts — which `pull --squash` routinely does across a tree
 * this size.
 *
 * TypeScript and `effect/unstable/cli` rather than a `.mjs` reading
 * `process.argv`, because this was the one corner of an otherwise fully typed
 * repository where an argument was a string nobody had checked. What the CLI
 * adds is not ceremony: `--help` that is generated rather than written, an
 * argument validated against the sources that actually exist, and a handler
 * that is an ordinary `Effect` — so the failure modes below are typed errors
 * instead of `process.exit(1)` in four places.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Data, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

type Source = {
  readonly prefix: string;
  readonly url: string;
  readonly ref: string;
  readonly catalogPin: string;
};

const SOURCES: Record<string, Source> = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "vendor-sources.json"), "utf8"),
);

class UnknownSource extends Data.TaggedError("UnknownSource")<{
  readonly name: string;
}> {
  get message() {
    return `unknown source: ${this.name}\nknown: ${Object.keys(SOURCES).join(", ")}`;
  }
}

class TreeNotClean extends Data.TaggedError("TreeNotClean")<{}> {
  get message() {
    return "working tree is not clean — commit or stash first";
  }
}

const git = (...args: ReadonlyArray<string>) =>
  Effect.sync(() => execFileSync("git", [...args], { cwd: ROOT, stdio: "inherit" }));

const isClean = Effect.sync(() =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() === ""
);

const vendor = Effect.fnUntraced(function*(name: string) {
  const source = SOURCES[name];
  if (source === undefined) return yield* new UnknownSource({ name });

  yield* Console.log(`\n==> ${name} (${source.prefix}) from ${source.url}#${source.ref}`);

  if (fs.existsSync(path.join(ROOT, source.prefix))) {
    yield* git("rm", "-r", "--quiet", source.prefix);
    yield* git("commit", "--quiet", "-m", `drop the vendored ${name} copy`);
  }

  yield* git("subtree", "add", `--prefix=${source.prefix}`, source.url, source.ref, "--squash");

  yield* Console.log(
    `    vendored. check it against the \`${source.catalogPin}\` pin in package.json.`,
  );
});

const command = Command.make(
  "vendor",
  {
    names: Argument.String("name").pipe(
      Argument.withDescription("Which source to re-vendor. Omit for every one."),
      Argument.variadic(),
    ),
  },
  Effect.fnUntraced(function*({ names }) {
    const requested = names.length > 0 ? names : Object.keys(SOURCES);

    // Every name is checked before anything is touched, so a typo in the
    // second argument does not leave the first source half re-vendored.
    for (const name of requested) {
      if (SOURCES[name] === undefined) return yield* new UnknownSource({ name });
    }

    /**
     * A dirty tree makes the commits below unreviewable, and `subtree add`
     * refuses one anyway. Fail before touching anything rather than halfway
     * through.
     */
    if (!(yield* isClean)) return yield* new TreeNotClean();

    for (const name of requested) yield* vendor(name);
  }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
