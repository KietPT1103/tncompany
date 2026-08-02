import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { useArea } from "@/features/areas/AreaProvider";
import { getReceipts } from "@/services/api";
import type { Receipt } from "@/types";

export default function PendingScreen() {
  const { area } = useArea();
  const [items, setItems] = useState<Receipt[]>([]);
  const [renderedAt] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    if (!area) return;
    getReceipts(`status=pending_explanation&areaId=${encodeURIComponent(area.id)}&sort=oldest&limit=50`)
      .then((r) => setItems(r.items)).catch((e) => Alert.alert("Không tải được phiếu", e.message));
  }, [area]));
  return <Screen><Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
    <Text style={styles.title}>Chưa giải trình</Text><Text style={styles.subtitle}>{area?.name} • Cũ nhất trước</Text>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>Không có phiếu đang chờ.</Text>}
      renderItem={({ item }) => <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.id } })}>
        <View><Text style={styles.code}>{item.receiptCode}</Text><Text style={styles.meta}>{item.orderCreatorName || item.createdByName} • {new Date(item.createdAt).toLocaleString("vi-VN")}</Text>
          <Text style={styles.meta}>{item.imageCount} ảnh • Đã chờ {Math.max(0, Math.floor((renderedAt - new Date(item.createdAt).getTime()) / 60000))} phút</Text></View>
        <Text style={styles.action}>Giải trình →</Text>
      </Pressable>} />
  </Screen>;
}
const styles = StyleSheet.create({
  back: { color: "#059669", fontWeight: "700", marginTop: 8 }, title: { fontSize: 30, fontWeight: "800", color: "#0f172a", marginTop: 18 },
  subtitle: { color: "#64748b", marginTop: 4 }, list: { gap: 12, paddingVertical: 20 }, empty: { textAlign: "center", color: "#94a3b8", marginTop: 80 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 14 }, code: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  pressed: { opacity: 0.55 }, meta: { color: "#64748b", marginTop: 5 }, action: { color: "#059669", fontWeight: "800" }
});
