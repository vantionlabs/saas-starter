import type * as React from "react";

/**
 * The first screen of a marketing site.
 *
 * Content as props, so the copy stays in the application and this stays a
 * shape. A hero with its own words is a component only one product can use —
 * and the words are the half that changes most.
 */
export const Hero = (props: {
  readonly headline: string;
  readonly body: string;
  readonly actions: React.ReactNode;
}) => (
  <section className="flex flex-col items-start gap-6 py-16">
    <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {props.headline}
    </h1>
    <p className="text-muted-foreground max-w-2xl text-lg">{props.body}</p>
    <div className="flex flex-wrap items-center gap-3">{props.actions}</div>
  </section>
);

export type Feature = { readonly title: string; readonly body: string; };

export const FeatureGrid = (props: { readonly features: ReadonlyArray<Feature>; }) => (
  <section className="grid gap-6 border-t py-16 md:grid-cols-3">
    {props.features.map((feature) => (
      <div key={feature.title} className="flex flex-col gap-2">
        <h2 className="font-medium">{feature.title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
      </div>
    ))}
  </section>
);

export type Question = { readonly q: string; readonly a: string; };

export const Faq = (props: {
  readonly heading: string;
  readonly questions: ReadonlyArray<Question>;
}) => (
  <section className="flex flex-col items-start gap-4 border-t py-16">
    <h2 className="text-2xl font-semibold tracking-tight">{props.heading}</h2>
    <dl className="grid w-full gap-6 md:grid-cols-2">
      {props.questions.map((entry) => (
        <div key={entry.q} className="flex flex-col gap-1.5">
          <dt className="font-medium">{entry.q}</dt>
          <dd className="text-muted-foreground text-sm leading-relaxed">{entry.a}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export type FeatureDetail = {
  readonly title: string;
  readonly body: string;
  readonly points: ReadonlyArray<string>;
};

/** The features page: room to say more than three lines each. */
export const FeatureDetails = (props: { readonly groups: ReadonlyArray<FeatureDetail>; }) => (
  <div className="flex flex-col gap-10">
    {props.groups.map((group) => (
      <section key={group.title} className="flex flex-col gap-3 border-t pt-10">
        <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{group.body}</p>
        <ul className="text-muted-foreground grid gap-2 pt-2 text-sm sm:grid-cols-2">
          {group.points.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>
    ))}
  </div>
);
