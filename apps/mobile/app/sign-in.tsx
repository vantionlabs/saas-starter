import { authClient } from "@/auth";
import { nativeColors } from "@/theme";
import { router } from "expo-router";
import * as React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

/**
 * Email and password, and nothing else yet.
 *
 * The magic-link and OTP flows the web app offers need a link to come back
 * into the app, which is a deep link and an `expo-linking` handler — worth
 * having, and worth having deliberately rather than as an untested extra here.
 */
export default function SignIn() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(async () => {
    setBusy(true);
    setFailed(false);

    const result = await authClient.signIn.email({ email, password });

    setBusy(false);

    // better-auth resolves with `{ error }` rather than rejecting, so the
    // result is inspected rather than caught.
    if (result.error === null) router.replace("/");
    else setFailed(true);
  }, [email, password]);

  return (
    <View className="flex-1 justify-center gap-4 bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">Sign in</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={nativeColors["muted-foreground"]}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        className="rounded border border-input bg-card px-3 py-3 text-foreground"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={nativeColors["muted-foreground"]}
        secureTextEntry
        autoComplete="current-password"
        className="rounded border border-input bg-card px-3 py-3 text-foreground"
      />

      {failed && (
        <Text className="text-sm text-destructive">
          That email and password did not match. Nothing else about the account is said, because
          saying more tells somebody which half was right.
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy || email === "" || password === ""}
        onPress={() => void submit()}
        className="items-center rounded bg-primary px-4 py-3 disabled:opacity-50"
      >
        <Text className="font-medium text-primary-foreground">
          {busy ? "Signing in…" : "Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}
