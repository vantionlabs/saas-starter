import { Empty, Failed, Loading } from "@/components/state";
import { useAtomValue } from "@effect/atom-react";
import { contactsAtom } from "@vantion/core/ContactAtoms";
import { AsyncResult } from "effect/unstable/reactivity";
import { FlatList, Text, View } from "react-native";

/**
 * The contacts list, from the same atom the web app renders.
 *
 * Not "the same kind of query" — the same one. `@vantion/core` owns the RPC
 * client and every read, so this screen is a list and nothing else: no fetch,
 * no mapping, no second definition of what a contact is. That is what "one
 * contract, every surface" has to mean to be worth saying.
 */
export default function Contacts() {
  const contacts = useAtomValue(contactsAtom);

  if (AsyncResult.isInitial(contacts)) return <Loading />;
  if (AsyncResult.isFailure(contacts)) return <Failed subject="contacts" />;
  if (contacts.value.length === 0) {
    return <Empty title="No contacts yet" body="People this organization can reach out to." />;
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      data={contacts.value}
      keyExtractor={(contact) => contact.id}
      ItemSeparatorComponent={() => <View className="h-px bg-border" />}
      renderItem={({ item }) => (
        <View className="gap-1 px-4 py-3">
          <Text className="text-base text-foreground">{item.fullName}</Text>
          <Text className="text-sm text-muted-foreground">{item.email}</Text>
        </View>
      )}
    />
  );
}
