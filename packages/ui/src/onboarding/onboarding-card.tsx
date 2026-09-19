import type * as React from "react";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card.js";

/**
 * The chrome around setting up a workspace: one centred card and a footer.
 *
 * Here rather than in the route for the reason `AuthCard` is here — the card,
 * the progress and the two ways out are how the screen *looks*, and a designer
 * opening `apps/design` should find them without a session, a database or a
 * form library. What stays in the application is the two forms, because
 * effect-form binds the submit into the definition and a presentational
 * component taking `onSubmit` as a prop cannot be one.
 *
 * The footer is not decoration. `onSkip` is what keeps this from being a gate
 * somebody cannot leave, and `onSignOut` is the one thing the application shell
 * would have offered — the shell is behind the redirect this page exists to
 * satisfy, so without it somebody who signed in as the wrong person has no way
 * out but clearing a cookie.
 */
export const OnboardingCard = (props: {
  readonly step: number;
  readonly of: number;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
  readonly onSkip: () => void;
  readonly onSignOut: () => void;
}) => (
  <div className="grid min-h-svh place-items-center p-8">
    <Card className="w-full max-w-md">
      <CardHeader>
        {
          /*
          A real `h1` rather than `CardTitle`, which renders a `div` — so a card
          built with it has no heading for a screen reader to jump to, and on
          this page the title is the whole of what somebody is looking at.
          Whether that primitive should change is a design-system decision;
          giving this screen a heading is not.
        */
        }
        <h1 className="text-base leading-snug font-medium">{props.title}</h1>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {props.children}

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Step {props.step} of {props.of}</span>
          <div className="flex gap-3">
            <button type="button" className="underline underline-offset-4" onClick={props.onSkip}>
              Skip for now
            </button>
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={props.onSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
