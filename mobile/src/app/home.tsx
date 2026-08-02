import { useState } from "react";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { syncPendingJobs } from "@/features/sync/syncService";

export default function HomeScreen() {
  const { area } = useArea();
  const { user, loading, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (!area) return <Redirect href="/areas" />;
  async function handleSync() {
    try {
      setSyncing(true);
      const result = await syncPendingJobs();
      if (result.total === 0) {
        Alert.alert("Đã đồng bộ", "Không có phiếu nào đang chờ đồng bộ.");
      } else if (result.failed === 0) {
        Alert.alert("Đồng bộ thành công", `Đã đồng bộ ${result.succeeded}/${result.total} phiếu.`);
      } else {
        const detail = result.errors[0] ? `\n\nLỗi: ${result.errors[0]}` : "";
        Alert.alert(
          "Đồng bộ chưa hoàn tất",
          `Thành công ${result.succeeded}/${result.total} phiếu. Còn ${result.failed} phiếu chưa đồng bộ.${detail}`
        );
      }
    } catch (error) {
      Alert.alert("Không thể đồng bộ", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setSyncing(false);
    }
  }
  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Không thể đăng xuất", error instanceof Error ? error.message : "Vui lòng thử lại.");
      setSigningOut(false);
    }
  }
  return <Screen><View style={styles.head}><View><Text style={styles.hello}>Xin chào, {user?.displayName}</Text>
    <Text style={styles.area}>Khu đang thao tác: {area.name}</Text></View><Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.push("/areas")}><Text style={styles.change}>Đổi khu</Text></Pressable></View>
    <View style={styles.hero}><Text style={styles.heroTitle}>Ghi nhận đơn hàng ngay tại quầy</Text>
      <Text style={styles.heroCopy}>Ảnh sẽ có watermark thời gian, vị trí, khu vực và nhân viên.</Text></View>
    <View style={styles.actions}>
      <PrimaryButton title="Chụp nhanh đơn hàng" onPress={() => router.push({ pathname: "/camera", params: { mode: "quick" } })} />
      <PrimaryButton tone="secondary" title="Tạo phiếu nhập đầy đủ" onPress={() => router.push({ pathname: "/camera", params: { mode: "full" } })} />
      <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]} onPress={() => router.push("/pending")}><Text style={styles.shortcutText}>Chưa giải trình</Text><Text style={styles.arrow}>→</Text></Pressable>
      <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]} onPress={() => router.push("/receipts")}><Text style={styles.shortcutText}>Phiếu gần đây</Text><Text style={styles.arrow}>→</Text></Pressable>
      <Pressable
        style={({ pressed }) => [styles.shortcut, (pressed || syncing) && styles.shortcutPressed]}
        onPress={handleSync}
        disabled={syncing}
      >
        <Text style={styles.shortcutText}>{syncing ? "Đang đồng bộ…" : "Thử lại đồng bộ"}</Text>
        {syncing ? <ActivityIndicator color="#059669" /> : <Text style={styles.arrow}>↻</Text>}
      </Pressable>
    </View>
    <Pressable
      disabled={signingOut}
      accessibilityRole="button"
      accessibilityState={{ disabled: signingOut, busy: signingOut }}
      style={({ pressed }) => [styles.logoutButton, (pressed || signingOut) && styles.pressed]}
      onPress={handleSignOut}
    >
      {signingOut ? <View style={styles.logoutLoading}><ActivityIndicator color="#dc2626" /><Text style={styles.logout}>Đang đăng xuất…</Text></View> : <Text style={styles.logout}>Đăng xuất</Text>}
    </Pressable>
  </Screen>;
}
const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }, hello: { color: "#64748b" },
  area: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginTop: 4 }, change: { color: "#059669", fontWeight: "800" },
  hero: { backgroundColor: "#d1fae5", borderRadius: 28, padding: 24, marginTop: 28 }, heroTitle: { fontSize: 28, fontWeight: "800", color: "#064e3b" },
  heroCopy: { color: "#047857", fontSize: 15, lineHeight: 22, marginTop: 10 }, actions: { gap: 12, marginTop: 24 },
  shortcut: { minHeight: 58, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutPressed: { opacity: 0.65 }, pressed: { opacity: 0.6 },
  shortcutText: { color: "#334155", fontSize: 16, fontWeight: "700" }, arrow: { color: "#059669", fontSize: 22 },
  logoutButton: { marginTop: 22, minHeight: 44, alignItems: "center", justifyContent: "center" },
  logoutLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  logout: { textAlign: "center", color: "#dc2626", fontWeight: "700" }
});
