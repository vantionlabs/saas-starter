import { expoClient } from "@better-auth/expo/client";
import { apiUrl } from "@vantion/core/ApiUrl";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

/**
 * The same better-auth client the web app uses, with the one plugin a phone
 * needs.
 *
 * A browser keeps the session in a cookie the platform manages. React Native
 * has no such jar to rely on, so `expoClient` stores the token in the device
 * keychain and attaches it to every request — which is why this file exists at
 * all and why `packages/core` does not hold it.
 *
 * `scheme` matches `app.json`, and is what a magic link or an OAuth redirect
 * comes back to.
 */
export const authClient = createAuthClient({
  baseURL: apiUrl(),
  plugins: [
    expoClient({
      scheme: "vantion",
      storagePrefix: "vantion",
      storage: SecureStore,
    }),
  ],
});
