import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { useArea } from "@/features/areas/AreaProvider";
import { getReceipts } from "@/services/api";
import type { Receipt } from "@/types";

function deadlineLabel(receipt: Receipt, now: number) {
  if (!receipt.autoLockAt) return null;
  const minutes = Math.ceil((new Date(receipt.autoLockAt).getTime() - now) / 60000);
  if (!Number.isFinite(minutes)) return null;
  if (minutes <= 0) return { text: "Đã đến hạn khóa", urgent: true };
  if (minutes < 60) return { text: `Còn ${minutes} phút`, urgent: minutes <= 30 };
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return { text: `Còn ${hours} giờ${remainder ? ` ${remainder} phút` : ""}`, urgent: hours < 2 };
}

export default function PendingScreen() {
  const { area } = useArea();
  const [items, setItems] = useState<Receipt[]>([]);
  const [renderedAt, setRenderedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setRenderedAt(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useFocusEffect(useCallback(() => {
    if (!area) return;
    getReceipts(`status=pending_explanation&areaId=${encodeURIComponent(area.id)}&sort=newest&limit=50`)
      .then((r) => setItems(r.items)).catch((e) => Alert.alert("Không tải được phiếu", e.message));
  }, [area]));
  return <Screen><Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
    <Text style={styles.title}>Chưa giải trình</Text><Text style={styles.subtitle}>{area?.name} • Mới nhất trước • Đã ẩn phiếu bị khóa</Text>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>Không có phiếu đang chờ.</Text>}
      renderItem={({ item }) => {
        const deadline = deadlineLabel(item, renderedAt);
        return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.id } })}>
        <View><View style={styles.codeRow}><Text style={styles.code}>{item.receiptCode}</Text>{deadline && <Text style={[styles.deadline, deadline.urgent && styles.deadlineUrgent]}>{deadline.text}</Text>}</View><Text style={styles.meta}>{item.orderCreatorName || item.createdByName} • {new Date(item.createdAt).toLocaleString("vi-VN")}</Text>
          <Text style={styles.meta}>{item.imageCount} ảnh • Đã chờ {Math.max(0, Math.floor((renderedAt - new Date(item.createdAt).getTime()) / 60000))} phút</Text>
          {item.syncStatus && item.syncStatus !== "synced" && <Text style={styles.sync}>{item.syncStatus === "failed" ? "Đồng bộ lỗi — app sẽ tự thử lại" : "Đang chờ đồng bộ"}</Text>}</View>
        <Text style={styles.action}>{item.syncStatus && item.syncStatus !== "synced" ? "Xem →" : "Giải trình →"}</Text>
      </Pressable>;
      }} />
  </Screen>;
}
const styles = StyleSheet.create({
  back: { color: "#059669", fontWeight: "700", marginTop: 8 }, title: { fontSize: 30, fontWeight: "800", color: "#0f172a", marginTop: 18 },
  subtitle: { color: "#64748b", marginTop: 4 }, list: { gap: 12, paddingVertical: 20 }, empty: { textAlign: "center", color: "#94a3b8", marginTop: 80 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 14 }, code: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  deadline: { flexShrink: 0, overflow: "hidden", borderRadius: 999, backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  deadlineUrgent: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  pressed: { opacity: 0.55 }, meta: { color: "#64748b", marginTop: 5 }, sync: { color: "#d97706", marginTop: 6, fontWeight: "800" }, action: { color: "#059669", fontWeight: "800" }
});
