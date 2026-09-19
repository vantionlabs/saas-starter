import { Assets } from "@/sections/assets.js";
import { Colour } from "@/sections/colour.js";
import { Motion } from "@/sections/motion.js";
import { Type } from "@/sections/type.js";
import { Voice } from "@/sections/voice.js";

const sections = [
  ["colour", "Colour"],
  ["type", "Type"],
  ["voice", "Voice"],
  ["motion", "Motion"],
  ["assets", "Assets"],
] as const;

/**
 * The brand kit, generated from the design system rather than described beside
 * it.
 *
 * Every swatch, every hex, every pairing comes from `@vantion/tokens`, and the
 * email footer comes from `@vantion/emails`. That is what makes this page worth
 * keeping: a brand document maintained by hand is out of date the first time
 * somebody changes a colour, and then it is worse than nothing because people
 * still believe it.
 */
export const Brand = () => (
  <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-16 px-6 py-10">
    <header className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Brand</p>
        <h1 className="text-3xl font-semibold tracking-tight">Acme</h1>
        <p className="text-muted-foreground max-w-2xl">
          Colour, type, voice, motion and the places they leave the product — all read from the same
          values the application ships, so this page cannot drift from it.
        </p>
      </div>

      <nav className="flex flex-wrap gap-3 text-sm">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
    </header>

    <main className="flex flex-col gap-16">
      <Colour />
      <Type />
      <Voice />
      <Motion />
      <Assets />
    </main>

    <footer className="text-muted-foreground border-t pt-8 text-xs">
      Generated from <code>@vantion/tokens</code> and <code>@vantion/emails</code>.
    </footer>
  </div>
);
