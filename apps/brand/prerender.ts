#!/usr/bin/env tsx
/**
 * Renders the page into the built `index.html`.
 *
 * A landing page's whole job is to be read by somebody who has not decided to
 * wait for a bundle — and by a crawler and a link preview, neither of which
 * runs one. Vite leaves an empty `#root`; this fills it.
 *
 * It imports the SSR bundle Vite just built rather than the source, because the
 * source uses this project's `@` alias and Vite is what knows about it. Running
 * it through tsx alone resolved `@/Site.js` as a package and failed.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Data, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const page = path.join(HERE, "dist", "index.html");
const bundle = path.join(HERE, ".ssr", "render.js");

/**
 * A build step that silently did nothing is the failure worth guarding: the
 * page would still work, and nobody would notice it had stopped being
 * prerendered until a link preview came back blank.
 */
class NothingToFill extends Data.TaggedError("NothingToFill")<{}> {
  get message() {
    return "prerender: could not find the empty #root in dist/index.html";
  }
}

const command = Command.make(
  "prerender",
  {},
  Effect.fnUntraced(function*() {
    const { render } = yield* Effect.promise(
      () => import(pathToFileURL(bundle).href) as Promise<{ render: () => string; }>,
    );

    const markup = render();
    const source = fs.readFileSync(page, "utf8");
    const filled = source.replace(`<div id="root"></div>`, `<div id="root">${markup}</div>`);

    if (filled === source) return yield* new NothingToFill();

    fs.writeFileSync(page, filled);

    yield* Console.log(`prerendered ${markup.length} bytes into dist/index.html`);
  }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
