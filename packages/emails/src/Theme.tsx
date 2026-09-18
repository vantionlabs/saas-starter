import { oklchToHex } from "@vantion/tokens/color";
import { colors, fonts } from "@vantion/tokens/tokens";

/**
 * The palette, in the only form email can read it.
 *
 * Converted to hex here rather than stated separately, because a mail client
 * understands neither `oklch` nor a custom property — and a second palette
 * written out by hand is a palette that is wrong within a month. This is the
 * fourth consumer of `@vantion/tokens`, after the web app, the Expo app and the
 * Figma library, and the reason those values live in TypeScript.
 *
 * Light, deliberately. The product is dark, but a dark email lands in a white
 * inbox looking like a mistake, and several clients invert it anyway.
 */
export const theme = {
  background: "#ffffff",
  surface: "#f6f6f7",
  text: "#18181b",
  muted: "#71717a",
  border: "#e4e4e7",
  accent: oklchToHex(colors.primary),
  accentText: "#ffffff",
  fontSans: fonts.sans,
  fontMono: fonts.mono,
} as const;
