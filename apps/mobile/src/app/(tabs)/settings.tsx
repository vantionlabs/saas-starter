import { authClient } from "@/auth";
import { Failed, Loading } from "@/components/state";
import { useAtomValue } from "@effect/atom-react";
import { organizationsAtom } from "@vantion/core/atoms/Organization";
import { AsyncResult } from "effect/unstable/reactivity";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

/**
 * Who you are and which organization you are in.
 *
 * Read-only on purpose. Everything that changes an organization — roles,
 * billing, API keys — is a decision somebody makes at a desk, and a phone is
 * where they check what it is.
 */
export default function Settings() {
  const organizations = useAtomValue(organizationsAtom);

  if (AsyncResult.isInitial(organizations)) return <Loading />;
  if (AsyncResult.isFailure(organizations)) return <Failed subject="your organizations" />;

  const active = organizations.value.find((membership) => membership.isActive);

  return (
    <View className="flex-1 gap-6 bg-background px-4 py-6">
      <View className="gap-1">
        <Text className="text-sm text-muted-foreground">Organization</Text>
        <Text className="text-base text-foreground">{active?.name ?? "None"}</Text>
        {active !== undefined && (
          <Text className="text-sm text-muted-foreground">{active.role}</Text>
        )}
      </View>

      <View className="gap-2">
        <Text className="text-sm text-muted-foreground">
          {organizations.value.length} organization{organizations.value.length === 1 ? "" : "s"}
        </Text>
        {organizations.value.map((membership) => (
          <Text key={membership.orgId} className="text-base text-foreground">
            {membership.name}
          </Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void authClient.signOut().then(() => router.replace("/sign-in"));
        }}
        className="mt-auto items-center rounded border border-border px-4 py-3"
      >
        <Text className="font-medium text-foreground">Sign out</Text>
      </Pressable>
    </View>
  );
}
