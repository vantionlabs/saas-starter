import type { Baseline } from "./Gate.js";
import { percent, type Verdict } from "./Gate.js";
import type { CategoryResult, Graded } from "./Grade.js";

/** The summary a pull request gets. */
export const markdown = (options: {
  readonly model: string;
  readonly results: ReadonlyArray<CategoryResult>;
  readonly graded: ReadonlyArray<Graded>;
  readonly baseline: Baseline;
  readonly verdict: Verdict;
}): string => {
  const lines: Array<string> = [];

  lines.push(options.verdict.ok ? "## ✅ No regressions" : "## ❌ Regression");
  lines.push("");
  lines.push(`Model: \`${options.model}\``);
  lines.push("");
  lines.push("| Category | Cases | Pass rate | Baseline | Critical failures | p50 |");
  lines.push("| --- | ---: | ---: | ---: | --- | ---: |");

  for (const result of options.results) {
    const rows = options.graded.filter((row) => row.category === result.category);
    const before = options.baseline.categories[result.category];

    lines.push(
      `| ${result.category} | ${result.cases} | ${percent(result.passRate)} | `
        + `${before === undefined ? "—" : percent(before)} | `
        + `${result.criticalFailures.length === 0 ? "none" : result.criticalFailures.join(", ")} | `
        + `${median(rows.map((row) => row.millis))}ms |`,
    );
  }

  const failed = options.graded.filter((row) => !row.passed);

  if (failed.length > 0) {
    lines.push("");
    lines.push("### Failing cases");

    for (const row of failed) {
      lines.push("");
      lines.push(`**${row.id}** (${row.severity})`);

      for (const check of row.checks.filter((check) => !check.passed)) {
        lines.push(`- ${check.name} — ${check.detail}`);
      }
    }
  }

  if (!options.verdict.ok) {
    lines.push("");

    for (const reason of options.verdict.reasons) lines.push(`- ${reason}`);
  }

  return lines.join("\n");
};

const median = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
