# The mobile app

`apps/mobile` is Expo and expo-router over the same contract, the same queries
and the same tokens as the web app. What is different is the rendering layer and
how a session is carried; everything above that is shared.

## What it shares, and why that is the point

```
packages/domain   the contract both ends compile against
packages/core     the RPC client, the reactivity keys, every read and write
packages/tokens   the palette, converted to hex because React Native has no oklch
```

The contacts screen renders `contactsAtom` — not "the mobile equivalent of" it,
the same atom the browser renders. A query written twice is a query that behaves
differently twice, and the difference is always found by a customer.

## What it does not share

**The design system.** `packages/ui` is HTML and Tailwind for a browser; a phone
needs `View` and `Text`. The tokens are shared, the components are not, and that
is the trade the plan took deliberately — rendering `apps/web` through
react-native-web would mean rewriting nineteen primitives and losing Base UI's
accessibility work to gain a screen nobody asked for.

**The session.** A browser keeps it in a cookie the platform manages. React
Native has no such jar to rely on, so `@better-auth/expo` stores the token in the
device keychain and attaches it to every request. The server carries the matching
plugin, and `vantion://` is a trusted origin — change the scheme in
`app.json` and change it in `Auth.ts` too.

## Running it

```
pnpm mobile              # expo start
pnpm --filter @vantion/mobile ios
```

Point it at an API with `EXPO_PUBLIC_API_URL`. On a simulator `localhost` is the
host machine; on a physical device it is the phone, so use the machine's address
on the network — a mobile app that "cannot reach the server" is almost always
this.

## The seams worth knowing

**NativeWind v4 is a Tailwind 3 integration**, and everything else here is on
Tailwind 4. That is why `tailwindcss` is pinned inside this app rather than taken
from the catalog, and why `global.css` uses `@tailwind` directives instead of
`@import "tailwindcss"`. NativeWind v5 takes the Tailwind 4 pipeline; it is a
release candidate, and one release candidate in a starter is enough.

**The router root is `src/app`.** Expo looks there before a top-level `app/` and says so on
start-up, with no configuration — which lets everything that is source live under `src/`, the
way it does in every other app here, and leaves the root for configuration.

**Metro is told three things it cannot infer**: the workspace root to watch, that
package exports exist and which condition to take, and that a relative `./Foo.js`
inside a workspace package means `./Foo.ts`. The last one is a resolver of about
ten lines — the extension is correct for the packages Node actually runs, and
this is the one consumer that does not speak it.

**React Native is pinned to the exact version the SDK bundles**, `0.86.3`, with
no caret on it. A caret is what an ordinary dependency gets; an Expo SDK is a
matched set, and `expo install` exists precisely because the range npm would
pick is not the range the SDK was built against. The first attempt here used
`^0.87.1`, one minor ahead, and Metro bundled all 2,010 modules before
`@expo/metro-config` failed requiring `react-native/rn-get-polyfills` — a file
0.87 moved. `expo/bundledNativeModules.json` is the list; `npx expo install
--check` reads it for you.

## What has been verified, and what has not

`pnpm check` type-checks it, `pnpm test` covers the theme conversion, and
`pnpm --filter @vantion/mobile build` bundles it with `expo export`. **It has not
been run on a simulator or a device in this repository.** Treat the screens as a
starting point that compiles and bundles rather than as a shipped application —
the first `pnpm mobile` on your own machine is the first time anybody will have
seen it move.
