import { ActivityIndicator, Text, View } from "react-native";

/** The three states every list has, written once. */
export const Loading = () => (
  <View className="flex-1 items-center justify-center bg-background">
    <ActivityIndicator />
  </View>
);

export const Empty = (props: { readonly title: string; readonly body: string; }) => (
  <View className="flex-1 items-center justify-center gap-2 bg-background px-8">
    <Text className="text-base font-medium text-foreground">{props.title}</Text>
    <Text className="text-center text-sm text-muted-foreground">{props.body}</Text>
  </View>
);

/**
 * A failure says which thing failed and nothing about why.
 *
 * The web app can tell a policy refusal from a fault, because it has the cause
 * to inspect; here the honest thing is to say what did not load rather than
 * guess at a reason a phone cannot verify.
 */
export const Failed = (props: { readonly subject: string; }) => (
  <View className="flex-1 items-center justify-center gap-2 bg-background px-8">
    <Text className="text-base font-medium text-foreground">Could not load {props.subject}</Text>
    <Text className="text-center text-sm text-muted-foreground">
      Check the connection and try again. If it keeps happening, the server log has the detail.
    </Text>
  </View>
);
