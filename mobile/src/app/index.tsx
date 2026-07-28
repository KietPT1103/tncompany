import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/features/auth/AuthProvider";
import { useArea } from "@/features/areas/AreaProvider";
export default function Index() {
  const { user, loading } = useAuth();
  const { area } = useArea();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={area ? "/home" : "/areas"} />;
}
