import { Empty, Failed, Loading } from "@/components/state";
import { useAtomValue } from "@effect/atom-react";
import { filesAtom } from "@vantion/core/FileAtoms";
import { AsyncResult } from "effect/unstable/reactivity";
import { FlatList, Text, View } from "react-native";

/** Bytes, in the units a person reads. The same rule as the web table. */
const size = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Files() {
  const files = useAtomValue(filesAtom);

  if (AsyncResult.isInitial(files)) return <Loading />;
  if (AsyncResult.isFailure(files)) return <Failed subject="files" />;
  if (files.value.length === 0) {
    return (
      <Empty
        title="No files yet"
        body="Anything uploaded belongs to this organization and nobody else's."
      />
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      data={files.value}
      keyExtractor={(file) => file.id}
      ItemSeparatorComponent={() => <View className="h-px bg-border" />}
      renderItem={({ item }) => (
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="flex-1 pr-3 text-base text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-sm text-muted-foreground">{size(item.size)}</Text>
        </View>
      )}
    />
  );
}
