import * as React from "react";

const subscribe = () => () => {};

/**
 * Whether React has attached to this markup yet.
 *
 * Server-rendered controls exist before they work: the button is in the
 * document, its `onClick` is not, and a click in that window does nothing at
 * all — silently, which is the worst version. Offering a control that cannot
 * act is the thing to avoid, so anything that needs a handler waits for this.
 *
 * `useSyncExternalStore` with a server snapshot of `false` and a client
 * snapshot of `true` is how React itself models this: the value differs between
 * the two renders *by design*, so it is the one case the hook does not treat as
 * a mismatch. A `useEffect` flipping a boolean does the same job a paint later
 * and reintroduces the flash it was meant to remove.
 *
 * It subscribes to nothing, because the answer changes exactly once and React
 * already re-renders at that moment.
 */
export const useHydrated = (): boolean =>
  React.useSyncExternalStore(subscribe, () => true, () => false);
