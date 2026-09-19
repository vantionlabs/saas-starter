import "../global.css";
import { nativeColors } from "@/theme";
import { RegistryProvider } from "@effect/atom-react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * The root, and the same atom registry the web app runs.
 *
 * Thirty seconds of idle TTL for the same reason: without a window every
 * navigation throws the screen's data away and refetches it on the way back,
 * which on a phone is somebody's data allowance rather than a spinner.
 */
export default function RootLayout() {
  return (
    <RegistryProvider defaultIdleTTL={30_000}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: nativeColors.background },
          headerTintColor: nativeColors.foreground,
          contentStyle: { backgroundColor: nativeColors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      </Stack>
    </RegistryProvider>
  );
}
