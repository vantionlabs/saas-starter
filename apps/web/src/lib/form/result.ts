import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

/**
 * Every tagged failure a submit can carry, from any form.
 *
 * `reason` is `unknown` rather than `string` because the error unions differ
 * per procedure — `Unauthenticated` carries one shape, `RpcClientError`
 * another — and this only ever compares it to a literal. Narrowing it to
 * `string` made the type reject the very unions it exists to read.
 */
type Failure = { readonly _tag: string; readonly reason?: unknown; };

const failure = (result: AsyncResult.AsyncResult<unknown, Failure>) => AsyncResult.error(result);

/**
 * The typed error lives in the result's `Cause`, so it is read through
 * `AsyncResult.error` rather than off the result directly.
 */
export const isRateLimited = (result: AsyncResult.AsyncResult<unknown, Failure>) =>
  Option.match(failure(result), {
    onNone: () => false,
    onSome: (error) => error._tag === "SignInFailed" && error.reason === "RateLimited",
  });

/**
 * A failed submit is either the form not validating or the request being
 * rejected — telling someone their password was wrong when they simply left a
 * field blank sends them looking in the wrong place.
 *
 * The validation case is named, rather than inferred from everything that is
 * not one particular request error. `FormReact.make` types its submit as
 * `E | Schema.SchemaError`, so `SchemaError` *is* the form failing to decode
 * and anything else came back from a server. Written the other way round — as
 * `!== "SignInFailed"` — this told somebody signing in with their company
 * address to "check the fields above" when the fields were fine and their
 * domain simply had no provider behind it. Every error added afterwards would
 * have inherited the same wrong message.
 */
export const isInvalidForm = (result: AsyncResult.AsyncResult<unknown, Failure>) =>
  Option.match(failure(result), {
    onNone: () => false,
    onSome: (error) => error._tag === "SchemaError",
  });

/**
 * Picks the message for a form-level alert. `rejected` is the request-level case.
 *
 * Here rather than under `lib/auth/` because it is the rule for **every** form:
 * a failed submit is either the form not validating or the request being
 * rejected, and those need different sentences whatever the form was for.
 */
export const submitMessage = (
  result: AsyncResult.AsyncResult<unknown, Failure>,
  rejected: string,
) =>
  isInvalidForm(result)
    ? "Check the fields above and try again."
    : isRateLimited(result)
    ? "Too many attempts. Try again in a minute."
    : rejected;
