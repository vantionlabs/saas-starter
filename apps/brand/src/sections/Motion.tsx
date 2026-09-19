/**
 * The curves, and what each is for.
 *
 * Shown moving rather than written as a number: a cubic-bézier tuple tells
 * nobody anything, and the point of documenting motion is so two people animate
 * the same thing the same way.
 */
const curves = [
  {
    name: "Out, strong",
    value: "cubic-bezier(0.23, 1, 0.32, 1)",
    use: "Anything arriving: a card, a chip, a streamed word.",
  },
  {
    name: "In and out",
    value: "cubic-bezier(0.77, 0, 0.175, 1)",
    use: "Anything that moves and settles, like a panel opening.",
  },
  {
    name: "Linear",
    value: "linear",
    use: "Only for something continuous — a shimmer, a progress bar.",
  },
] as const;

export const Motion = () => (
  <section id="motion" className="flex flex-col gap-6 border-t pt-16">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Motion</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Short and few. Motion here says something arrived or changed; it is never decoration, and
        every animation respects <code>prefers-reduced-motion</code>.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {curves.map((curve) => (
        <div key={curve.name} className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">{curve.name}</p>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full w-6 rounded-full"
              style={{ animation: `brand-slide 2.4s ${curve.value} infinite` }}
            />
          </div>
          <p className="text-muted-foreground font-mono text-[11px] break-words">{curve.value}</p>
          <p className="text-muted-foreground text-xs">{curve.use}</p>
        </div>
      ))}
    </div>
  </section>
);
