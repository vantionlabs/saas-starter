import { Effect } from "effect";
import { AppRpc } from "../AppRpc.js";

/**
 * Latest health report, refetched on demand via `useAtomRefresh`.
 *
 * **Nothing renders this yet, and it is kept on purpose.** It is the read half
 * of the pair whose streaming half is `Health.Watch`, and what a deployment
 * reaches for: a status page, a readiness widget, or an admin surface that
 * shows whether the API and its database are answering. Wiring that up should
 * be a screen, not a module.
 *
 * It is also the worked example of reading a procedure that needs no arguments
 * and no tenant, which is why it sits beside the features rather than in a
 * document. `knip.jsonc` treats every file under `src/` as an entry point —
 * these packages export `./*` — so nothing will quietly report it as dead.
 */
export const healthAtom = AppRpc.runtime.atom(
  Effect.gen(function*() {
    const client = yield* AppRpc;

    return yield* client("Check", undefined);
  }),
);
