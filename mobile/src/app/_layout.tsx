import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AreaProvider } from "@/features/areas/AreaProvider";
import { SyncBootstrap } from "@/features/sync/SyncBootstrap";

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><AreaProvider>
    <StatusBar style="dark" />
    <SyncBootstrap />
    <Stack screenOptions={{ headerShown: false }} />
  </AreaProvider></AuthProvider></SafeAreaProvider>;
}
