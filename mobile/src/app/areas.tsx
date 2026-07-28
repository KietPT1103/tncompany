import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { getAreas } from "@/services/api";
import { useArea } from "@/features/areas/AreaProvider";
import type { Area } from "@/types";

export default function AreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const { selectArea } = useArea();
  useEffect(() => { getAreas().then((r) => setAreas(r.items)).catch((e) => Alert.alert("Không tải được khu vực", e.message)); }, []);
  return <Screen><Text style={styles.kicker}>KHU VỰC THAO TÁC</Text><Text style={styles.title}>Bạn đang nhập hàng ở đâu?</Text>
    <View style={styles.grid}>{areas.map((area) => <Pressable key={area.id} style={styles.card} onPress={async () => {
      await selectArea(area); router.replace("/home");
    }}><Text style={styles.cardName}>{area.name}</Text><Text style={styles.cardCode}>{area.code}</Text></Pressable>)}</View>
  </Screen>;
}
const styles = StyleSheet.create({
  kicker: { color: "#059669", fontWeight: "800", letterSpacing: 1.5, marginTop: 28 }, title: { fontSize: 30, color: "#0f172a", fontWeight: "800", marginTop: 8 },
  grid: { gap: 14, marginTop: 32 }, card: { minHeight: 96, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dbeafe", padding: 20, justifyContent: "center" },
  cardName: { fontSize: 22, fontWeight: "800", color: "#0f172a" }, cardCode: { marginTop: 5, color: "#64748b", fontWeight: "600" }
});
