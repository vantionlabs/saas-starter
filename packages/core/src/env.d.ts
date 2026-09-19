/**
 * The two public addresses this package reads, declared so dot access is
 * typed — and dot access is what each bundler substitutes.
 *
 * Neither is a secret: both are the API's public URL, which a browser resolves
 * and a phone connects to. Anything that must stay private is read on the
 * server, never here.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Set by Expo. Metro inlines `EXPO_PUBLIC_*` into the bundle. */
    readonly EXPO_PUBLIC_API_URL?: string;
    /** Set by Vite, through the `define` in the web app's config. */
    readonly VITE_AUTH_BASE_URL?: string;
  }
}
