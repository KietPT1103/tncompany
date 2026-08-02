import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { FormField } from "@/components/FormField";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useArea } from "@/features/areas/AreaProvider";
import {
  addReceiptItem, attachProduct, cacheApiAsset, completeReceipt, createProduct, getNextProductCode, getReceipt,
  searchProducts, searchSuppliers, unlockReceipt, updateReceipt, type ProductSearchResult, type SupplierSearchResult
} from "@/services/api";
import type { Receipt } from "@/types";

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { area } = useArea();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [imageUris, setImageUris] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"add" | "create" | "saveDetails" | "complete" | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [preparingCreate, setPreparingCreate] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState("NL1");
  const [newCode, setNewCode] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [orderCreatorName, setOrderCreatorName] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState<SupplierSearchResult[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSearchResult | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);

  async function reload() { setReceipt((await getReceipt(id)).item); }
  useEffect(() => {
    getReceipt(id).then((data) => {
      setReceipt(data.item);
      setOrderCreatorName(data.item.orderCreatorName || "");
      if (data.item.supplier) {
        setSelectedSupplier({ ...data.item.supplier, phone: "", address: "" });
        setSupplierQuery(data.item.supplier.supplierName);
      }
    }).catch((e) => Alert.alert("Không tải được phiếu", e.message));
  }, [id]);
  useEffect(() => {
    if (!receipt) return;
    let active = true;
    receipt.images.forEach((image) => {
      cacheApiAsset(image.url, image.id).then((uri) => {
        if (active) setImageUris((current) => ({ ...current, [image.id]: uri }));
      }).catch(() => {
        if (active) setImageErrors((current) => ({ ...current, [image.id]: true }));
      });
    });
    return () => { active = false; };
  }, [receipt]);
  useEffect(() => {
    if (!area || !suggestionsOpen) return;
    const timer = setTimeout(() => {
      setSuggestionsLoading(true);
      searchProducts(query.trim(), area.id).then((r) => {
      setResults(r.items);
      setSuggestedCode(r.suggestedCode || "NL1");
      setSearchError("");
      }).catch((error) => {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Không thể tải danh sách nguyên liệu.");
      }).finally(() => setSuggestionsLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, area, suggestionsOpen]);
  useEffect(() => {
    if (!area || !supplierOpen) return;
    const timer = setTimeout(() => {
      setSupplierLoading(true);
      searchSuppliers(supplierQuery.trim(), area.id)
        .then((result) => setSupplierResults(result.items))
        .catch((error) => Alert.alert("Không tải được nhà phân phối", error instanceof Error ? error.message : "Vui lòng thử lại."))
        .finally(() => setSupplierLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [area, supplierOpen, supplierQuery]);

  const lineTotal = useMemo(() => (Number(quantity) || 0) * (Number(price) || 0), [quantity, price]);
  if (!receipt || !area) return <Screen><Text>Đang tải phiếu…</Text></Screen>;
  const currentReceipt = receipt;
  const currentArea = area;
  const editableStatus = currentReceipt.status === "pending_explanation" || currentReceipt.status === "draft";
  const editable = editableStatus && currentReceipt.canEdit;

  function openProductSuggestions() {
    setSuggestionsOpen(true);
  }

  function validateReceiptDetails() {
    if (!selectedSupplier) {
      Alert.alert("Chưa chọn nhà phân phối", "Vui lòng chọn nhà phân phối cho phiếu nhập.");
      return false;
    }
    if (!orderCreatorName.trim()) {
      Alert.alert("Thiếu tên người tạo đơn", "Vui lòng nhập tên người tạo đơn.");
      return false;
    }
    return true;
  }

  async function saveReceiptDetails(
    showConfirmation = true,
    requireAll = true,
    supplier = selectedSupplier,
    creatorName = orderCreatorName
  ) {
    if (requireAll && !validateReceiptDetails()) return null;
    const normalizedName = creatorName.trim();
    const supplierId = supplier?.id || null;
    if (supplierId === (currentReceipt.supplierId || null) && normalizedName === currentReceipt.orderCreatorName) {
      if (showConfirmation) Alert.alert("Đã lưu", "Thông tin phiếu nhập không có thay đổi.");
      return currentReceipt;
    }
    try {
      setPendingAction("saveDetails");
      const updated = await updateReceipt(currentReceipt.id, {
        supplierId,
        orderCreatorName: normalizedName,
      });
      setReceipt(updated.item);
      if (showConfirmation) Alert.alert("Đã lưu", "Thông tin phiếu nhập đã được cập nhật.");
      return updated.item;
    } catch (error) {
      Alert.alert("Không thể lưu thông tin phiếu", error instanceof Error ? error.message : "Vui lòng thử lại.");
      return null;
    } finally {
      setPendingAction(null);
    }
  }

  async function unlockCurrentReceipt() {
    try {
      setPendingAction("saveDetails");
      setReceipt((await unlockReceipt(currentReceipt.id)).item);
      Alert.alert("Đã mở khóa", "Nhân viên có thể tiếp tục giải trình phiếu này.");
    } catch (error) {
      Alert.alert("Không thể mở khóa", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setPendingAction(null);
    }
  }

  async function retryImage(imageId: string, imageUrl: string) {
    setImageErrors((current) => ({ ...current, [imageId]: false }));
    try {
      const uri = await cacheApiAsset(imageUrl, imageId);
      setImageUris((current) => ({ ...current, [imageId]: uri }));
    } catch {
      setImageErrors((current) => ({ ...current, [imageId]: true }));
    }
  }

  async function selectProduct(product: ProductSearchResult) {
    try {
      setSelectingProductId(product.id);
      if (!product.attachedToCurrentArea) {
        const attached = await attachProduct(product.id, currentArea.id);
        setSelected({ ...product, id: attached.item.id, areaId: currentArea.id, attachedToCurrentArea: true });
      } else setSelected(product);
      setQuery(product.productName); setResults([]); setSuggestionsOpen(false); setSearchError(""); Keyboard.dismiss();
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
    if (!validateReceiptDetails()) return;
    Alert.alert("Hoàn thành nhập kho", `${currentReceipt.items.length} nguyên liệu • ${currentReceipt.totalAmount.toLocaleString("vi-VN")} ₫`, [
      { text: "Kiểm tra lại", style: "cancel" },
      { text: "Hoàn thành nhập kho", onPress: async () => {
        try {
          setPendingAction("complete");
          await updateReceipt(currentReceipt.id, {
            supplierId: selectedSupplier!.id,
            orderCreatorName: orderCreatorName.trim(),
          });
          setReceipt((await completeReceipt(currentReceipt.id)).item);
          Alert.alert("Đã hoàn thành", "Tồn kho đã được cập nhật.");
        }
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
    <Pressable style={({ pressed }) => pressed && styles.pressed} onPress={async () => {
      if (editable) await saveReceiptDetails(false, false);
      router.back();
    }}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
    <View style={styles.header}><View><Text style={styles.code}>{receipt.receiptCode}</Text><Text style={styles.area}>Khu đang thao tác: {area.name}</Text></View>
      <Text style={[styles.badge, receipt.status === "completed" && styles.done]}>{receipt.status}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {receipt.images.map((image) => <View key={image.id} style={styles.photo}>
        {imageUris[image.id] ? <Image source={{ uri: imageUris[image.id] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> :
          <View style={styles.photoPlaceholder}>{imageErrors[image.id] ?
            <Pressable onPress={() => retryImage(image.id, image.url)} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.retryImage}>Không tải được ảnh · Chạm để thử lại</Text>
            </Pressable> : <><ActivityIndicator color="#059669" /><Text style={styles.loadingImage}>Đang tải ảnh…</Text></>}
          </View>}
      </View>)}
    </ScrollView>

    {currentReceipt.isLocked && <View style={styles.lockNotice}>
      <Text style={styles.lockTitle}>Phiếu đã khóa sau 24 giờ</Text>
      <Text style={styles.lockText}>{currentReceipt.canEdit
        ? "Bạn đang dùng tài khoản admin nên vẫn có thể giải trình phiếu này."
        : "Chỉ admin mới có thể giải trình hoặc mở khóa để nhân viên tiếp tục thao tác."}</Text>
      {currentReceipt.canUnlock && <PrimaryButton
        title="Mở khóa cho nhân viên"
        loadingTitle="Đang mở khóa…"
        onPress={unlockCurrentReceipt}
        loading={pendingAction === "saveDetails"}
        disabled={pendingAction !== null}
      />}
    </View>}

    {editable ? <View style={styles.detailsCard}>
      <Text style={styles.section}>Thông tin phiếu nhập</Text>
      <FormField
        label="Tên người tạo đơn"
        required
        value={orderCreatorName}
        onChangeText={setOrderCreatorName}
        onBlur={() => { void saveReceiptDetails(false, false); }}
        placeholder="Nhập họ và tên người tạo đơn"
        maxLength={255}
        autoCapitalize="words"
      />
      <View style={styles.supplierField}>
        <Text style={styles.fieldLabel}>Nhà phân phối <Text style={styles.required}>*</Text></Text>
        <Pressable onPress={() => setSupplierOpen(true)} style={({ pressed }) => [styles.supplierButton, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={selectedSupplier ? styles.supplierValue : styles.supplierPlaceholder}>
            {selectedSupplier?.supplierName || "Chạm để tìm và chọn nhà phân phối"}
          </Text>
          <Text style={styles.selectArrow}>⌄</Text>
        </Pressable>
      </View>
      <PrimaryButton
        title="Lưu thông tin phiếu"
        loadingTitle="Đang lưu thông tin…"
        onPress={() => saveReceiptDetails()}
        loading={pendingAction === "saveDetails"}
        disabled={pendingAction !== null || !selectedSupplier || !orderCreatorName.trim()}
      />
    </View> : <View style={styles.detailsCard}>
      <Text style={styles.section}>Thông tin phiếu nhập</Text>
      <Text style={styles.detailLabel}>Người tạo đơn</Text>
      <Text style={styles.detailValue}>{receipt.orderCreatorName}</Text>
      <Text style={styles.detailLabel}>Nhà phân phối</Text>
      <Text style={styles.detailValue}>{receipt.supplier?.supplierName}</Text>
    </View>}

    <Text style={styles.section}>Các nguyên liệu đã nhập</Text>
    {receipt.items.map((item) => <View key={item.id} style={styles.item}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.productName}</Text>
      <Text style={styles.itemMeta}>{item.quantity} {item.unit} × {item.unitPrice.toLocaleString("vi-VN")} ₫</Text></View>
      <Text style={styles.itemTotal}>{item.lineTotal.toLocaleString("vi-VN")} ₫</Text></View>)}
    {receipt.items.length === 0 && <Text style={styles.empty}>Chưa có nguyên liệu nào.</Text>}

    {editable && <View style={styles.form}><Text style={styles.section}>Thêm nguyên liệu</Text>
      <View style={styles.productPicker}>
        <FormField
          label="Nguyên liệu"
          required
          value={query}
          onFocus={openProductSuggestions}
          onBlur={() => setTimeout(() => setSuggestionsOpen(false), 180)}
          onChangeText={(value) => { setQuery(value); setSelected(null); setSuggestionsOpen(true); }}
          placeholder="Nhập tên hoặc mã nguyên liệu để tìm"
          autoCorrect={false}
          returnKeyType="search"
        />
        {suggestionsOpen && <View style={styles.productDropdown}>
          {suggestionsLoading ? <ActivityIndicator color="#059669" style={styles.dropdownLoading} /> : null}
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {searchError ? <Text style={styles.dropdownError}>{searchError}</Text> : null}
            {results.map((product) => {
              const selecting = selectingProductId === product.id;
              return <Pressable key={`${product.areaId}-${product.id}`} disabled={selectingProductId !== null}
                accessibilityRole="button" accessibilityState={{ disabled: selectingProductId !== null, busy: selecting }}
                style={({ pressed }) => [styles.result, (pressed || selecting) && styles.pressed]} onPress={() => selectProduct(product)}>
                <View style={{ flex: 1 }}><Text style={styles.resultName}>{product.productName}</Text>
                  <Text style={styles.itemMeta}>{product.productCode} • {product.unit || "Chưa có đơn vị"}</Text>
                  {!product.attachedToCurrentArea && <Text style={styles.attach}>Đã tồn tại – chưa dùng tại {area.name}. Nhấn để thêm.</Text>}
                </View>
                {selecting && <View style={styles.selecting}><ActivityIndicator color="#059669" /><Text style={styles.selectingText}>Đang chọn…</Text></View>}
              </Pressable>;
            })}
            {!suggestionsLoading && results.length === 0 && !searchError && query.trim().length < 2 ?
              <Text style={styles.dropdownEmpty}>Không có nguyên liệu phù hợp.</Text> : null}
            {query.trim().length >= 2 && <Pressable disabled={preparingCreate} style={({ pressed }) => [styles.create, (pressed || preparingCreate) && styles.pressed]} onPress={() => {
              setSuggestionsOpen(false); openCreateModal();
            }}>
              {preparingCreate ? <View style={styles.preparing}><ActivityIndicator color="#059669" /><Text style={styles.createText}>Đang lấy mã mới…</Text></View> : <Text style={styles.createText}>+ Tạo mới “{query.trim()}”</Text>}
            </Pressable>}
          </ScrollView>
        </View>}
      </View>
      <Text style={styles.fieldHint}>Chạm vào ô để xem toàn bộ nguyên liệu của quầy, hoặc nhập tên/mã để lọc.</Text>
      {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
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

  <Modal visible={supplierOpen} transparent animationType="slide" onRequestClose={() => setSupplierOpen(false)}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalShade}>
      <View style={styles.supplierSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.modalTitle}>Chọn nhà phân phối</Text>
          <Pressable onPress={() => setSupplierOpen(false)}><Text style={styles.close}>Đóng</Text></Pressable>
        </View>
        <TextInput
          autoFocus
          value={supplierQuery}
          onChangeText={setSupplierQuery}
          placeholder="Nhập tên, mã hoặc số điện thoại"
          placeholderTextColor="#94a3b8"
          style={styles.supplierSearch}
        />
        {supplierLoading && <ActivityIndicator color="#059669" style={styles.supplierLoading} />}
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.supplierList} nestedScrollEnabled>
          {supplierResults.map((supplier) => <Pressable key={supplier.id} onPress={() => {
            setSelectedSupplier(supplier);
            setSupplierQuery(supplier.supplierName);
            setSupplierOpen(false);
            void saveReceiptDetails(false, false, supplier, orderCreatorName);
          }} style={({ pressed }) => [styles.supplierRow, pressed && styles.pressed]}>
            <Text style={styles.supplierName}>{supplier.supplierName}</Text>
            <Text style={styles.itemMeta}>{supplier.supplierCode}{supplier.phone ? ` • ${supplier.phone}` : ""}</Text>
          </Pressable>)}
          {!supplierLoading && supplierResults.length === 0 && <Text style={styles.dropdownEmpty}>Không tìm thấy nhà phân phối trong khu vực này.</Text>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>

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
  done: { backgroundColor: "#d1fae5", color: "#065f46" }, gallery: { gap: 10, paddingVertical: 20 },
  photo: { width: 260, height: 340, borderRadius: 20, overflow: "hidden", backgroundColor: "#e2e8f0" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  loadingImage: { color: "#64748b", fontWeight: "700" }, retryImage: { color: "#b91c1c", textAlign: "center", fontWeight: "800" },
  detailsCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 22, gap: 14 },
  lockNotice: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fdba74", borderRadius: 18, padding: 16, marginBottom: 18, gap: 10 },
  lockTitle: { color: "#9a3412", fontSize: 17, fontWeight: "800" }, lockText: { color: "#7c2d12", lineHeight: 20 },
  detailLabel: { color: "#64748b", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  detailValue: { color: "#0f172a", fontSize: 16, fontWeight: "800", marginTop: -8 },
  supplierField: { gap: 7 }, fieldLabel: { color: "#334155", fontSize: 14, fontWeight: "700" }, required: { color: "#dc2626" },
  supplierButton: { minHeight: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14 },
  supplierValue: { flex: 1, color: "#0f172a", fontSize: 15, fontWeight: "700" }, supplierPlaceholder: { flex: 1, color: "#94a3b8", fontSize: 15 }, selectArrow: { color: "#059669", fontSize: 22, marginLeft: 8 },
  section: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 10 }, item: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 15, marginBottom: 9 },
  itemName: { fontSize: 16, fontWeight: "700" }, itemMeta: { color: "#64748b", marginTop: 4 }, itemTotal: { fontWeight: "800" }, empty: { color: "#94a3b8", marginBottom: 18 },
  form: { backgroundColor: "#ecfdf5", borderRadius: 22, padding: 16, marginTop: 16, gap: 12 },
  productPicker: { position: "relative", zIndex: 30 },
  fieldHint: { color: "#64748b", fontSize: 12, lineHeight: 17 },
  productDropdown: { position: "absolute", top: 78, left: 0, right: 0, zIndex: 40, maxHeight: 260, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#cbd5e1", elevation: 12, shadowColor: "#0f172a", shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  dropdownScroll: { maxHeight: 260 }, dropdownLoading: { paddingVertical: 12 }, dropdownEmpty: { color: "#64748b", padding: 18, textAlign: "center" }, dropdownError: { color: "#b91c1c", padding: 14, fontSize: 13 },
  result: { minHeight: 64, flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, resultName: { fontWeight: "800" },
  selecting: { alignItems: "center", gap: 3, marginLeft: 8 }, selectingText: { color: "#059669", fontSize: 10, fontWeight: "700" },
  attach: { color: "#d97706", marginTop: 5, fontSize: 12 }, create: { padding: 14 }, createText: { color: "#059669", fontWeight: "800" },
  preparing: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchError: { color: "#b91c1c", fontSize: 13, lineHeight: 18 },
  selected: { color: "#047857", fontWeight: "700" }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, provisional: { textAlign: "right", fontWeight: "800", color: "#334155" },
  summary: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginVertical: 20 }, summaryLabel: { color: "#64748b", marginTop: 4 }, summaryValue: { fontSize: 18, fontWeight: "700" },
  total: { fontSize: 28, color: "#059669", fontWeight: "900", marginTop: 4 }, modalShade: { flex: 1, backgroundColor: "rgba(15,23,42,.55)", justifyContent: "flex-end" },
  supplierSheet: { maxHeight: "78%", minHeight: 420, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, close: { color: "#059669", fontSize: 16, fontWeight: "800" },
  supplierSearch: { minHeight: 52, marginTop: 18, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, paddingHorizontal: 14, color: "#0f172a", fontSize: 15 },
  supplierLoading: { marginVertical: 12 }, supplierList: { marginTop: 8 }, supplierRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#cbd5e1" }, supplierName: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  modalScroll: { flexGrow: 0, maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modal: { padding: 22, paddingBottom: 28, gap: 16 }, modalTitle: { fontSize: 24, fontWeight: "800" },
  prefillBox: { backgroundColor: "#f1f5f9", borderRadius: 14, padding: 14, gap: 4 },
  prefillLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" }, prefill: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  cancel: { textAlign: "center", padding: 12, color: "#64748b", fontWeight: "700" }
});
