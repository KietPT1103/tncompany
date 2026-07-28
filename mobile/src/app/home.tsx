import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { syncPendingJobs } from "@/features/sync/syncService";

export default function HomeScreen() {
  const { area } = useArea();
  const { user, signOut } = useAuth();
  if (!area) { router.replace("/areas"); return null; }
  return <Screen><View style={styles.head}><View><Text style={styles.hello}>Xin chào, {user?.displayName}</Text>
    <Text style={styles.area}>Khu đang thao tác: {area.name}</Text></View><Pressable onPress={() => router.push("/areas")}><Text style={styles.change}>Đổi khu</Text></Pressable></View>
    <View style={styles.hero}><Text style={styles.heroTitle}>Ghi nhận đơn hàng ngay tại quầy</Text>
      <Text style={styles.heroCopy}>Ảnh sẽ có watermark thời gian, vị trí, khu vực và nhân viên.</Text></View>
    <View style={styles.actions}>
      <PrimaryButton title="Chụp nhanh đơn hàng" onPress={() => router.push({ pathname: "/camera", params: { mode: "quick" } })} />
      <PrimaryButton tone="secondary" title="Tạo phiếu nhập đầy đủ" onPress={() => router.push({ pathname: "/camera", params: { mode: "full" } })} />
      <Pressable style={styles.shortcut} onPress={() => router.push("/pending")}><Text style={styles.shortcutText}>Chưa giải trình</Text><Text style={styles.arrow}>→</Text></Pressable>
      <Pressable style={styles.shortcut} onPress={() => router.push("/receipts")}><Text style={styles.shortcutText}>Phiếu gần đây</Text><Text style={styles.arrow}>→</Text></Pressable>
      <Pressable style={styles.shortcut} onPress={syncPendingJobs}><Text style={styles.shortcutText}>Thử lại đồng bộ</Text><Text style={styles.arrow}>↻</Text></Pressable>
    </View>
    <Pressable onPress={async () => { await signOut(); router.replace("/login"); }}><Text style={styles.logout}>Đăng xuất</Text></Pressable>
  </Screen>;
}
const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }, hello: { color: "#64748b" },
  area: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginTop: 4 }, change: { color: "#059669", fontWeight: "800" },
  hero: { backgroundColor: "#d1fae5", borderRadius: 28, padding: 24, marginTop: 28 }, heroTitle: { fontSize: 28, fontWeight: "800", color: "#064e3b" },
  heroCopy: { color: "#047857", fontSize: 15, lineHeight: 22, marginTop: 10 }, actions: { gap: 12, marginTop: 24 },
  shortcut: { minHeight: 58, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutText: { color: "#334155", fontSize: 16, fontWeight: "700" }, arrow: { color: "#059669", fontSize: 22 }, logout: { textAlign: "center", color: "#dc2626", marginTop: 22, fontWeight: "700" }
});
