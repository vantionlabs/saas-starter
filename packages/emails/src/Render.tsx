import { render } from "@react-email/render";
import { Effect } from "effect";
import type { Email } from "./Email.js";

/** What a mailer sends: the subject, and the body in both forms a client may want. */
export type RenderedEmail = {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
};

/**
 * Renders a template to HTML and to plain text.
 *
 * Both, always. A message with no text part is a message that some clients show
 * as an empty body and some filters score as spam — and it is what makes a
 * magic link followable out of a terminal when `RESEND_API_KEY` is unset and the
 * mailer logs instead of sending.
 *
 * Rendering is asynchronous, which is why this is an `Effect` and not a
 * function returning a string.
 */
export const renderEmail = <Props,>(
  template: Email<Props>,
  props: Props,
): Effect.Effect<RenderedEmail> =>
  Effect.gen(function*() {
    const element = template.Body(props);

    const [html, text] = yield* Effect.promise(() =>
      Promise.all([render(element), render(element, { plainText: true })])
    );

    return { subject: template.subject(props), html, text };
  });
