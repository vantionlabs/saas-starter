import type * as React from "react";

/**
 * A message: what it is called, and what it looks like.
 *
 * Subject and body are declared together because they are one decision. Kept
 * apart — a template here and a subject line at the call site — they drift, and
 * the reader gets "Verify your email" above a password reset.
 */
export type Email<Props> = {
  readonly subject: (props: Props) => string;
  readonly Body: (props: Props) => React.ReactElement;
};

/**
 * Defined here rather than inferred, so a template has to state its props.
 *
 * The trailing comma in `<Props,>` is not a typo: this file is `.tsx`, where a
 * bare `<Props>` at the head of an arrow parses as a JSX tag.
 */
export const email = <Props,>(definition: Email<Props>): Email<Props> => definition;
