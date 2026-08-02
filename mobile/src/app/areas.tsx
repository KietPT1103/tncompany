import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { getAreas } from "@/services/api";
import { useArea } from "@/features/areas/AreaProvider";
import type { Area } from "@/types";

export default function AreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const { selectArea } = useArea();
  async function loadAreas() {
    try {
      setLoading(true);
      setError("");
      const result = await getAreas();
      setAreas(result.items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Không tải được khu vực.";
      setError(message === "Forbidden"
        ? "Tài khoản chưa được cấp quyền xem phiếu nhập hiện trường. Hãy nhờ admin kiểm tra lại quyền tài khoản."
        : message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    getAreas().then((result) => {
      if (active) setAreas(result.items);
    }).catch((loadError) => {
      if (!active) return;
      const message = loadError instanceof Error ? loadError.message : "Không tải được khu vực.";
      setError(message === "Forbidden"
        ? "Tài khoản chưa được cấp quyền xem phiếu nhập hiện trường. Hãy nhờ admin kiểm tra lại quyền tài khoản."
        : message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return <Screen><Text style={styles.kicker}>KHU VỰC THAO TÁC</Text><Text style={styles.title}>Bạn đang nhập hàng ở đâu?</Text>
    {loading && <View style={styles.notice}><ActivityIndicator color="#059669" /><Text style={styles.noticeText}>Đang tải khu vực…</Text></View>}
    {!loading && error ? <View style={styles.errorNotice}><Text style={styles.errorText}>{error}</Text>
      <Pressable onPress={() => void loadAreas()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}
    {!loading && !error && areas.length === 0 ? <View style={styles.notice}><Text style={styles.noticeTitle}>Tài khoản chưa được cấp khu vực</Text>
      <Text style={styles.noticeText}>Admin cần mở Tài khoản, chọn Cafe, Lẩu/Bếp, Farm hoặc Kho trong phần Khu vực nhập hàng rồi lưu lại.</Text></View> : null}
    <View style={styles.grid}>{areas.map((area) => {
      const selecting = selectingId === area.id;
      return <Pressable
        key={area.id}
        disabled={selectingId !== null}
        accessibilityRole="button"
        accessibilityState={{ disabled: selectingId !== null, busy: selecting }}
        style={({ pressed }) => [styles.card, (pressed || selecting) && styles.cardPressed]}
        onPress={async () => {
          try {
            setSelectingId(area.id);
            await selectArea(area);
            router.replace("/home");
          } catch (error) {
            Alert.alert("Không thể chọn khu vực", error instanceof Error ? error.message : "Vui lòng thử lại.");
            setSelectingId(null);
          }
        }}
      >
        <View style={styles.cardRow}><View><Text style={styles.cardName}>{area.name}</Text><Text style={styles.cardCode}>{area.code}</Text></View>
          {selecting && <View style={styles.loading}><ActivityIndicator color="#059669" /><Text style={styles.loadingText}>Đang chọn…</Text></View>}
        </View>
      </Pressable>;
    })}</View>
  </Screen>;
}
const styles = StyleSheet.create({
  kicker: { color: "#059669", fontWeight: "800", letterSpacing: 1.5, marginTop: 28 }, title: { fontSize: 30, color: "#0f172a", fontWeight: "800", marginTop: 8 },
  grid: { gap: 14, marginTop: 32 }, card: { minHeight: 96, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dbeafe", padding: 20, justifyContent: "center" },
  notice: { marginTop: 24, borderRadius: 18, backgroundColor: "#fff", padding: 18, alignItems: "center", gap: 8 },
  noticeTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800", textAlign: "center" }, noticeText: { color: "#64748b", lineHeight: 20, textAlign: "center" },
  errorNotice: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff1f2", padding: 18, gap: 12 },
  errorText: { color: "#b91c1c", lineHeight: 20 }, retry: { color: "#059669", fontWeight: "800", textAlign: "center" },
  cardPressed: { opacity: 0.65 }, cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardName: { fontSize: 22, fontWeight: "800", color: "#0f172a" }, cardCode: { marginTop: 5, color: "#64748b", fontWeight: "600" },
  loading: { alignItems: "center", gap: 4 }, loadingText: { color: "#059669", fontSize: 12, fontWeight: "700" }
});
