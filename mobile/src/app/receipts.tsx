import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text } from "react-native";
import { Screen } from "@/components/Screen";
import { useArea } from "@/features/areas/AreaProvider";
import { getReceipts } from "@/services/api";
import type { Receipt } from "@/types";
export default function ReceiptsScreen() {
  const { area } = useArea(); const [items, setItems] = useState<Receipt[]>([]);
  useFocusEffect(useCallback(() => { if (area) getReceipts(`areaId=${area.id}&sort=newest&limit=50`).then((r) => setItems(r.items)).catch((e) => Alert.alert("Lỗi", e.message)); }, [area]));
  return <Screen><Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable><Text style={styles.title}>Phiếu gần đây</Text>
    <FlatList data={items} keyExtractor={(x) => x.id} contentContainerStyle={{ gap: 10, paddingVertical: 20 }} renderItem={({ item }) =>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.id } })}>
        <Text style={styles.code}>{item.receiptCode}</Text><Text style={styles.meta}>{item.status} • {item.itemCount} món • {item.totalAmount.toLocaleString("vi-VN")} ₫{item.syncStatus && item.syncStatus !== "synced" ? ` • ${item.syncStatus === "failed" ? "Lỗi đồng bộ" : "Chờ đồng bộ"}` : ""}</Text>
      </Pressable>} /></Screen>;
}
const styles = StyleSheet.create({ back: { color: "#059669", fontWeight: "700" }, pressed: { opacity: 0.55 }, title: { fontSize: 30, fontWeight: "800", marginTop: 18 }, card: { backgroundColor: "#fff", borderRadius: 18, padding: 18 }, code: { fontWeight: "800", fontSize: 17 }, meta: { color: "#64748b", marginTop: 6 } });
