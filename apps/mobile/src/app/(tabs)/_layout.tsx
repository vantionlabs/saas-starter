import { nativeColors } from "@/theme";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: nativeColors.background },
        headerTintColor: nativeColors.foreground,
        tabBarStyle: {
          backgroundColor: nativeColors.background,
          borderTopColor: nativeColors.border,
        },
        tabBarActiveTintColor: nativeColors.primary,
        tabBarInactiveTintColor: nativeColors["muted-foreground"],
        sceneStyle: { backgroundColor: nativeColors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Contacts" }} />
      <Tabs.Screen name="files" options={{ title: "Files" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
