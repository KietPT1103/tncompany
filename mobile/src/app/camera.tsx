import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as Location from "expo-location";
import { Asset, requestPermissionsAsync as requestMediaLibraryPermissionsAsync } from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { createReceipt, uploadReceiptImage } from "@/services/api";
import { WatermarkPreview } from "@/features/inventory-receipts/WatermarkPreview";
import type { LocationMetadata } from "@/types";
import { enqueueQuickReceipt, type QuickReceiptJob } from "@/database/offline";

type CapturedPhoto = {
  fileUri: string;
  clientFileId: string;
  capturedAt: string;
  location: LocationMetadata;
};

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
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const clientRequestId = useRef(Crypto.randomUUID());
  const galleryPermissionChecked = useRef(false);
  const galleryPermissionGranted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
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
    <PrimaryButton title="Cho phép camera" loadingTitle="Đang cấp quyền…" onPress={requestPermission} /></View>;

  async function takePhoto() {
    if (!location) return Alert.alert("Đang lấy GPS", "Vui lòng chờ vị trí hoặc tọa độ dự phòng.");
    try {
      setCapturing(true);
      const photo = await camera.current?.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (photo) { setCapturedAt(new Date()); setRawUri(photo.uri); }
    } catch (error) {
      Alert.alert("Không thể chụp ảnh", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setCapturing(false);
    }
  }
  async function discard() {
    if (rawUri) { try { new File(rawUri).delete(); } catch {} }
    setRawUri(null); setCapturedAt(null);
  }
  async function saveToGallery(fileUri: string) {
    if (!galleryPermissionChecked.current) {
      const permission = await requestMediaLibraryPermissionsAsync(true, ["photo"]);
      galleryPermissionChecked.current = true;
      galleryPermissionGranted.current = permission.granted;
    }
    if (!galleryPermissionGranted.current) return false;
    await Asset.create(fileUri);
    return true;
  }
  async function acceptPhoto() {
    if (!rawUri || !capturedAt || !location || !composite.current || !area) return;
    try {
      setBusy(true);
      const watermarkedUri = await captureRef(composite, { format: "jpg", quality: 0.92, result: "tmpfile", width: 1080, height: 1440 });
      try {
        const saved = await saveToGallery(watermarkedUri);
        if (!saved) Alert.alert("Chưa lưu vào thư viện", "Bạn chưa cấp quyền lưu ảnh. Ảnh vẫn được giữ để gửi lên phiếu.");
      } catch {
        Alert.alert("Chưa lưu vào thư viện", "Ảnh vẫn được giữ để gửi lên phiếu, nhưng chưa thể sao chép vào kho ảnh của điện thoại.");
      }
      try { new File(rawUri).delete(); } catch {}
      setPhotos((current) => [...current, {
        fileUri: watermarkedUri,
        clientFileId: Crypto.randomUUID(),
        capturedAt: capturedAt.toISOString(),
        location
      }]);
      setRawUri(null);
      setCapturedAt(null);
    } catch (error) {
      Alert.alert("Không thể lưu ảnh", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally { setBusy(false); }
  }
  async function finishPhotos() {
    if (photos.length === 0 || !area) return Alert.alert("Chưa có ảnh", "Hãy chụp ít nhất một ảnh trước khi hoàn tất.");
    const first = photos[0];
    const createPayload = {
      clientRequestId: clientRequestId.current,
      areaId: area.id,
      status: mode === "quick" ? "pending_explanation" as const : "draft" as const,
      capturedAt: first.capturedAt,
      location: first.location
    };
    try {
      setBusy(true);
      const receipt = await createReceipt(createPayload);
      for (const [index, photo] of photos.entries()) {
        await uploadReceiptImage(receipt.item.id, photo.fileUri, {
          clientFileId: photo.clientFileId,
          capturedAt: photo.capturedAt,
          location: photo.location,
          finalizeQuick: mode === "quick" && index === photos.length - 1
        });
      }
      for (const photo of photos) {
        try { new File(photo.fileUri).delete(); } catch {}
      }
      if (mode === "quick") {
        Alert.alert("Đã lưu", `Đã tải ${photos.length} ảnh và lưu vào danh sách Chưa giải trình.`, [{ text: "OK", onPress: () => router.replace("/home") }]);
      } else {
        router.replace({ pathname: "/receipt/[id]", params: { id: receipt.item.id } });
      }
    } catch (error) {
      const job: QuickReceiptJob = {
        createPayload,
        uploads: photos.map((photo, index) => ({
          ...photo,
          finalizeQuick: mode === "quick" && index === photos.length - 1
        }))
      };
      await enqueueQuickReceipt(job);
      const reason = error instanceof Error ? error.message : "Không thể kết nối máy chủ.";
      Alert.alert(
        "Đã lưu trên thiết bị",
        `Đã giữ ${photos.length} ảnh. Chưa thể đồng bộ: ${reason}\n\nPhiếu sẽ được thử lại khi có kết nối.`,
        [{ text: "OK", onPress: () => router.replace("/home") }]
      );
    } finally { setBusy(false); }
  }

  if (rawUri && capturedAt && location) return <View style={styles.preview}>
    <WatermarkPreview ref={composite} uri={rawUri} capturedAt={capturedAt} area={area} user={user} location={location} />
    <View style={styles.previewActions}><PrimaryButton tone="secondary" title="Chụp lại" onPress={discard} disabled={busy} />
      <PrimaryButton title={`Thêm ảnh này (${photos.length + 1})`} loadingTitle="Đang lưu ảnh…" onPress={acceptPhoto} loading={busy} /></View>
  </View>;

  return <View style={styles.cameraWrap}><CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
    <View style={styles.top}><Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.back()}><Text style={styles.white}>‹ Quay lại</Text></Pressable>
      <Text style={styles.gps}>{location ? `GPS: ${location.address}` : "Đang lấy GPS…"}</Text>
      {photos.length > 0 && <Text style={styles.photoCount}>Đã chụp {photos.length} ảnh</Text>}</View>
    <View style={styles.bottom}><Text style={styles.area}>Khu vực: {area.name}</Text>
      <View style={styles.captureRow}>
        <View style={styles.sideAction} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chụp ảnh"
          accessibilityState={{ disabled: busy || capturing, busy: capturing }}
          style={({ pressed }) => [styles.shutter, capturing && styles.shutterBusy, pressed && styles.pressed]}
          onPress={takePhoto}
          disabled={busy || capturing}
        >{capturing ? <ActivityIndicator color="#0f172a" size="large" /> : <View style={styles.shutterInner} />}</Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: photos.length === 0 || busy || capturing, busy }}
          style={({ pressed }) => [styles.finish, (photos.length === 0 || busy || capturing) && styles.finishDisabled, pressed && styles.pressed]}
          onPress={finishPhotos}
          disabled={photos.length === 0 || busy || capturing}
        >
          {busy ? <><ActivityIndicator color="#fff" /><Text style={styles.finishCount}>Đang tải…</Text></> : <><Text style={styles.finishText}>Hoàn tất</Text><Text style={styles.finishCount}>{photos.length} ảnh</Text></>}
        </Pressable>
      </View>
      <Text style={styles.hint}>Ảnh dùng sẽ tự lưu vào thư viện • Có thể chụp nhiều ảnh</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, justifyContent: "center", gap: 20 }, permission: { fontSize: 18, textAlign: "center" },
  cameraWrap: { flex: 1, backgroundColor: "#000" }, top: { position: "absolute", top: 58, left: 20, right: 20, gap: 10 },
  white: { color: "#fff", fontSize: 17, fontWeight: "700" }, gps: { color: "#fff", backgroundColor: "rgba(0,0,0,.5)", borderRadius: 12, padding: 10 },
  pressed: { opacity: 0.55 },
  photoCount: { alignSelf: "flex-start", color: "#064e3b", backgroundColor: "#d1fae5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: "800" },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 38, alignItems: "center", gap: 12 },
  area: { color: "#fff", fontSize: 17, fontWeight: "800" }, shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#fff", padding: 6 },
  shutterBusy: { alignItems: "center", justifyContent: "center", opacity: 0.75 },
  captureRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sideAction: { width: 86 },
  finish: { width: 86, minHeight: 52, borderRadius: 14, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", padding: 7 },
  finishDisabled: { opacity: 0.45 },
  finishText: { color: "#fff", fontWeight: "900" }, finishCount: { color: "#d1fae5", fontSize: 11, marginTop: 2 },
  shutterInner: { flex: 1, borderRadius: 32, borderWidth: 3, borderColor: "#0f172a" }, hint: { color: "#e2e8f0", textAlign: "center" },
  preview: { flex: 1, backgroundColor: "#020617", justifyContent: "center" }, previewActions: { gap: 10, padding: 18, backgroundColor: "#f8fafc" }
});
