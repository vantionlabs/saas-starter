/**
 * The shape a legal page should have.
 *
 * Headings first, prose second: somebody reading a privacy policy is looking
 * for one answer, and a wall of text is how a page that technically discloses
 * everything discloses nothing.
 */
export const Legal = (props: {
  readonly title: string;
  readonly intro: string;
  readonly sections: ReadonlyArray<{ readonly heading: string; readonly body: string; }>;
}) => (
  <div className="flex max-w-2xl flex-col gap-8 py-16">
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{props.intro}</p>
    </div>

    <div className="flex flex-col gap-6">
      {props.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1.5">
          <h2 className="font-medium">{section.heading}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{section.body}</p>
        </section>
      ))}
    </div>
  </div>
);
