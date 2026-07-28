import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import {
  API_BASE_URL, addReceiptItem, attachProduct, completeReceipt, createProduct, getReceipt, getToken,
  searchProducts, type ProductSearchResult
} from "@/services/api";
import type { Receipt } from "@/types";

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { area } = useArea();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [token, setToken] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newUnit, setNewUnit] = useState("");

  async function reload() { setReceipt((await getReceipt(id)).item); }
  useEffect(() => {
    getReceipt(id).then((data) => setReceipt(data.item)).catch((e) => Alert.alert("Không tải được phiếu", e.message));
    getToken().then((value) => setToken(value || ""));
  }, [id]);
  useEffect(() => {
    if (!area || query.trim().length < 2) return;
    const timer = setTimeout(() => searchProducts(query.trim(), area.id).then((r) => setResults(r.items)).catch(() => setResults([])), 300);
    return () => clearTimeout(timer);
  }, [query, area]);

  const lineTotal = useMemo(() => (Number(quantity) || 0) * (Number(price) || 0), [quantity, price]);
  if (!receipt || !area) return <Screen><Text>Đang tải phiếu…</Text></Screen>;
  const currentReceipt = receipt;
  const currentArea = area;
  const editable = currentReceipt.status === "pending_explanation" || currentReceipt.status === "draft";

  async function selectProduct(product: ProductSearchResult) {
    try {
      if (!product.attachedToCurrentArea) {
        const attached = await attachProduct(product.id, currentArea.id);
        setSelected({ ...product, id: attached.item.id, areaId: currentArea.id, attachedToCurrentArea: true });
      } else setSelected(product);
      setQuery(product.productName); setResults([]);
    } catch (e) { Alert.alert("Không thể thêm vào khu", e instanceof Error ? e.message : "Vui lòng thử lại."); }
  }
  async function addItem() {
    if (!selected) return Alert.alert("Chưa chọn sản phẩm");
    try {
      setBusy(true);
      await addReceiptItem({ receiptId: currentReceipt.id, productId: selected.id, quantity: Number(quantity), unitPrice: Number(price), note });
      setQuery(""); setSelected(null); setQuantity(""); setPrice(""); setNote(""); await reload();
    } catch (e) { Alert.alert("Không thể thêm món", e instanceof Error ? e.message : "Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function createNew() {
    try {
      setBusy(true);
      const created = await createProduct({
        areaId: currentArea.id, productCode: newCode, productName: query.trim(), unit: newUnit
      });
      setSelected({ ...created.item, attachedToCurrentArea: true }); setCreateOpen(false); setResults([]);
    } catch (e) { Alert.alert("Không thể tạo sản phẩm", e instanceof Error ? e.message : "Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function finish() {
    Alert.alert("Hoàn thành nhập kho", `${currentReceipt.items.length} món • ${currentReceipt.totalAmount.toLocaleString("vi-VN")} ₫`, [
      { text: "Kiểm tra lại", style: "cancel" },
      { text: "Hoàn thành nhập kho", onPress: async () => {
        try { setBusy(true); setReceipt((await completeReceipt(currentReceipt.id)).item); Alert.alert("Đã hoàn thành", "Tồn kho đã được cập nhật."); }
        catch (e) { Alert.alert("Không thể hoàn thành", e instanceof Error ? e.message : "Vui lòng thử lại."); }
        finally { setBusy(false); }
      }}
    ]);
  }

  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
    <View style={styles.header}><View><Text style={styles.code}>{receipt.receiptCode}</Text><Text style={styles.area}>Khu đang thao tác: {area.name}</Text></View>
      <Text style={[styles.badge, receipt.status === "completed" && styles.done]}>{receipt.status}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {receipt.images.map((image) => <Image key={image.id} source={{ uri: `${API_BASE_URL}${image.url}`, headers: { Authorization: `Bearer ${token}` } }} style={styles.photo} />)}
    </ScrollView>

    <Text style={styles.section}>Các món đã nhập</Text>
    {receipt.items.map((item) => <View key={item.id} style={styles.item}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.productName}</Text>
      <Text style={styles.itemMeta}>{item.quantity} {item.unit} × {item.unitPrice.toLocaleString("vi-VN")} ₫</Text></View>
      <Text style={styles.itemTotal}>{item.lineTotal.toLocaleString("vi-VN")} ₫</Text></View>)}
    {receipt.items.length === 0 && <Text style={styles.empty}>Chưa có món hàng nào.</Text>}

    {editable && <View style={styles.form}><Text style={styles.section}>Thêm món hàng</Text>
      <TextInput value={query} onChangeText={(value) => { setQuery(value); setSelected(null); }} placeholder="Tìm tên hoặc mã sản phẩm" style={styles.input} />
      {results.length > 0 && <View style={styles.results}>{results.map((product) => <Pressable key={`${product.areaId}-${product.id}`} style={styles.result} onPress={() => selectProduct(product)}>
        <View style={{ flex: 1 }}><Text style={styles.resultName}>{product.productName}</Text><Text style={styles.itemMeta}>{product.productCode} • {product.unit || "Chưa có đơn vị"}</Text>
          {!product.attachedToCurrentArea && <Text style={styles.attach}>Đã tồn tại – chưa dùng tại {area.name}. Nhấn để thêm.</Text>}</View></Pressable>)}
        <Pressable style={styles.create} onPress={() => { setNewCode(""); setNewUnit(""); setCreateOpen(true); }}><Text style={styles.createText}>+ Tạo mới “{query.trim()}”</Text></Pressable>
      </View>}
      {query.trim().length >= 2 && results.length === 0 && !selected && <Pressable style={styles.createSolo} onPress={() => setCreateOpen(true)}><Text style={styles.createText}>+ Tạo mới “{query.trim()}”</Text></Pressable>}
      {selected && <Text style={styles.selected}>Đã chọn: {selected.productName} • {selected.unit}</Text>}
      <View style={styles.row}><TextInput keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} placeholder="Số lượng" style={[styles.input, styles.half]} />
        <TextInput keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="Đơn giá" style={[styles.input, styles.half]} /></View>
      <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú (tùy chọn)" style={styles.input} />
      <Text style={styles.provisional}>Thành tiền: {lineTotal.toLocaleString("vi-VN")} ₫</Text>
      <PrimaryButton title="Thêm món" onPress={addItem} loading={busy} disabled={!selected || Number(quantity) <= 0 || Number(price) < 0 || price === ""} />
    </View>}
    <View style={styles.summary}><Text style={styles.summaryLabel}>Tổng số lượng</Text><Text style={styles.summaryValue}>{receipt.totalQuantity}</Text>
      <Text style={styles.summaryLabel}>Tổng tiền</Text><Text style={styles.total}>{receipt.totalAmount.toLocaleString("vi-VN")} ₫</Text></View>
    {editable && <PrimaryButton title="Hoàn thành nhập kho" onPress={finish} loading={busy} disabled={receipt.items.length === 0 || receipt.images.length === 0} />}
  </ScrollView>

  <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
    <View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Tạo hàng hóa mới</Text>
      <Text style={styles.prefill}>Tên sản phẩm: {query.trim()}</Text>
      <TextInput value={newCode} onChangeText={setNewCode} placeholder="Mã sản phẩm" style={styles.input} />
      <TextInput value={newUnit} onChangeText={setNewUnit} placeholder="Đơn vị tính *" style={styles.input} />
      <PrimaryButton title="Tạo và thêm vào khu" onPress={createNew} loading={busy} disabled={!query.trim() || !newCode.trim() || !newUnit.trim()} />
      <Pressable onPress={() => setCreateOpen(false)}><Text style={styles.cancel}>Hủy</Text></Pressable>
    </View></View>
  </Modal></Screen>;
}
const styles = StyleSheet.create({
  content: { paddingBottom: 32 }, back: { color: "#059669", fontWeight: "700" }, header: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  code: { fontSize: 26, fontWeight: "800", color: "#0f172a" }, area: { color: "#64748b", marginTop: 5 }, badge: { backgroundColor: "#fef3c7", color: "#92400e", padding: 8, borderRadius: 10, alignSelf: "flex-start", fontSize: 11 },
  done: { backgroundColor: "#d1fae5", color: "#065f46" }, gallery: { gap: 10, paddingVertical: 20 }, photo: { width: 260, height: 340, borderRadius: 20, backgroundColor: "#e2e8f0" },
  section: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 10 }, item: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 15, marginBottom: 9 },
  itemName: { fontSize: 16, fontWeight: "700" }, itemMeta: { color: "#64748b", marginTop: 4 }, itemTotal: { fontWeight: "800" }, empty: { color: "#94a3b8", marginBottom: 18 },
  form: { backgroundColor: "#ecfdf5", borderRadius: 22, padding: 16, marginTop: 16, gap: 10 }, input: { minHeight: 52, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  results: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" }, result: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, resultName: { fontWeight: "800" },
  attach: { color: "#d97706", marginTop: 5, fontSize: 12 }, create: { padding: 14 }, createSolo: { backgroundColor: "#fff", borderRadius: 14, padding: 14 }, createText: { color: "#059669", fontWeight: "800" },
  selected: { color: "#047857", fontWeight: "700" }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, provisional: { textAlign: "right", fontWeight: "800", color: "#334155" },
  summary: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginVertical: 20 }, summaryLabel: { color: "#64748b", marginTop: 4 }, summaryValue: { fontSize: 18, fontWeight: "700" },
  total: { fontSize: 28, color: "#059669", fontWeight: "900", marginTop: 4 }, modalShade: { flex: 1, backgroundColor: "rgba(15,23,42,.55)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 12 }, modalTitle: { fontSize: 24, fontWeight: "800" }, prefill: { color: "#334155", fontWeight: "600" },
  cancel: { textAlign: "center", padding: 12, color: "#64748b", fontWeight: "700" }
});
