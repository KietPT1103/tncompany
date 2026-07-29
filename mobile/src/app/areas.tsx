import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { getAreas } from "@/services/api";
import { useArea } from "@/features/areas/AreaProvider";
import type { Area } from "@/types";

export default function AreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const { selectArea } = useArea();
  useEffect(() => { getAreas().then((r) => setAreas(r.items)).catch((e) => Alert.alert("Không tải được khu vực", e.message)); }, []);
  return <Screen><Text style={styles.kicker}>KHU VỰC THAO TÁC</Text><Text style={styles.title}>Bạn đang nhập hàng ở đâu?</Text>
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
  cardPressed: { opacity: 0.65 }, cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardName: { fontSize: 22, fontWeight: "800", color: "#0f172a" }, cardCode: { marginTop: 5, color: "#64748b", fontWeight: "600" },
  loading: { alignItems: "center", gap: 4 }, loadingText: { color: "#059669", fontSize: 12, fontWeight: "700" }
});
