#!/usr/bin/env node
// Refuses a handful of shell commands outright.
//
// Not a security boundary — anything here can be done another way, and a hook
// cannot stop a determined process. It is a guard against the small number of
// irreversible mistakes that are easy to make in one keystroke and expensive to
// undo, on a repository that is public and that other people generate from.

import { readInput } from "./lib.mjs";

const REFUSALS = [
  {
    pattern: /git\s+push\b[^|;&]*(--force(?!-with-lease)|(?:^|\s)-f(?:\s|$))/,
    why:
      "A force push rewrites history other people and every generated repository may already have. Use --force-with-lease, and only deliberately.",
  },
  {
    pattern: /git\s+(commit|merge|rebase)\b[^|;&]*--no-verify/,
    why: "--no-verify skips the checks that keep main green. Fix what it is complaining about.",
  },
  {
    pattern: /(^|[\s;&|])(rm|mv|cp)\s[^|;&]*\brepos\//,
    why:
      "`repos/` is vendored upstream source and the authority this repo reads Effect APIs from. Re-vendor it with `pnpm vendor` instead of editing it by hand.",
  },
  {
    /**
     * Tokenised rather than matched in one expression: the dangerous thing is an
     * *argument* that is exactly a root, a home or the working tree, and a
     * regex boundary around that keeps failing on the one case that matters
     * most — `rm -rf /`, where there is no trailing character to anchor to.
     */
    test: (command) =>
      command.split(/[|;&]/).some((clause) => {
        const words = clause.trim().split(/\s+/);
        if (words[0] !== "rm") return false;

        const recursive = words.some((word) => /^-[a-zA-Z]*[rf]/.test(word));
        if (!recursive) return false;

        return words.slice(1)
          .filter((word) => !word.startsWith("-"))
          .some((word) => ["/", "~", "~/", "$HOME", ".", "..", "/*", "*"].includes(word));
      }),
    why: "That `rm -rf` names a root, a home directory or the whole working tree.",
  },
];

const input = await readInput();
const command = input.tool_input?.command;

if (typeof command !== "string") process.exit(0);

for (const { pattern, test, why } of REFUSALS) {
  if (test === undefined ? pattern.test(command) : test(command)) {
    process.stderr.write(`Refused by .claude/hooks/guard-bash.mjs.\n\n${why}\n`);
    process.exit(2);
  }
}
