Server-rendered reads, one file per concern.

Each file here is a `createServerFn` that runs a read on the server and returns
it dehydrated, for a route loader to hand to `HydrationBoundary`. They are split
the way `packages/core/src/atoms/` is split, and for the same reason: what a
reader is looking for is a feature.

The cookie is not passed. `serverRpc` reads it from the request being handled,
because inside a request there is exactly one right answer and repeating it at
every call site made the one thing that must never be forgotten into a parameter
somebody could get wrong.
