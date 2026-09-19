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
  /**
   * Status only. It has no foreground because nothing sets text on it.
   *
   * Chroma is 0.16 rather than the 0.2 it started at: above that this hue and
   * lightness fall outside sRGB, and a browser clips them silently — so the
   * colour on screen was never the colour written here. `isInGamut` is what
   * noticed, and a test keeps it noticed.
   */
  success: "oklch(0.65 0.16 150)",
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

/**
 * Motion, and it is a token for the same reason colour is.
 *
 * Three consumers again: the stylesheet, `motion/react` in `packages/ui`, and
 * `apps/brand`, which used to keep its own copy of these curves inline — the
 * one part of a page whose whole argument is that it is generated from this
 * file. A brand document that writes down a different easing than the product
 * uses is worse than no document, because people believe it.
 *
 * Short and few. Motion here says something arrived or changed; it is never
 * decoration, and everything built on these honours `prefers-reduced-motion`.
 */
export const easings = {
  /** Anything arriving: a card, a chip, a streamed word. */
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  /** Anything that moves and settles, like a panel opening. */
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  /** Only for something continuous — a shimmer, a progress bar. */
  linear: "linear",
} as const;

export type EasingToken = keyof typeof easings;

/**
 * Milliseconds, and deliberately only three.
 *
 * A scale with seven steps is one where nobody can say which to use, so every
 * choice becomes a guess and the product ends up with nine durations. `fast` is
 * a state change on something already on screen, `base` is the default for
 * anything entering or leaving, `slow` is reserved for something crossing the
 * whole viewport.
 */
export const durations = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export type DurationToken = keyof typeof durations;

/** What each easing is for, so the brand kit can read it rather than restate it. */
export const easingUse: Record<EasingToken, { readonly name: string; readonly use: string; }> = {
  out: { name: "Out, strong", use: "Anything arriving: a card, a chip, a streamed word." },
  inOut: { name: "In and out", use: "Anything that moves and settles, like a panel opening." },
  linear: { name: "Linear", use: "Only for something continuous — a shimmer, a progress bar." },
};
