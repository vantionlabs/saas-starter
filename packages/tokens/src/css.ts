import { colors, durations, easings, fonts, radius } from "./tokens.js";

/**
 * The stylesheet, rendered from the tokens.
 *
 * Here rather than in `build.mjs` so it can be tested without running the CLI,
 * and so the one thing with logic in this package is typed.
 */
export const renderCss = (): string => {
  const declarations = Object.entries(colors)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");

  // Tailwind 4 reads `@theme inline` to build its utility classes, so every
  // token appears twice: once as the value, once as the utility it backs.
  const theme = Object.keys(colors)
    .map((name) => `  --color-${name}: var(--${name});`)
    .join("\n");

  return `/* Generated from src/tokens.ts by build.mjs. Do not edit. */

:root {
  --radius: ${radius};

${declarations}
}

@theme inline {
${theme}

  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: ${fonts.sans};
  --font-mono: ${fonts.mono};

  --ease-out: ${easings.out};
  --ease-in-out: ${easings.inOut};
  --ease-linear: ${easings.linear};

  --duration-fast: ${durations.fast}ms;
  --duration-base: ${durations.base}ms;
  --duration-slow: ${durations.slow}ms;
}
`;
};
