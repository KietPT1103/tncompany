import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as Location from "expo-location";
import { captureRef } from "react-native-view-shot";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { createReceipt, uploadReceiptImage } from "@/services/api";
import { WatermarkPreview } from "@/features/inventory-receipts/WatermarkPreview";
import type { LocationMetadata } from "@/types";
import { enqueueQuickReceipt, type QuickReceiptJob } from "@/database/offline";

export default function CameraScreen() {
  const { mode = "quick" } = useLocalSearchParams<{ mode?: "quick" | "full" }>();
  const { area } = useArea();
  const { user } = useAuth();
  const camera = useRef<CameraView>(null);
  const composite = useRef<View>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<LocationMetadata | null>(null);
  const [rawUri, setRawUri] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.granted) {
        setLocation({ latitude: null, longitude: null, accuracy: null, address: "Không lấy được vị trí" });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let address = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      try {
        const places = await Location.reverseGeocodeAsync(position.coords);
        const place = places[0];
        if (place) address = [place.streetNumber, place.street, place.district, place.city, place.region].filter(Boolean).join(", ");
      } catch { /* coordinates remain as the required fallback */ }
      setLocation({
        latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, address
      });
    })().catch(() => setLocation({ latitude: null, longitude: null, accuracy: null, address: "Không lấy được vị trí" }));
  }, []);

  if (!area || !user) { router.replace("/"); return null; }
  if (!permission) return <View style={styles.center}><Text>Đang kiểm tra camera…</Text></View>;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.permission}>Cần quyền camera để chụp trực tiếp hóa đơn.</Text>
    <PrimaryButton title="Cho phép camera" onPress={requestPermission} /></View>;

  async function takePhoto() {
    if (!location) return Alert.alert("Đang lấy GPS", "Vui lòng chờ vị trí hoặc tọa độ dự phòng.");
    const photo = await camera.current?.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (photo) { setCapturedAt(new Date()); setRawUri(photo.uri); }
  }
  async function discard() {
    if (rawUri) { try { new File(rawUri).delete(); } catch {} }
    setRawUri(null); setCapturedAt(null);
  }
  async function usePhoto() {
    if (!rawUri || !capturedAt || !location || !composite.current || !area) return;
    let watermarkedUri = "";
    const clientRequestId = Crypto.randomUUID();
    const clientFileId = Crypto.randomUUID();
    try {
      setBusy(true);
      watermarkedUri = await captureRef(composite, { format: "jpg", quality: 0.92, result: "tmpfile", width: 1080, height: 1440 });
      new File(rawUri).delete();
      setRawUri(null);
      const createPayload = {
        clientRequestId, areaId: area.id, status: mode === "quick" ? "pending_explanation" as const : "draft" as const,
        capturedAt: capturedAt.toISOString(), location
      };
      const receipt = await createReceipt(createPayload);
      await uploadReceiptImage(receipt.item.id, watermarkedUri, {
        clientFileId, capturedAt: capturedAt.toISOString(), location, finalizeQuick: mode === "quick"
      });
      try { new File(watermarkedUri).delete(); } catch {}
      if (mode === "quick") {
        Alert.alert("Đã lưu", "Đã lưu vào danh sách Chưa giải trình.", [{ text: "OK", onPress: () => router.replace("/home") }]);
      } else {
        router.replace({ pathname: "/receipt/[id]", params: { id: receipt.item.id } });
      }
    } catch (error) {
      if (watermarkedUri) {
        const job: QuickReceiptJob = {
          createPayload: {
            clientRequestId, areaId: area.id, status: mode === "quick" ? "pending_explanation" : "draft",
            capturedAt: capturedAt.toISOString(), location
          },
          upload: { fileUri: watermarkedUri, clientFileId, capturedAt: capturedAt.toISOString(), location, finalizeQuick: mode === "quick" }
        };
        await enqueueQuickReceipt(job);
        const reason = error instanceof Error ? error.message : "Không thể kết nối máy chủ.";
        Alert.alert(
          "Đã lưu trên thiết bị",
          `Chưa thể đồng bộ: ${reason}\n\nPhiếu sẽ được thử lại khi có kết nối.`,
          [{ text: "OK", onPress: () => router.replace("/home") }]
        );
      } else {
        Alert.alert("Không thể lưu ảnh", error instanceof Error ? error.message : "Vui lòng thử lại.");
      }
    } finally { setBusy(false); }
  }

  if (rawUri && capturedAt && location) return <View style={styles.preview}>
    <WatermarkPreview ref={composite} uri={rawUri} capturedAt={capturedAt} area={area} user={user} location={location} />
    <View style={styles.previewActions}><PrimaryButton tone="secondary" title="Chụp lại" onPress={discard} disabled={busy} />
      <PrimaryButton title="Dùng ảnh này" onPress={usePhoto} loading={busy} /></View>
  </View>;

  return <View style={styles.cameraWrap}><CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
    <View style={styles.top}><Pressable onPress={() => router.back()}><Text style={styles.white}>‹ Quay lại</Text></Pressable>
      <Text style={styles.gps}>{location ? `GPS: ${location.address}` : "Đang lấy GPS…"}</Text></View>
    <View style={styles.bottom}><Text style={styles.area}>Khu vực: {area.name}</Text>
      <Pressable style={styles.shutter} onPress={takePhoto}><View style={styles.shutterInner} /></Pressable>
      <Text style={styles.hint}>Chỉ chụp trực tiếp • Không dùng thư viện ảnh</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, justifyContent: "center", gap: 20 }, permission: { fontSize: 18, textAlign: "center" },
  cameraWrap: { flex: 1, backgroundColor: "#000" }, top: { position: "absolute", top: 58, left: 20, right: 20, gap: 10 },
  white: { color: "#fff", fontSize: 17, fontWeight: "700" }, gps: { color: "#fff", backgroundColor: "rgba(0,0,0,.5)", borderRadius: 12, padding: 10 },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 38, alignItems: "center", gap: 12 },
  area: { color: "#fff", fontSize: 17, fontWeight: "800" }, shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#fff", padding: 6 },
  shutterInner: { flex: 1, borderRadius: 32, borderWidth: 3, borderColor: "#0f172a" }, hint: { color: "#e2e8f0" },
  preview: { flex: 1, backgroundColor: "#020617", justifyContent: "center" }, previewActions: { gap: 10, padding: 18, backgroundColor: "#f8fafc" }
});
