/**
 * The design system's values, and the only place they are written down.
 *
 * TypeScript rather than CSS is the source because three consumers need them and
 * only one of them speaks CSS: the web app through generated custom properties,
 * the Expo app through NativeWind, and Figma through the library generator,
 * which turns these into Figma variables. A palette that lives in a stylesheet
 * can be read by one of those three.
 *
 * `src/tokens.css` is generated from this file by `pnpm --filter @vantion/tokens
 * build`, and a test fails if the two drift.
 */

/**
 * Colour carries status and action, never decoration — which is why this palette
 * is small and nearly monochrome apart from `primary` and `destructive`.
 *
 * The names are the shadcn contract. Keeping them means the primitives in
 * `packages/ui` need no mapping layer, and a component copied from shadcn's docs
 * works unmodified.
 */
export const colors = {
  background: "oklch(0.145 0.005 285)",
  foreground: "oklch(0.95 0 0)",
  card: "oklch(0.185 0.005 285)",
  "card-foreground": "oklch(0.95 0 0)",
  popover: "oklch(0.185 0.005 285)",
  "popover-foreground": "oklch(0.95 0 0)",
  primary: "oklch(0.65 0.15 250)",
  "primary-foreground": "oklch(0.98 0 0)",
  secondary: "oklch(0.22 0.005 285)",
  "secondary-foreground": "oklch(0.95 0 0)",
  muted: "oklch(0.22 0.005 285)",
  "muted-foreground": "oklch(0.55 0.005 285)",
  accent: "oklch(0.22 0.005 285)",
  "accent-foreground": "oklch(0.95 0 0)",
  destructive: "oklch(0.65 0.2 25)",
  "destructive-foreground": "oklch(0.98 0 0)",
  border: "oklch(0.25 0.005 285)",
  input: "oklch(0.25 0.005 285)",
  ring: "oklch(0.65 0.15 250)",
  /** Status only. It has no foreground because nothing sets text on it. */
  success: "oklch(0.65 0.2 150)",
} as const;

export type ColorToken = keyof typeof colors;

/** The base radius. The scale below is derived from it, never set apart from it. */
export const radius = "0.375rem";

export const fonts = {
  sans: "system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, \"JetBrains Mono\", monospace",
} as const;

/**
 * Which tokens are a foreground for which surface.
 *
 * Declared rather than inferred from the `-foreground` suffix, because it is
 * what a contrast check iterates over and what the Figma generator needs to
 * pair variables correctly. An unpaired colour is a colour nothing can safely
 * put text on.
 */
export const pairs = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["destructive", "destructive-foreground"],
] as const satisfies ReadonlyArray<readonly [ColorToken, ColorToken]>;
