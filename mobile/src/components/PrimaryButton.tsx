import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function")
    && value !== null
    && typeof (value as { then?: unknown }).then === "function";
}

export function PrimaryButton({ title, onPress, disabled, loading = false, loadingTitle = "Đang xử lý…", tone = "primary" }: {
  title: string; onPress(): unknown | Promise<unknown>; disabled?: boolean; loading?: boolean; loadingTitle?: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const pending = loading || internalLoading;
  const unavailable = disabled || pending;
  async function handlePress() {
    if (unavailable) return;
    try {
      const result = onPress();
      if (isPromiseLike(result)) {
        setInternalLoading(true);
        await result;
      }
    } finally {
      setInternalLoading(false);
    }
  }
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(unavailable), busy: pending }}
    disabled={unavailable}
    onPress={handlePress}
    style={({ pressed }) => [
    styles.button, styles[tone], (unavailable || pressed) && styles.muted
  ]}>{pending
      ? <View style={styles.loading}><ActivityIndicator color="#fff" /><Text style={styles.text}>{loadingTitle}</Text></View>
      : <Text style={styles.text}>{title}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primary: { backgroundColor: "#059669" }, secondary: { backgroundColor: "#334155" }, danger: { backgroundColor: "#dc2626" },
  muted: { opacity: 0.65 }, loading: { flexDirection: "row", alignItems: "center", gap: 10 },
  text: { color: "#fff", fontSize: 16, fontWeight: "700" }
});
