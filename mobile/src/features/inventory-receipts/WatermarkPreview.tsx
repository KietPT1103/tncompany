import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { AppUser, Area, LocationMetadata } from "@/types";

export const WatermarkPreview = forwardRef<View, {
  uri: string; capturedAt: Date; area: Area; user: AppUser; location: LocationMetadata;
}>(function WatermarkPreview({ uri, capturedAt, area, user, location }, ref) {
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
      <Text style={styles.address}>{location.address}</Text>
      <Text style={styles.meta}>Công ty: TN Company</Text>
      <Text style={styles.meta}>Khu vực: {area.name}</Text>
      <Text style={styles.meta}>Họ tên: {user.displayName}</Text>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#0f172a", overflow: "hidden" },
  shade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,.08)" },
  watermark: { position: "absolute", left: 22, right: 22, bottom: 24, padding: 18, borderRadius: 18, backgroundColor: "rgba(0,0,0,.52)" },
  time: { color: "#fff", fontSize: 48, lineHeight: 52, fontWeight: "300" }, date: { color: "#fff", fontSize: 18, fontWeight: "700" },
  weekday: { color: "#e2e8f0", fontSize: 16, marginTop: 2, textTransform: "capitalize" },
  rule: { height: 2, width: 64, backgroundColor: "#fbbf24", marginVertical: 12 },
  address: { color: "#fff", fontSize: 14, lineHeight: 20, marginBottom: 8 }, meta: { color: "#fff", fontSize: 14, lineHeight: 20, fontWeight: "600" }
});
