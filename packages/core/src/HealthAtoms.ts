import { Effect } from "effect";
import { AppRpc } from "./AppRpc.js";

/**
 * Latest health report, refetched on demand via `useAtomRefresh`.
 */
export const healthAtom = AppRpc.runtime.atom(
  Effect.gen(function*() {
    const client = yield* AppRpc;

    return yield* client("Check", undefined);
  }),
);
