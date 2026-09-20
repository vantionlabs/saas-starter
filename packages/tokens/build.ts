#!/usr/bin/env tsx
/**
 * Writes `src/tokens.css` from the tokens, or checks that it is current.
 *
 * The stylesheet is committed rather than built on demand: Tailwind reads it at
 * build time, and a generated file missing from the tree is a file the web app
 * cannot start without a prior step. `test/tokens.test.ts` fails when the two
 * drift, which is what keeps "committed" and "generated" from disagreeing.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Data, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as path from "node:path";
import { renderCss } from "./src/css.ts";

const target = path.join(import.meta.dirname, "src", "tokens.css");

class OutOfDate extends Data.TaggedError("OutOfDate")<{}> {
  get message() {
    return "src/tokens.css is out of date. Run `bun run --filter @vantion/tokens build:css`.";
  }
}

const command = Command.make(
  "tokens",
  {
    check: Flag.boolean("check").pipe(
      Flag.withDescription("Fail if the committed stylesheet is not what the tokens render."),
    ),
  },
  Effect.fnUntraced(function*({ check }) {
    const rendered = renderCss();

    if (check) {
      const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";

      if (current !== rendered) return yield* new OutOfDate();

      return yield* Console.log("tokens.css is current");
    }

    fs.writeFileSync(target, rendered);

    yield* Console.log(`wrote ${path.relative(process.cwd(), target)}`);
  }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
