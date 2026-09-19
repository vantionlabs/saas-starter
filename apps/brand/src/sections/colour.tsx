import { isInGamut, oklchToHex } from "@vantion/tokens/color";
import { colors, pairs } from "@vantion/tokens/tokens";

/**
 * Every colour the product ships, with the value it actually uses.
 *
 * Generated from `@vantion/tokens` rather than described beside it. A brand
 * page that lists colours by hand is a brand page that is wrong within a
 * month — and this one is also the check: each swatch shows the hex a mail
 * client would receive and whether the colour survives sRGB, which is how a
 * token outside the gamut was caught the first time.
 */
export const Colour = () => (
  <section id="colour" className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Colour</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Colour carries status and action, never decoration. That is why the palette is nearly
        monochrome apart from one blue and one red: when everything is coloured, nothing is.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(colors).map(([name, value]) => (
        <div key={name} className="flex items-center gap-3 rounded-lg border p-3">
          <div
            className="size-10 shrink-0 rounded-md border"
            style={{ background: value }}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate font-mono text-xs">{value}</p>
            <p className="text-muted-foreground font-mono text-xs">
              {oklchToHex(value)}
              {!isInGamut(value) && <span className="text-destructive">· outside sRGB</span>}
            </p>
          </div>
        </div>
      ))}
    </div>

    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Pairs</h3>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Which colour goes on which. A surface with no declared foreground is a surface nothing may
        put text on — the list is the rule, not an illustration of it.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {pairs.map(([surface, ink]) => (
          <div
            key={surface}
            className="rounded-lg border p-4 text-sm"
            style={{ background: colors[surface], color: colors[ink] }}
          >
            {surface}
          </div>
        ))}
      </div>
    </div>
  </section>
);
