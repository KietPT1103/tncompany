import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View
} from "react-native";
import { FormField } from "@/components/FormField";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import {
  addReceiptItem, apiAssetUrl, attachProduct, completeReceipt, createProduct, getNextProductCode, getReceipt, getToken,
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"add" | "create" | "complete" | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [preparingCreate, setPreparingCreate] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState("NL1");
  const [newCode, setNewCode] = useState("");
  const [newUnit, setNewUnit] = useState("");

  async function reload() { setReceipt((await getReceipt(id)).item); }
  useEffect(() => {
    getReceipt(id).then((data) => setReceipt(data.item)).catch((e) => Alert.alert("Không tải được phiếu", e.message));
    getToken().then((value) => setToken(value || ""));
  }, [id]);
  useEffect(() => {
    if (!area || !suggestionsOpen) return;
    const timer = setTimeout(() => searchProducts(query.trim(), area.id).then((r) => {
      setResults(r.items);
      setSuggestedCode(r.suggestedCode || "NL1");
      setSearchError("");
    }).catch((error) => {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Không thể tải danh sách nguyên liệu.");
    }), 250);
    return () => clearTimeout(timer);
  }, [query, area, suggestionsOpen]);

  const lineTotal = useMemo(() => (Number(quantity) || 0) * (Number(price) || 0), [quantity, price]);
  if (!receipt || !area) return <Screen><Text>Đang tải phiếu…</Text></Screen>;
  const currentReceipt = receipt;
  const currentArea = area;
  const editable = currentReceipt.status === "pending_explanation" || currentReceipt.status === "draft";

  async function selectProduct(product: ProductSearchResult) {
    try {
      setSelectingProductId(product.id);
      if (!product.attachedToCurrentArea) {
        const attached = await attachProduct(product.id, currentArea.id);
        setSelected({ ...product, id: attached.item.id, areaId: currentArea.id, attachedToCurrentArea: true });
      } else setSelected(product);
      setQuery(product.productName); setResults([]); setSuggestionsOpen(false); setSearchError("");
    } catch (e) { Alert.alert("Không thể thêm vào khu", e instanceof Error ? e.message : "Vui lòng thử lại."); }
    finally { setSelectingProductId(null); }
  }
  async function addItem() {
    if (!selected) return Alert.alert("Chưa chọn nguyên liệu");
    try {
      setPendingAction("add");
      await addReceiptItem({ receiptId: currentReceipt.id, productId: selected.id, quantity: Number(quantity), unitPrice: Number(price), note });
      setQuery(""); setSelected(null); setQuantity(""); setPrice(""); setNote(""); await reload();
    } catch (e) { Alert.alert("Không thể thêm nguyên liệu", e instanceof Error ? e.message : "Vui lòng thử lại."); }
    finally { setPendingAction(null); }
  }
  async function createNew() {
    try {
      setPendingAction("create");
      const created = await createProduct({
        areaId: currentArea.id, ingredientCode: newCode, ingredientName: query.trim(), unit: newUnit
      });
      setSelected({ ...created.item, attachedToCurrentArea: true }); setCreateOpen(false); setResults([]);
    } catch (e) { Alert.alert("Không thể tạo nguyên liệu", e instanceof Error ? e.message : "Vui lòng thử lại."); }
    finally { setPendingAction(null); }
  }
  async function openCreateModal() {
    try {
      setPreparingCreate(true);
      const result = await getNextProductCode(currentArea.id);
      setSuggestedCode(result.suggestedCode || "NL1");
      setNewCode(result.suggestedCode || "NL1");
      setNewUnit("");
      setCreateOpen(true);
    } catch (error) {
      Alert.alert("Không thể lấy mã nguyên liệu", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setPreparingCreate(false);
    }
  }
  async function finish() {
    Alert.alert("Hoàn thành nhập kho", `${currentReceipt.items.length} nguyên liệu • ${currentReceipt.totalAmount.toLocaleString("vi-VN")} ₫`, [
      { text: "Kiểm tra lại", style: "cancel" },
      { text: "Hoàn thành nhập kho", onPress: async () => {
        try { setPendingAction("complete"); setReceipt((await completeReceipt(currentReceipt.id)).item); Alert.alert("Đã hoàn thành", "Tồn kho đã được cập nhật."); }
        catch (e) { Alert.alert("Không thể hoàn thành", e instanceof Error ? e.message : "Vui lòng thử lại."); }
        finally { setPendingAction(null); }
      }}
    ]);
  }

  return <Screen><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
  <ScrollView
    contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled"
    automaticallyAdjustKeyboardInsets
  >
    <Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
    <View style={styles.header}><View><Text style={styles.code}>{receipt.receiptCode}</Text><Text style={styles.area}>Khu đang thao tác: {area.name}</Text>
      <Text style={styles.area}>Nhà phân phối: {receipt.supplier?.supplierName || "Chưa chọn"}</Text></View>
      <Text style={[styles.badge, receipt.status === "completed" && styles.done]}>{receipt.status}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {receipt.images.map((image) => <Image
        key={image.id}
        source={{ uri: apiAssetUrl(image.url), headers: { Authorization: `Bearer ${token}` } }}
        style={styles.photo}
        resizeMode="cover"
      />)}
    </ScrollView>

    <Text style={styles.section}>Các nguyên liệu đã nhập</Text>
    {receipt.items.map((item) => <View key={item.id} style={styles.item}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.productName}</Text>
      <Text style={styles.itemMeta}>{item.quantity} {item.unit} × {item.unitPrice.toLocaleString("vi-VN")} ₫</Text></View>
      <Text style={styles.itemTotal}>{item.lineTotal.toLocaleString("vi-VN")} ₫</Text></View>)}
    {receipt.items.length === 0 && <Text style={styles.empty}>Chưa có nguyên liệu nào.</Text>}

    {editable && <View style={styles.form}><Text style={styles.section}>Thêm nguyên liệu</Text>
      <FormField
        label="Nguyên liệu"
        required
        value={query}
        onFocus={() => setSuggestionsOpen(true)}
        onChangeText={(value) => { setQuery(value); setSelected(null); setSuggestionsOpen(true); }}
        placeholder="Nhập tên hoặc mã nguyên liệu để tìm"
        autoCorrect={false}
        returnKeyType="search"
        hint="Chạm vào ô để xem toàn bộ nguyên liệu của quầy, hoặc nhập tên/mã để lọc."
      />
      {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
      {suggestionsOpen && results.length > 0 && <View style={styles.results}>{results.map((product) => {
        const selecting = selectingProductId === product.id;
        return <Pressable
          key={`${product.areaId}-${product.id}`}
          disabled={selectingProductId !== null}
          accessibilityRole="button"
          accessibilityState={{ disabled: selectingProductId !== null, busy: selecting }}
          style={({ pressed }) => [styles.result, (pressed || selecting) && styles.pressed]}
          onPress={() => selectProduct(product)}
        >
        <View style={{ flex: 1 }}><Text style={styles.resultName}>{product.productName}</Text><Text style={styles.itemMeta}>{product.productCode} • {product.unit || "Chưa có đơn vị"}</Text>
          {!product.attachedToCurrentArea && <Text style={styles.attach}>Đã tồn tại – chưa dùng tại {area.name}. Nhấn để thêm.</Text>}</View>
          {selecting && <View style={styles.selecting}><ActivityIndicator color="#059669" /><Text style={styles.selectingText}>Đang chọn…</Text></View>}
        </Pressable>;
      })}
        {query.trim().length >= 2 && <Pressable disabled={preparingCreate} style={({ pressed }) => [styles.create, (pressed || preparingCreate) && styles.pressed]} onPress={openCreateModal}>
          {preparingCreate ? <View style={styles.preparing}><ActivityIndicator color="#059669" /><Text style={styles.createText}>Đang lấy mã mới…</Text></View> : <Text style={styles.createText}>+ Tạo mới “{query.trim()}”</Text>}
        </Pressable>}
      </View>}
      {suggestionsOpen && query.trim().length >= 2 && results.length === 0 && !selected && !searchError && <Pressable disabled={preparingCreate} style={({ pressed }) => [styles.createSolo, (pressed || preparingCreate) && styles.pressed]} onPress={openCreateModal}>
        {preparingCreate ? <View style={styles.preparing}><ActivityIndicator color="#059669" /><Text style={styles.createText}>Đang lấy mã mới…</Text></View> : <Text style={styles.createText}>+ Tạo mới “{query.trim()}”</Text>}
      </Pressable>}
      {selected && <Text style={styles.selected}>Đã chọn: {selected.productName} • {selected.unit}</Text>}
      <View style={styles.row}>
        <FormField
          label="Số lượng"
          required
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Ví dụ: 10"
          containerStyle={styles.half}
        />
        <FormField
          label="Đơn giá"
          required
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          placeholder="Ví dụ: 25000"
          containerStyle={styles.half}
        />
      </View>
      <FormField
        label="Ghi chú"
        value={note}
        onChangeText={setNote}
        placeholder="Ví dụ: số lô, hạn sử dụng hoặc tình trạng hàng"
        multiline
        numberOfLines={3}
      />
      <Text style={styles.provisional}>Thành tiền: {lineTotal.toLocaleString("vi-VN")} ₫</Text>
      <PrimaryButton title="Thêm nguyên liệu" loadingTitle="Đang thêm nguyên liệu…" onPress={addItem} loading={pendingAction === "add"} disabled={pendingAction !== null || !selected || Number(quantity) <= 0 || Number(price) < 0 || price === ""} />
    </View>}
    <View style={styles.summary}><Text style={styles.summaryLabel}>Tổng số lượng</Text><Text style={styles.summaryValue}>{receipt.totalQuantity}</Text>
      <Text style={styles.summaryLabel}>Tổng tiền</Text><Text style={styles.total}>{receipt.totalAmount.toLocaleString("vi-VN")} ₫</Text></View>
    {editable && <PrimaryButton title="Hoàn thành nhập kho" loadingTitle="Đang hoàn thành…" onPress={finish} loading={pendingAction === "complete"} disabled={pendingAction !== null || receipt.items.length === 0 || receipt.images.length === 0} />}
  </ScrollView></KeyboardAvoidingView>

  <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalShade}>
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modal}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.modalTitle}>Tạo nguyên liệu mới</Text>
        <View style={styles.prefillBox}>
          <Text style={styles.prefillLabel}>Tên nguyên liệu</Text>
          <Text style={styles.prefill}>{query.trim()}</Text>
        </View>
        <FormField
          label="Mã nguyên liệu"
          required
          value={newCode}
          onChangeText={setNewCode}
          placeholder="Ví dụ: SP-001"
          autoCapitalize="characters"
          autoCorrect={false}
          hint={`Đã tự lấy mã kế tiếp từ hệ thống (${suggestedCode}). Bạn vẫn có thể sửa mã nguyên liệu này.`}
        />
        <FormField
          label="Đơn vị tính"
          required
          value={newUnit}
          onChangeText={setNewUnit}
          placeholder="Ví dụ: kg, thùng, chai"
          returnKeyType="done"
        />
        <PrimaryButton title="Tạo và thêm vào khu" loadingTitle="Đang tạo nguyên liệu…" onPress={createNew} loading={pendingAction === "create"} disabled={pendingAction !== null || !query.trim() || !newCode.trim() || !newUnit.trim()} />
        <Pressable style={({ pressed }) => pressed && styles.pressed} onPress={() => setCreateOpen(false)} disabled={pendingAction !== null}><Text style={styles.cancel}>Hủy</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal></Screen>;
}
const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  content: { paddingBottom: 32 }, back: { color: "#059669", fontWeight: "700" }, header: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  pressed: { opacity: 0.55 },
  code: { fontSize: 26, fontWeight: "800", color: "#0f172a" }, area: { color: "#64748b", marginTop: 5 }, badge: { backgroundColor: "#fef3c7", color: "#92400e", padding: 8, borderRadius: 10, alignSelf: "flex-start", fontSize: 11 },
  done: { backgroundColor: "#d1fae5", color: "#065f46" }, gallery: { gap: 10, paddingVertical: 20 }, photo: { width: 260, height: 340, borderRadius: 20, backgroundColor: "#e2e8f0" },
  section: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 10 }, item: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 15, marginBottom: 9 },
  itemName: { fontSize: 16, fontWeight: "700" }, itemMeta: { color: "#64748b", marginTop: 4 }, itemTotal: { fontWeight: "800" }, empty: { color: "#94a3b8", marginBottom: 18 },
  form: { backgroundColor: "#ecfdf5", borderRadius: 22, padding: 16, marginTop: 16, gap: 12 },
  results: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" }, result: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, resultName: { fontWeight: "800" },
  selecting: { alignItems: "center", gap: 3, marginLeft: 8 }, selectingText: { color: "#059669", fontSize: 10, fontWeight: "700" },
  attach: { color: "#d97706", marginTop: 5, fontSize: 12 }, create: { padding: 14 }, createSolo: { backgroundColor: "#fff", borderRadius: 14, padding: 14 }, createText: { color: "#059669", fontWeight: "800" },
  preparing: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchError: { color: "#b91c1c", fontSize: 13, lineHeight: 18 },
  selected: { color: "#047857", fontWeight: "700" }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, provisional: { textAlign: "right", fontWeight: "800", color: "#334155" },
  summary: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginVertical: 20 }, summaryLabel: { color: "#64748b", marginTop: 4 }, summaryValue: { fontSize: 18, fontWeight: "700" },
  total: { fontSize: 28, color: "#059669", fontWeight: "900", marginTop: 4 }, modalShade: { flex: 1, backgroundColor: "rgba(15,23,42,.55)", justifyContent: "flex-end" },
  modalScroll: { flexGrow: 0, maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modal: { padding: 22, paddingBottom: 28, gap: 16 }, modalTitle: { fontSize: 24, fontWeight: "800" },
  prefillBox: { backgroundColor: "#f1f5f9", borderRadius: 14, padding: 14, gap: 4 },
  prefillLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" }, prefill: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  cancel: { textAlign: "center", padding: 12, color: "#64748b", fontWeight: "700" }
});
