import { Effect } from "effect";
import { AppRpc } from "../AppRpc.js";

/**
 * Latest health report, refetched on demand via `useAtomRefresh`.
 *
 * **Nothing renders this.** It is the worked example of reading a procedure
 * that needs no arguments and no tenant, kept beside the features so the shape
 * is in the tree rather than only in a document — and it is the read half of
 * the pair whose streaming half is `Health.Watch`. Delete it and nothing
 * breaks, which is the point of saying so here.
 */
export const healthAtom = AppRpc.runtime.atom(
  Effect.gen(function*() {
    const client = yield* AppRpc;

    return yield* client("Check", undefined);
  }),
);
