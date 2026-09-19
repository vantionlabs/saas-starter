import { Schema } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { TestSet } from "./Cases.js";
import type { Baseline } from "./Gate.js";

/**
 * The suite's own parts, importable without running it.
 *
 * `main.ts` calls `runMain` at its top level, which is right for an entry
 * point and wrong for anything a test imports — the first version of this put
 * both here, and importing it to check the test set ran the whole suite.
 */
const HERE = import.meta.dirname;
const BASELINE = path.join(HERE, "..", "baseline.json");

/** Which model answered, as the baseline records it. */
export const modelName = (): string =>
  process.env["ASSISTANT_MODEL"] === "scripted"
    ? "scripted"
    : process.env["OPENROUTER_API_KEY"] === undefined
    ? "unconfigured"
    : process.env["ASSISTANT_MODEL_ID"] ?? "anthropic/claude-haiku-4.5";

export const readTestSet = () =>
  Schema.decodeUnknownEffect(TestSet)(
    parse(fs.readFileSync(path.join(HERE, "..", "cases", "assistant.yaml"), "utf8")),
  );

export const readBaseline = (): Baseline =>
  JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Baseline;
