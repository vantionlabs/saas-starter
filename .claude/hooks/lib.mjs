// Shared plumbing for the hooks in this directory.
//
// A hook is handed JSON on stdin and answers with an exit code. Exit 0 is
// "nothing to say" — for PostToolUse its stdout goes to the debug log and Claude
// never sees it. Exit 2 is how a hook actually reports back: the tool has
// already run, but stderr reaches Claude, which is what lets it fix the thing
// before moving on.

import * as fs from "node:fs";
import * as path from "node:path";

/** The whole of stdin, or `{}` when a hook is run by hand. */
export const readInput = async () => {
  if (process.stdin.isTTY) return {};

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
};

export const projectDir = () =>
  process.env["CLAUDE_PROJECT_DIR"] ?? path.join(import.meta.dirname, "..", "..");

/** Paths a hook has no business touching, whatever the tool just wrote. */
const IGNORED = ["/node_modules/", "/build/", "/repos/", "/.output/", "/dist/", "/.tanstack/"];

export const isCheckableSource = (filePath) =>
  typeof filePath === "string"
  && /\.tsx?$/.test(filePath)
  && !IGNORED.some((part) => filePath.includes(part));

/** Reports findings to Claude and stops. Exit 2 is the only code it reads. */
export const report = (lines) => {
  if (lines.length === 0) process.exit(0);

  process.stderr.write(lines.join("\n") + "\n");
  process.exit(2);
};

/**
 * The nearest package that `tsc -b` understands, walking up from a file.
 *
 * Type-checking the whole reference graph after every edit would cost more than
 * the edit; checking the one package that changed costs a second or two.
 */
export const owningProject = (filePath, root) => {
  let dir = path.dirname(filePath);

  while (dir.startsWith(root) && dir !== root) {
    if (fs.existsSync(path.join(dir, "tsconfig.src.json"))) return dir;
    dir = path.dirname(dir);
  }

  return undefined;
};
