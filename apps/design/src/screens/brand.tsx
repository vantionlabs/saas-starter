import { Assets } from "@vantion/ui/brand/assets";
import { Colour } from "@vantion/ui/brand/colour";
import { Motion } from "@vantion/ui/brand/motion";
import { Type } from "@vantion/ui/brand/type";
import { Voice } from "@vantion/ui/brand/voice";

/**
 * The brand kit, on the same canvas.
 *
 * These sections read `@vantion/tokens` and `@vantion/emails` directly, so what
 * is shown here is what ships — there is nothing to fixture. Having them beside
 * the product screens is the point: a colour changed in Figma lands in the
 * tokens, and every surface on this canvas moves at once.
 */
export const Brand = () => (
  <div className="flex flex-col gap-16">
    <Colour />
    <Type />
    <Voice />
    <Motion />
    <Assets />
  </div>
);
