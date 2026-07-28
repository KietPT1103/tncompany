import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
export function PrimaryButton({ title, onPress, disabled, loading = false, tone = "primary" }: {
  title: string; onPress(): void; disabled?: boolean; loading?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const unavailable = disabled || loading;
  return <Pressable disabled={unavailable} onPress={onPress} style={({ pressed }) => [
    styles.button, styles[tone], (unavailable || pressed) && styles.muted
  ]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}</Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primary: { backgroundColor: "#059669" }, secondary: { backgroundColor: "#334155" }, danger: { backgroundColor: "#dc2626" },
  muted: { opacity: 0.65 }, text: { color: "#fff", fontSize: 16, fontWeight: "700" }
});
