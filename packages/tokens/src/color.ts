/**
 * oklch to sRGB, because Figma variables hold channels and our tokens hold
 * perceptual coordinates.
 *
 * The conversion is Björn Ottosson's, and it is here rather than pulled from a
 * library for one reason: it is forty lines, it is stable, and this package is
 * the boundary every other consumer reads tokens through. A colour-space
 * dependency in it would be a dependency in the Expo app and the Figma exporter
 * alike.
 */

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/** `oklch(L C H)` with L in 0–1, C in 0–0.4ish, H in degrees. */
const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

export class UnparseableColor extends Error {
  constructor(readonly value: string) {
    super(`not an oklch colour: ${value}`);
  }
}

/** sRGB transfer function. Linear light in, display-encoded out. */
const encode = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

/**
 * Clamped, not gamut-mapped.
 *
 * Every token in this file is inside sRGB, so clamping never fires; a palette
 * that strayed outside it would want proper gamut mapping rather than a silent
 * clip, and `isInGamut` is what notices.
 */
const clamp = (channel: number): number => Math.min(1, Math.max(0, channel));

const toLinear = (value: string): readonly [number, number, number] => {
  const match = OKLCH.exec(value.trim());
  if (match === null) throw new UnparseableColor(value);

  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
};

export const oklchToRgb = (value: string): Rgb => {
  const [r, g, b] = toLinear(value);

  return {
    r: clamp(encode(r)),
    g: clamp(encode(g)),
    b: clamp(encode(b)),
  };
};

/** Whether the colour survives the trip without being clipped. */
export const isInGamut = (value: string): boolean =>
  toLinear(value).map(encode).every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

/** `#rrggbb`, for anything that wants a string rather than channels. */
export const oklchToHex = (value: string): string => {
  const { r, g, b } = oklchToRgb(value);
  const byte = (channel: number) => Math.round(channel * 255).toString(16).padStart(2, "0");

  return `#${byte(r)}${byte(g)}${byte(b)}`;
};
