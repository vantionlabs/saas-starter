import { Data, Effect } from "effect";

/**
 * The accounts the seed creates, and the one password they all share.
 *
 * Fixed and obvious on purpose: this exists so somebody can sign in and click,
 * and a generated password they have to copy out of a terminal is friction with
 * no benefit on a database that holds nothing real.
 */
export const PASSWORD = "seedpassword";

class SignUpFailed extends Data.TaggedError("SignUpFailed")<{
  readonly email: string;
  readonly status: number;
  readonly body: string;
}> {
  get message() {
    return `could not create ${this.email}: ${this.status} ${this.body}`;
  }
}

/**
 * Users are created through the API, never by writing to `user`.
 *
 * better-auth owns that table and hashes passwords with scrypt; a row inserted
 * by hand would have a password nobody could sign in with, which is the one
 * thing this whole script exists to provide. Going through the endpoint also
 * gets the rest of what sign-up does for free — the personal organization,
 * the membership, the verification state — so the seeded database looks like
 * one people actually made rather than one somebody assembled.
 *
 * An address that already exists is not an error. The seed is re-runnable, and
 * "they are already there" is the outcome it wants either way.
 */
export const signUp = (
  apiUrl: string,
  webUrl: string,
  person: { readonly email: string; readonly name: string; },
) =>
  Effect.tryPromise({
    try: () =>
      fetch(`${apiUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          /**
           * better-auth refuses a state-changing request whose `Origin` it does
           * not recognise, and answers 403 with no header at all. `fetch` from
           * Node sends none, so this supplies the one the API trusts.
           */
          origin: webUrl,
        },
        body: JSON.stringify({ email: person.email, password: PASSWORD, name: person.name }),
      }),
    catch: (cause) => new SignUpFailed({ email: person.email, status: 0, body: String(cause) }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.void
        : Effect.tryPromise({
          try: () => response.text(),
          catch: () => new SignUpFailed({ email: person.email, status: response.status, body: "" }),
        }).pipe(
          Effect.flatMap((body) =>
            // Already there, which is the re-run case and not a failure.
            response.status === 422 || body.includes("USER_ALREADY_EXISTS")
              ? Effect.void
              : Effect.fail(
                new SignUpFailed({ email: person.email, status: response.status, body }),
              )
          ),
        )
    ),
  );
