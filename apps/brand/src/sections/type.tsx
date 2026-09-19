import { fonts, radius } from "@vantion/tokens/tokens";

/** The scale, shown at the sizes the product uses rather than a specimen. */
const scale = [
  { name: "Display", className: "text-4xl font-semibold tracking-tight" },
  { name: "Heading", className: "text-2xl font-semibold tracking-tight" },
  { name: "Subheading", className: "text-base font-medium" },
  { name: "Body", className: "text-sm" },
  { name: "Caption", className: "text-xs text-muted-foreground" },
] as const;

export const Type = () => (
  <section id="type" className="flex flex-col gap-6 border-t pt-16">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Type</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        The system stack, deliberately. A webfont is a render-blocking request and a licence to keep
        track of, and neither buys anything a product this dense needs.
      </p>
    </div>

    <div className="flex flex-col gap-4 rounded-lg border p-6">
      {scale.map((step) => (
        <div key={step.name} className="flex flex-col gap-1">
          <p className="text-muted-foreground font-mono text-[11px]">{step.name}</p>
          <p className={step.className}>The quick brown fox jumps over the lazy dog</p>
        </div>
      ))}
    </div>

    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-lg border p-4">
        <dt className="text-muted-foreground text-xs">Sans</dt>
        <dd className="font-mono text-xs break-words">{fonts.sans}</dd>
      </div>
      <div className="rounded-lg border p-4">
        <dt className="text-muted-foreground text-xs">Mono</dt>
        <dd className="font-mono text-xs break-words">{fonts.mono}</dd>
      </div>
      <div className="rounded-lg border p-4">
        <dt className="text-muted-foreground text-xs">Radius</dt>
        <dd className="font-mono text-xs">{radius}</dd>
      </div>
    </dl>
  </section>
);
