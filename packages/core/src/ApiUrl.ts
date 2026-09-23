/**
 * Where the API is, resolved without knowing which bundler is asking.
 *
 * This package is shared by the web app and the Expo app, and the two disagree
 * about how a public value reaches the client: Vite substitutes
 * `import.meta.env.VITE_*` at build time and leaves `process.env` alone, Metro
 * inlines `process.env.EXPO_PUBLIC_*` and has no `import.meta.env` at all.
 *
 * Reading both names is the whole trick. Each bundler replaces the one it
 * knows with a literal and the other stays undefined, so one expression serves
 * both without a shim, a global or a `define` that has to be kept in step.
 *
 * With neither set, a browser answers with its own origin. That is the web
 * app's normal case rather than a fallback: `apps/web` serves the API's
 * browser-facing routes from its own origin (`server/proxy.ts`), so the session
 * cookie is first-party on whatever host served the page and there is no API
 * address to compile into the bundle. Outside a browser — the server bundle, a
 * test — the answer is localhost, because a fresh clone should run.
 */
export const apiUrl = (): string => {
  /**
   * Dot access, not `process.env[...]`, and that is load-bearing.
   *
   * Both bundlers replace the *literal text* `process.env.NAME` with a string.
   * A bracket read is left alone, so the value would be `undefined` in a
   * browser — where `process` does not exist at all — and every call would
   * quietly go to localhost in production.
   */
  const fromExpo = process.env.EXPO_PUBLIC_API_URL;

  if (typeof fromExpo === "string" && fromExpo !== "") return trim(fromExpo);

  const fromVite = process.env.VITE_AUTH_BASE_URL;

  if (typeof fromVite === "string" && fromVite !== "") return trim(fromVite);

  const origin = globalThis.location?.origin;

  if (typeof origin === "string" && origin !== "" && origin !== "null") return origin;

  return "http://localhost:3000";
};

const trim = (url: string) => url.replace(/\/$/, "");
