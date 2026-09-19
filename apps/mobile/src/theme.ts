import { oklchToHex } from "@vantion/tokens/color";
import { colors, fonts, radius } from "@vantion/tokens/tokens";

/**
 * The palette, in the only form React Native can read it.
 *
 * Converted to hex here rather than restated, for the same reason
 * `packages/emails` does it: the tokens are `oklch` and neither a mail client
 * nor React Native's style engine parses that. This is the third consumer of
 * the same conversion, and the reason those values live in TypeScript rather
 * than in a stylesheet — a palette in CSS can be read by the web and by nothing
 * else.
 */
export const nativeColors: Record<keyof typeof colors, string> = Object.fromEntries(
  Object.entries(colors).map(([name, value]) => [name, oklchToHex(value)]),
) as Record<keyof typeof colors, string>;

/** `0.375rem` means nothing to a phone; points do. */
export const nativeRadius = Math.round(Number.parseFloat(radius) * 16);

/**
 * `system-ui, -apple-system, sans-serif` is a CSS font stack, and React Native
 * takes one family. `System` is the platform's own, which is what that stack
 * resolves to on a phone anyway.
 */
export const nativeFonts = {
  sans: "System",
  mono: fonts.mono.includes("JetBrains") ? "Menlo" : "Courier",
} as const;
