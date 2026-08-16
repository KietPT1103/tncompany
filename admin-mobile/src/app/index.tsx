import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth/AuthProvider";

export default function IndexScreen() {
  const { user, loading } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color="#08745a" size="large" /></View>;
  return <Redirect href={user ? "/home" : "/login"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f8f7" } });
