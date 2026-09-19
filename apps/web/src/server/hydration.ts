import { useRouterState } from "@tanstack/react-router";
import { Schema } from "effect";
import type { Hydration } from "effect/unstable/reactivity";
import { AsyncResult } from "effect/unstable/reactivity";

/**
 * A server-rendered read, on its way to `HydrationBoundary`.
 *
 * This is the designed path, and it replaces a shortcut that looked equivalent
 * and was not. Seeding with `useAtomInitialValues` marks the node **valid** —
 * computed, fresh, done — so the atom never builds a lifecycle and a mutation
 * that invalidates its reactivity key has nothing to refresh: the table showed
 * the server's rows and then ignored every write. It was intermittent, because
 * which of the seed and the first fetch won was a race.
 *
 * Hydration instead *preloads* the encoded value through
 * `registry.setSerializable`, and the node picks it up when it builds. The atom
 * is live: it has the server's data and still refetches when invalidated.
 */

/**
 * What crosses the wire, which is deliberately not `DehydratedAtomValue`.
 *
 * That type carries an optional `resultPromise` for streaming hydration, and a
 * promise cannot go through a server function — the framework rejects the
 * return type outright, which is how this was caught. These three fields are
 * plain JSON; the boundary's own shape is rebuilt on the other side.
 */
export interface Dehydrated {
  readonly key: string;
  /**
   * JSON text rather than the decoded object, and that is not belt and braces.
   * A server function's return type has to be *provably* serializable, and the
   * encoded form of an arbitrary schema is `unknown` — which the framework
   * rejects, correctly, because it cannot see that it is JSON. A string it can.
   */
  readonly value: string;
  readonly dehydratedAt: number;
}

export const dehydrate = <A, I>(
  serial: {
    readonly key: string;
    readonly schema: Schema.Codec<AsyncResult.AsyncResult<A>, I>;
  },
  value: A,
): Dehydrated => ({
  key: serial.key,
  /**
   * The whole `AsyncResult`, not just the success. The atom's value *is* the
   * result, so that is what its schema describes and what the registry expects
   * to decode.
   */
  value: JSON.stringify(
    Schema.encodeSync(Schema.toCodecJson(serial.schema))(AsyncResult.success(value)),
  ),
  /**
   * The server's clock. It is read as an age rather than an instant, and the
   * skew between two machines is not worth a round trip to correct.
   */
  dehydratedAt: Date.now(),
});

/** Back into the shape `HydrationBoundary` applies. */
export const hydrated = (
  ...entries: ReadonlyArray<Dehydrated>
): Array<Hydration.DehydratedAtomValue> =>
  entries.map((entry) => ({
    "~effect/reactivity/DehydratedAtom": true,
    key: entry.key,
    value: JSON.parse(entry.value) as unknown,
    dehydratedAt: entry.dehydratedAt,
  }));

/**
 * Every server-rendered read on the page, in one place at the top of the tree.
 *
 * This is a boundary per *document*, not per route, and the difference is not
 * stylistic. `HydrationBoundary` applies a value immediately only when the atom
 * has no node yet; for one that already exists it defers to an effect — which
 * never runs during SSR. The app shell reads atoms of its own (the command
 * palette reads contacts, the switcher reads organizations), and it renders
 * *before* the child route does, so a boundary inside the route arrived too
 * late for exactly those atoms and left them `Initial` on the server. The page
 * then rendered its empty state, the browser fetched the same data again, and
 * the only visible symptom was a hydration mismatch in the console.
 *
 * Hydrating every match's data above the shell means nothing has read an atom
 * yet when the values land.
 */
const isDehydrated = (value: unknown): value is Dehydrated =>
  typeof value === "object" && value !== null && "key" in value && "dehydratedAt" in value;

export const useHydratedMatches = (): Array<Hydration.DehydratedAtomValue> => {
  const loaderData = useRouterState({
    select: (state) => state.matches.map((match) => match.loaderData),
  });

  /**
   * A route may hydrate more than one read, and `/settings/sso` is why: it
   * renders providers *and* needs the plan, because single sign-on is gated on
   * an entitlement. So a loader returns either one of these or a list of them,
   * and both shapes land here.
   */
  return hydrated(
    ...loaderData.flatMap((data) =>
      Array.isArray(data) ? data.filter(isDehydrated) : isDehydrated(data) ? [data] : []
    ),
  );
};
