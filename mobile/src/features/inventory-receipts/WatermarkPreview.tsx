import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Area, LocationMetadata } from "@/types";

export const WatermarkPreview = forwardRef<View, {
  uri: string; capturedAt: Date; area: Area; location: LocationMetadata;
}>(function WatermarkPreview({ uri, capturedAt, area, location }, ref) {
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(capturedAt);
  const date = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(capturedAt);
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(capturedAt);
  return <View ref={ref} collapsable={false} style={styles.frame}>
    <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
    <View style={styles.shade} />
    <View style={styles.watermark}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.weekday}>{weekday}</Text>
      <View style={styles.rule} />
      <Text style={styles.address} numberOfLines={2}>{location.address}</Text>
      <Text style={styles.meta} numberOfLines={1}>Công ty: TN Company</Text>
      <Text style={styles.meta} numberOfLines={1}>Khu vực: {area.name}</Text>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#0f172a", overflow: "hidden" },
  shade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,.08)" },
  watermark: { position: "absolute", left: 10, bottom: 10, width: "64%", padding: 9, borderRadius: 11, backgroundColor: "rgba(0,0,0,.52)" },
  time: { color: "#fff", fontSize: 24, lineHeight: 27, fontWeight: "300" }, date: { color: "#fff", fontSize: 12, lineHeight: 15, fontWeight: "700" },
  weekday: { color: "#e2e8f0", fontSize: 10, lineHeight: 13, textTransform: "capitalize" },
  rule: { height: 2, width: 34, backgroundColor: "#fbbf24", marginVertical: 5 },
  address: { color: "#fff", fontSize: 10, lineHeight: 13, marginBottom: 4 }, meta: { color: "#fff", fontSize: 10, lineHeight: 13, fontWeight: "600" }
});
