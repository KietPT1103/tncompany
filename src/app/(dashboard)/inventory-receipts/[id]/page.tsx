import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, PackageOpen, Pencil, Plus, RefreshCw, Store, Trash2, UserRound, X, ZoomIn } from "lucide-react";
import {
  addInventoryReceiptItem, attachReceiptProduct, completeInventoryReceipt, createReceiptProduct,
  cancelInventoryReceipt, deleteInventoryReceipt, deleteInventoryReceiptItem, getInventoryReceipt, searchReceiptProducts, searchWarehouseProducts, updateInventoryReceipt, type WarehouseType,
  lockInventoryReceipt, unlockInventoryReceipt, updateInventoryReceiptItem, type InventoryReceipt, type InventoryReceiptItem, type ProductResult, type ReceiptStatus
} from "@/services/inventoryReceiptService";
import { apiRequest } from "@/lib/api";
import { inventoryToday } from "@/lib/inventoryPeriods";
import { hasPermission } from "@/lib/permissions";
import { getSuppliers, type Supplier } from "@/services/suppliers";
import PrivateApiImage from "@/components/PrivateApiImage";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const statusLabels: Record<ReceiptStatus, string> = {
  pending_explanation: "Chưa giải trình",
  draft: "Đang giải trình",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
  deleted: "Đã xóa",
};

const statusClasses: Record<ReceiptStatus, string> = {
  pending_explanation: "bg-amber-100 text-amber-800",
  draft: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
  deleted: "bg-slate-200 text-slate-800",
};

export default function FieldInventoryReceiptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [extraActionsOpen, setExtraActionsOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const [selected, setSelected] = useState<ProductResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryReceiptItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editNote, setEditNote] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [orderCreator, setOrderCreator] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const photoUploadActive = useRef(false);
  const photoRequestIds = useRef(new Map<string, string>());
  const [photoDate, setPhotoDate] = useState(inventoryToday);
  const [photoError, setPhotoError] = useState("");
  const [photoProgress, setPhotoProgress] = useState("");
  useEffect(() => { setPhotoDate(receipt?.capturedAt?.slice(0, 10) || inventoryToday()); }, [receipt?.id]);
  const searchSequence = useRef(0);
  useEffect(() => { setSupplierId(receipt?.supplierId || ""); setOrderCreator(receipt?.orderCreatorName || ""); }, [receipt?.id, receipt?.supplierId, receipt?.orderCreatorName]);
  useEffect(() => {
    if (!receipt?.areaId || !hasPermission(user, "inventory_receipts.update")) return;
    let active = true;
    getSuppliers(receipt.areaId).then(data => { if (active) setSuppliers(data.items.filter(item => item.isActive)); }).catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [receipt?.areaId, user]);
  const warehouseType = receipt?.warehouseType || "ingredient";
  const reload = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setReceipt(await getInventoryReceipt(id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể tải chi tiết phiếu nhập.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, [id]);
  useEffect(() => {
    if (!receipt || !suggestionsOpen) return;
    const sequence = ++searchSequence.current;
    const timer = setTimeout(() => Promise.all([
      searchWarehouseProducts(query, receipt.areaId, warehouseType),
      warehouseType === "ingredient" && query.trim() ? searchReceiptProducts(query, receipt.areaId) : Promise.resolve([]),
    ]).then(([history, catalog]) => {
      const items = [...history, ...catalog.filter(item => !history.some(previous => previous.id === item.id))];
      if (searchSequence.current === sequence) {
        setResults(items); setActiveResult(0); setSearchError("");
      }
    }).catch((error) => {
      if (searchSequence.current === sequence) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Không thể tải danh sách sản phẩm.");
      }
    }), 250);
    return () => { clearTimeout(timer); searchSequence.current++; };
  }, [query, receipt?.areaId, warehouseType, suggestionsOpen]);
  if (loading && !receipt) {
    return (
      <div className="warehouse-ui min-h-full bg-slate-50 p-4 sm:p-6 2xl:p-8" aria-busy="true" aria-label="Đang tải chi tiết phiếu nhập">
        <div className="mx-auto max-w-[1440px] space-y-5">
          <div className="h-10 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="grid gap-5 lg:grid-cols-[minmax(240px,.55fr)_minmax(0,1.45fr)]">
            <div className="h-[520px] animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-[520px] animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }
  if (!receipt) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-rose-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-slate-950">Không tải được phiếu nhập</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError || "Phiếu không tồn tại hoặc đã bị xóa."}</p>
          <Button onClick={() => void reload()} className="mt-5 gap-2 bg-emerald-700 font-bold text-white hover:bg-emerald-800">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </Button>
        </div>
      </div>
    );
  }
  const editableStatus = receipt.status === "pending_explanation" || receipt.status === "draft";
  const editableMetadata = (editableStatus || (role === "admin" && receipt.status === "completed")) && (role === "admin" || receipt.canEdit) && hasPermission(user, "inventory_receipts.update");
  const editable = editableStatus && receipt.canEdit && hasPermission(user, "inventory_receipts.explain");
  const canCorrect = editable || (role === "admin" && receipt.status === "completed");
  const listReturnTo = (location.state as { returnTo?: string } | null)?.returnTo || "/admin/inventory?tab=evidence";

  const canUploadPhotos = hasPermission(user, "inventory_receipts.upload_image") && (
    (editableStatus && (receipt.canEdit || role === "admin")) || (receipt.status === "completed")
  );
  const canDeletePhotos = editableStatus && receipt.canEdit && hasPermission(user, "inventory_receipts.upload_image");
  async function deletePhoto(imageId: string, index: number) {
    if (busy || !canDeletePhotos || !confirm(`Xóa ảnh ${index + 1} khỏi minh chứng này?`)) return;
    setBusy(true); setPhotoError(""); setPhotoProgress("");
    try {
      await apiRequest(`/inventory-receipt-images.php?id=${encodeURIComponent(imageId)}`, { method: "DELETE" });
      setLightbox(null);
      setReceipt(await getInventoryReceipt(receipt.id));
      setPhotoProgress("Đã xóa ảnh.");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Không thể xóa ảnh. Vui lòng tải lại danh sách ảnh để kiểm tra.");
    } finally { setBusy(false); }
  }
  async function uploadPhotos(fileList: FileList | null) {
    if (!fileList?.length || !canUploadPhotos || photoUploadActive.current || busy) return;
    const files = Array.from(fileList);
    if (photoInput.current) photoInput.current.value = "";
    setPhotoError(""); setPhotoProgress("");
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024)) {
      setPhotoError("Chỉ chọn ảnh JPEG, PNG, WebP tối đa 12 MB mỗi ảnh."); return;
    }
    if (role === "admin" && !photoDate) { setPhotoError("Vui lòng chọn ngày chụp."); return; }
    photoUploadActive.current = true; setBusy(true);
    let uploaded = 0;
    const capturedAt = role === "admin" ? `${photoDate}T12:00:00+07:00` : new Date().toISOString();
    try {
      for (const file of files) {
        setPhotoProgress(`Đang tải ảnh ${uploaded + 1}/${files.length}…`);
        const key = `${receipt.id}:${file.name}:${file.size}:${file.lastModified}`;
        let requestId = photoRequestIds.current.get(key);
        if (!requestId) { requestId = crypto.randomUUID(); photoRequestIds.current.set(key, requestId); }
        const form = new FormData();
        form.set("receiptId", receipt.id); form.set("clientFileId", requestId);
        form.set("capturedAt", capturedAt); form.set("photo", file);
        await apiRequest("/inventory-receipt-images.php", { method: "POST", body: form });
        uploaded++;
      }
      setPhotoProgress(`Đã bổ sung ${uploaded} ảnh.`);
    } catch (error) {
      setPhotoProgress(uploaded ? `Đã bổ sung ${uploaded}/${files.length} ảnh.` : "");
      setPhotoError(error instanceof Error ? error.message : "Không thể tải ảnh minh chứng.");
    } finally {
      try { setReceipt(await getInventoryReceipt(receipt.id)); }
      catch { setPhotoError(value => `${value ? value + " " : ""}Không thể làm mới danh sách ảnh. Vui lòng tải lại trang.`); }
      photoUploadActive.current = false; setBusy(false);
    }
  }
  async function choose(product: ProductResult) {
    if (!receipt) return;
    if (!product.attachedToCurrentArea) {
      const attached = await attachReceiptProduct(product.id, receipt.areaId);
      product = { ...product, id: attached.id, attachedToCurrentArea: true, areaId: receipt.areaId };
    }
    setSelected(product); setQuery(product.productName); setResults([]); setSuggestionsOpen(false); setSearchError("");
  }
  async function addItem() {
    if (!selected || !receipt) return;
    setBusy(true);
    try {
      await addInventoryReceiptItem({ receiptId: receipt.id, productId: selected.id, itemType: warehouseType, productCode: selected.productCode, productName: selected.productName, unit: selected.unit, quantity: Number(quantity), unitPrice: Number(unitPrice), note });
      setQuery(""); setSelected(null); setQuantity(""); setUnitPrice(""); setNote(""); await reload();
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể thêm hàng hóa."); } finally { setBusy(false); }
  }
  async function finish() {
    if (!confirm(`Hoàn thành ${receipt.items.length} món, tổng ${receipt.totalAmount.toLocaleString("vi-VN")} ₫?`)) return;
    setBusy(true);
    try {
      if (editableMetadata && (supplierId !== (receipt.supplierId || "") || orderCreator !== receipt.orderCreatorName)) {
        await updateInventoryReceipt(receipt.id, { supplierId: supplierId || null, orderCreatorName: orderCreator });
      }
      setReceipt(await completeInventoryReceipt(receipt.id));
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể hoàn thành."); }
    finally { setBusy(false); }
  }
  function beginEdit(item: InventoryReceiptItem) {
    setEditingItem(item);
    setEditQuantity(String(item.quantity));
    setEditUnitPrice(String(item.unitPrice));
    setEditNote(item.note || "");
  }
  async function saveEdit() {
    if (!editingItem) return;
    setBusy(true);
    try {
      await updateInventoryReceiptItem(editingItem.id, {
        itemType: editingItem.itemType || "ingredient",
        productId: editingItem.productId,
        productName: editingItem.productName,
        unit: editingItem.unit,
        quantity: Number(editQuantity),
        unitPrice: Number(editUnitPrice),
        note: editNote,
      });
      setEditingItem(null);
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật dòng hàng.");
    } finally { setBusy(false); }
  }
  async function cancelReceipt() {
    const reason = prompt("Lý do hủy phiếu:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do hủy.");
      return;
    }
    setBusy(true);
    try { setReceipt(await cancelInventoryReceipt(receipt.id, reason.trim())); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể hủy phiếu."); }
    finally { setBusy(false); }
  }
  async function deleteReceipt() {
    if (!confirm("Xóa phiếu này khỏi danh sách? Phiếu vẫn được lưu và chỉ admin xem được.")) return;
    setBusy(true);
    try { await deleteInventoryReceipt(receipt.id); navigate(listReturnTo, { replace: true }); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể xóa phiếu."); }
    finally { setBusy(false); }
  }
  async function unlockReceipt() {
    if (!confirm("Mở khóa để nhân viên có thể tiếp tục giải trình phiếu này?")) return;
    setBusy(true);
    try { setReceipt(await unlockInventoryReceipt(receipt.id)); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể mở khóa phiếu."); }
    finally { setBusy(false); }
  }
  async function saveMetadata() {
    setBusy(true);
    try { setReceipt(await updateInventoryReceipt(receipt.id, { supplierId: supplierId || null, orderCreatorName: orderCreator })); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể lưu thông tin."); }
    finally { setBusy(false); }
  }
  async function lockReceipt() {
    if (!confirm("Khóa minh chứng để ngừng chỉnh sửa và giải trình?")) return;
    setBusy(true);
    try { setReceipt(await lockInventoryReceipt(receipt.id)); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể khóa minh chứng."); }
    finally { setBusy(false); }
  }
  async function changeWarehouse(type: WarehouseType) {
    if (!receipt || type === warehouseType) return;
    setBusy(true);
    try {
      const updated = await updateInventoryReceipt(receipt.id, { warehouseType: type });
      searchSequence.current++;
      setReceipt(updated); setQuery(""); setSelected(null); setResults([]); setSuggestionsOpen(false); setShowCreate(false);
      setNewCode(""); setNewUnit(""); setSearchError("");
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể đổi kho."); }
    finally { setBusy(false); }
  }
  async function createNew() {
    setBusy(true);
    try {
      const product: ProductResult = warehouseType === "equipment"
        ? { id: crypto.randomUUID(), productCode: newCode.trim(), productName: query.trim(), unit: newUnit.trim(), areaId: receipt.areaId, areaName: receipt.area.name, attachedToCurrentArea: true, similar: false }
        : await createReceiptProduct({ areaId: receipt.areaId, ingredientCode: newCode, ingredientName: query.trim(), unit: newUnit });
      setSelected(product); setResults([]); setShowCreate(false);
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể tạo sản phẩm."); }
    finally { setBusy(false); }
  }

  return (
    <div className="warehouse-ui receipt-detail min-h-full bg-slate-50 p-3 sm:p-5 lg:p-6 2xl:p-8">
      <div className="mx-auto max-w-[1440px]">
        <Button
          variant="ghost"
          onClick={() => navigate(listReturnTo, { replace: true })}
          className="min-h-11 gap-2 rounded-md px-2 font-semibold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Danh sách phiếu
        </Button>

        {receipt.isLocked && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/90 px-4 py-3 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">Minh chứng đang khóa</p>
                <p className="mt-1 text-sm text-amber-900">
                  {role === "admin" ? "Admin vẫn có thể giải trình trực tiếp hoặc mở khóa cho nhân viên." : "Cần quyền mở khóa minh chứng để tiếp tục giải trình."}
                </p>
              </div>
              {receipt.canUnlock && (
                <Button disabled={busy} onClick={unlockReceipt} className="bg-amber-600 font-bold text-white hover:bg-amber-700">
                  Mở khóa minh chứng
                </Button>
              )}
            </div>
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between 2xl:px-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold tracking-[-0.02em] text-slate-950 sm:text-2xl">{receipt.receiptCode}</h1>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses[receipt.status]}`}>
                  {statusLabels[receipt.status]}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <Clock3 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                {new Date(receipt.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>
            <button type="button" aria-expanded={extraActionsOpen} onClick={() => setExtraActionsOpen(value => !value)} className="min-h-11 self-start text-sm font-semibold text-slate-600 sm:hidden">{extraActionsOpen ? "Ẩn thao tác khác" : "Thao tác khác · Khóa / Hủy / Xóa"}</button>
            <div className={`${extraActionsOpen ? "flex" : "hidden"} sm:flex flex-wrap gap-2`}>
              {editableStatus && !receipt.isLocked && hasPermission(user, "inventory_receipts.lock") && <Button variant="outline" disabled={busy} onClick={lockReceipt}>Khóa minh chứng</Button>}
              {editableStatus && receipt.canEdit && hasPermission(user, "inventory_receipts.cancel") && (
                <Button variant="outline" disabled={busy} onClick={cancelReceipt} className="border-rose-200 font-semibold text-rose-700 hover:bg-rose-50">Hủy phiếu</Button>
              )}
              {receipt.status !== "deleted" && hasPermission(user, "inventory_receipts.cancel") && (
                <Button variant="outline" disabled={busy} onClick={deleteReceipt} className="gap-2 border-rose-300 font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Xóa phiếu</Button>
              )}
            </div>
          </div>

          <button type="button" aria-expanded={metadataOpen} onClick={() => setMetadataOpen(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-2 border-t px-3 text-left text-sm text-slate-600 sm:hidden"><span>{receipt.area.name} · {receipt.itemCount} món · {receipt.totalAmount.toLocaleString("vi-VN")} ₫</span><span className="shrink-0 font-semibold">{metadataOpen ? "Thu gọn" : "Chi tiết"}</span></button>
          <dl className={`${metadataOpen ? "grid" : "hidden"} sm:grid border-t border-slate-200 grid-cols-2 lg:grid-cols-6`}>
            <div className="px-3 py-2 sm:px-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><Store className="h-4 w-4" />Khu vực</dt>
              <dd className="mt-1.5 font-semibold text-slate-900">{receipt.area.name}</dd>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:border-l sm:border-t-0 sm:px-6 xl:border-l 2xl:px-7">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><UserRound className="h-4 w-4" />Người chụp ảnh</dt>
              <dd className="mt-1.5 font-semibold text-slate-900">{receipt.createdByName || "Chưa xác định"}</dd>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6 xl:border-l xl:border-t-0 2xl:px-7">
              <dt className="text-xs font-semibold uppercase text-slate-500">Nhà phân phối</dt>
              <dd className="mt-1.5 font-semibold text-slate-900">{receipt.supplier?.supplierName || "Chưa chọn"}</dd>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:border-l sm:px-6 xl:border-t-0 2xl:px-7">
              <dt className="text-xs font-semibold uppercase text-slate-500">Người tạo đơn</dt>
              <dd className="mt-1.5 font-semibold text-slate-900">{receipt.orderCreatorName || "Chưa nhập"}</dd>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6 xl:border-l xl:border-t-0 2xl:px-7">
              <dt className="text-xs font-semibold uppercase text-slate-500">Số món</dt>
              <dd className="mt-1.5 text-lg font-bold tabular-nums text-slate-950">{receipt.itemCount}</dd>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:border-l sm:px-6 xl:border-t-0 2xl:px-7">
              <dt className="text-xs font-semibold uppercase text-slate-500">Tổng tiền</dt>
              <dd className="mt-1.5 text-lg font-bold tabular-nums text-emerald-800">{receipt.totalAmount.toLocaleString("vi-VN")} ₫</dd>
            </div>
          </dl>
          <div className={`${metadataOpen ? "flex" : "hidden"} sm:flex items-start gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 sm:px-6 2xl:px-7`}>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span><b className="font-semibold text-slate-900">Địa điểm:</b> {receipt.images[0]?.locationAddress || "Tọa độ đã được lưu trong ảnh"}</span>
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(240px,.55fr)_minmax(0,1.45fr)] 2xl:mt-5 2xl:gap-5">
          <section className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 sm:px-6 sm:py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Camera className="h-5 w-5 text-emerald-700" />Ảnh hóa đơn</h2>
              <span className="text-sm font-semibold text-slate-500">{receipt.imageCount} ảnh</span>
            </div>
            {canUploadPhotos && <div className="space-y-2 border-b border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end gap-2">
                {role === "admin" && <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">Ngày chụp ảnh bổ sung<input type="date" value={photoDate} disabled={busy} onChange={event => setPhotoDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"/></label>}
                <Button variant="outline" disabled={busy || (role === "admin" && !photoDate)} onClick={() => photoInput.current?.click()} className="min-h-11 gap-2 border-emerald-200 text-emerald-800"><Plus className="h-4 w-4"/>Bổ sung ảnh</Button>
              </div>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => void uploadPhotos(event.target.files)}/>
              <p className="text-xs text-slate-500">Chọn nhiều ảnh JPEG, PNG, WebP; tối đa 12 MB mỗi ảnh.</p>
            </div>}
            {photoProgress && <p role="status" className="px-3 py-2 text-sm text-emerald-800">{photoProgress}</p>}
            {photoError && <p role="alert" className="px-3 py-2 text-sm text-rose-700">{photoError}</p>}
            {receipt.images.length === 0 ? (
              <div className="grid min-h-52 place-items-center px-5 py-10 text-center">
                <div><Camera className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">Chưa có ảnh. Bạn có thể nhập hàng trước và bổ sung ảnh sau.</p></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-2">
                {receipt.images.map((image, index) => (
                  <div key={image.id} className="min-w-0">
                  <button
                    onClick={() => setLightbox(index)}
                    className="group relative block w-full overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    aria-label={`Xem ảnh hóa đơn ${index + 1}`}
                  >
                    <PrivateApiImage src={image.thumbnailUrl} className="aspect-square max-h-60 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
                    <span className="absolute inset-0 grid place-items-center bg-slate-950/0 text-white opacity-0 transition-[background-color,opacity] duration-200 group-hover:bg-slate-950/35 group-hover:opacity-100 group-focus-visible:bg-slate-950/35 group-focus-visible:opacity-100">
                      <ZoomIn className="h-6 w-6" />
                    </span>
                    <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">Ảnh {index + 1}</span>
                  </button>
                  {canDeletePhotos && <button type="button" disabled={busy} onClick={() => void deletePhoto(image.id, index)} aria-label={`Xóa ảnh ${index + 1}`} className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 rounded-md border border-rose-200 bg-white text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4"/>Xóa ảnh</button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="receipt-goods-panel min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:px-6 sm:py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><PackageOpen className="h-5 w-5 text-emerald-700" />Giải trình hàng hóa</h2>
              <span className="text-sm font-semibold text-slate-500">{receipt.itemCount} dòng hàng</span>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <label htmlFor="receipt-warehouse" className="mb-1 block text-sm font-bold text-slate-800">Kho nhập hàng</label>
              <select id="receipt-warehouse" value={warehouseType} disabled={!editableMetadata || busy || receipt.items.length > 0} onChange={event => void changeWarehouse(event.target.value as WarehouseType)} className="min-h-11 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm sm:max-w-xs">
                <option value="ingredient">Kho nguyên liệu</option>
                <option value="equipment">Kho dụng cụ</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">{receipt.items.length ? "Xóa các dòng hàng nếu cần đổi kho nhập." : "Gợi ý hàng hóa lấy từ lịch sử nhập của kho đã chọn."}</p>
            </div>
            {editableMetadata && <details open={!receipt.supplierId || !receipt.orderCreatorName} className="border-b border-slate-200 px-3 py-2 sm:px-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-emerald-950">Thông tin nhập hàng{receipt.supplierId && receipt.orderCreatorName ? " · Đã lưu" : " · Cần điền"}</summary><div className="grid gap-3 pb-2 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-800">Nhà phân phối<select value={supplierId} disabled={busy} onChange={event => setSupplierId(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-slate-200 bg-white px-2"><option value="">Chọn nhà phân phối</option>{suppliers.map(item => <option value={item.id} key={item.id}>{item.supplierName}</option>)}</select></label>
              <Input label="Người nhập hàng" value={orderCreator} disabled={busy} onChange={event => setOrderCreator(event.target.value)} className="h-11" />
              {loadError && <p role="alert" className="text-sm text-rose-700">{loadError}</p>}
              <Button variant="outline" disabled={busy} onClick={saveMetadata} className="sm:col-span-2">Lưu thông tin</Button>
            </div></details>}
            <div className="px-4 py-4 sm:px-5">
              {receipt.items.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-3 text-center sm:px-4 sm:py-8">
                  <PackageOpen className="mx-auto hidden h-8 w-8 text-slate-300 sm:block" />
                  <p className="mt-3 font-semibold text-slate-700">Chưa thêm hàng hóa</p>
                  <p className="mt-1 text-sm text-slate-500">Nhập tên hàng ở bên dưới để bắt đầu.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200" role="list">
                  {receipt.items.map((item) => (
                    <div key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" role="listitem">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{item.productName}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.productCode} • {item.quantity} {item.unit} × {item.unitPrice.toLocaleString("vi-VN")} ₫</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <b className="mr-1 whitespace-nowrap tabular-nums text-slate-950">{item.lineTotal.toLocaleString("vi-VN")} ₫</b>
                        {canCorrect && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => beginEdit(item)} className="h-10 w-10 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" aria-label={`Sửa ${item.productName}`}><Pencil className="h-4 w-4" /></Button>
                            {editable && <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Xóa dòng hàng?")) { await deleteInventoryReceiptItem(item.id); reload(); } }} className="h-10 w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Xóa ${item.productName}`}><Trash2 className="h-4 w-4" /></Button>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editable && (
              <div className="border-t border-emerald-100 bg-emerald-50/60 px-4 py-5 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button type="button" onClick={() => { setSuggestionsOpen(true); document.getElementById("receipt-product-search")?.focus(); }} className="flex min-h-11 items-center gap-2 font-bold text-emerald-950"><Plus className="h-4 w-4" />Thêm hàng hóa</button>
                  <span className="hidden text-xs font-semibold text-emerald-800 sm:inline">Chọn món rồi nhập số lượng và đơn giá</span>
                </div>
                <div className="relative z-10 mt-3">
                  <label htmlFor="receipt-product-search" className="mb-1.5 block text-sm font-semibold text-emerald-950">Tên hoặc mã hàng</label>
                  <input
                    disabled={busy}
                    id="receipt-product-search"
                    value={query}
                    onFocus={() => setSuggestionsOpen(true)}
                    onChange={(event) => { setQuery(event.target.value); setSelected(null); setSuggestionsOpen(true); }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult((value) => Math.min(results.length - 1, value + 1)); }
                      if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult((value) => Math.max(0, value - 1)); }
                      if (event.key === "Enter" && results[activeResult]) { event.preventDefault(); choose(results[activeResult]); }
                      if (event.key === "Escape") setResults([]);
                    }}
                    placeholder="Nhập tên hoặc mã hàng"
                    className="h-12 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                  {suggestionsOpen && !query && !results.length && !searchError && <p className="mt-2 text-xs text-slate-500">Kho chưa có hàng gợi ý. Nhập tên hàng để tìm hoặc tạo mới.</p>}
                  {searchError && <p className="mt-2 text-sm font-medium text-rose-700">{searchError}</p>}
                  {suggestionsOpen && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                      {results.map((product, index) => (
                        <button key={`${product.areaId}-${product.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(product)} className={`block w-full rounded-md p-3 text-left ${activeResult === index ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                          <b>{product.productName}</b><small className="ml-2 text-slate-500">{product.productCode} • {product.unit}</small>
                          {!product.attachedToCurrentArea && <span className="block text-xs text-amber-700">Đã tồn tại – chưa sử dụng tại {receipt.area.name}. Nhấn để thêm.</span>}
                        </button>
                      ))}
                      {hasPermission(user, "products.create") && query.trim().length >= 2 && <button onClick={() => setShowCreate(true)} className="w-full rounded-md p-3 text-left font-bold text-emerald-700"><Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query}”</button>}
                    </div>
                  )}
                  {hasPermission(user, "products.create") && suggestionsOpen && query.trim().length >= 2 && results.length === 0 && !selected && !searchError && (
                    <button onMouseDown={(event) => event.preventDefault()} onClick={() => setShowCreate(true)} className="mt-2 min-h-12 w-full rounded-md border border-emerald-100 bg-white p-3 text-left font-bold text-emerald-700 shadow-sm">
                      <Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query.trim()}”
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Input label="Số lượng" value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="0.001" placeholder="0" className="h-11 border-emerald-200 bg-white" />
                  <Input label="Đơn giá" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} type="number" min="0" step="100" placeholder="0 VND" className="h-11 border-emerald-200 bg-white" />
                </div>
                <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-600">Thêm ghi chú (không bắt buộc)</summary><Input label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin bổ sung" className="h-11 border-emerald-200 bg-white" /></details>
                <div className="mt-4 flex flex-col gap-3 border-t border-emerald-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-emerald-950">Tạm tính: <b className="tabular-nums">{((Number(quantity) || 0) * (Number(unitPrice) || 0)).toLocaleString("vi-VN")} ₫</b></p>
                  <Button disabled={busy || !selected || Number(quantity) <= 0 || !Number.isFinite(Number(quantity)) || unitPrice === "" || Number(unitPrice) < 0 || !Number.isFinite(Number(unitPrice))} onClick={addItem} className="h-11 bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800">Thêm vào phiếu</Button>
                </div>
              </div>
            )}

            <div className="receipt-complete-bar flex flex-col gap-2 rounded-b-xl border-t border-slate-200 bg-slate-950 px-3 py-3 sm:gap-4 sm:px-5 sm:py-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">Tổng số lượng {receipt.totalQuantity}</p>
                <p className="mt-1 text-xl font-bold tabular-nums sm:text-3xl">{receipt.totalAmount.toLocaleString("vi-VN")} ₫</p>
              </div>
              {editableStatus && receipt.canEdit && hasPermission(user, "inventory_receipts.complete") && (
                <Button disabled={busy || !receipt.items.length } onClick={finish} className="h-12 gap-2 bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />Lưu & cộng kho
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>

      {lightbox !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`Ảnh hóa đơn ${lightbox + 1}`}>
          <Button variant="ghost" size="icon" onClick={() => setLightbox(null)} className="absolute right-4 top-4 h-11 w-11 text-white hover:bg-white/10 hover:text-white" aria-label="Đóng ảnh"><X /></Button>
          <Button variant="ghost" size="icon" onClick={() => setLightbox((lightbox - 1 + receipt.images.length) % receipt.images.length)} className="absolute left-3 h-12 w-12 text-white hover:bg-white/10 hover:text-white" aria-label="Ảnh trước"><ChevronLeft className="h-9 w-9" /></Button>
          <PrivateApiImage src={receipt.images[lightbox].url} className="max-h-[90vh] max-w-[88vw] object-contain" />
          <Button variant="ghost" size="icon" onClick={() => setLightbox((lightbox + 1) % receipt.images.length)} className="absolute right-3 h-12 w-12 text-white hover:bg-white/10 hover:text-white" aria-label="Ảnh sau"><ChevronRight className="h-9 w-9" /></Button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="create-product-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.25)]">
            <h2 id="create-product-title" className="text-2xl font-bold text-slate-950">Tạo hàng hóa mới</h2>
            <p className="mt-2 text-slate-600">Tên hàng: <b>{query}</b></p>
            <Input label="Mã sản phẩm" value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="Nhập mã sản phẩm" className="mt-4 h-11" />
            <Input label="Đơn vị tính" value={newUnit} onChange={(event) => setNewUnit(event.target.value)} placeholder="Ví dụ: kg, chai, hộp" className="mt-3 h-11" />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button disabled={!newCode.trim() || !newUnit.trim() || !query.trim() || busy} onClick={createNew} className="bg-emerald-700 font-bold text-white hover:bg-emerald-800">Tạo và chọn</Button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.25)]">
            <h2 id="edit-item-title" className="text-2xl font-bold text-slate-950">Sửa dòng hàng</h2>
            <p className="mt-2 text-slate-600"><b>{editingItem.productName}</b> • {editingItem.productCode} • {editingItem.unit}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input label="Số lượng" value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} type="number" min="0" step="0.001" className="h-11" />
              <Input label="Đơn giá" value={editUnitPrice} onChange={(event) => setEditUnitPrice(event.target.value)} type="number" min="0" step="100" className="h-11" />
            </div>
            <Input label="Ghi chú" value={editNote} onChange={(event) => setEditNote(event.target.value)} className="mt-3 h-11" />
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-right font-bold text-slate-900">Thành tiền: {((Number(editQuantity) || 0) * (Number(editUnitPrice) || 0)).toLocaleString("vi-VN")} ₫</div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setEditingItem(null)}>Đóng</Button>
              <Button disabled={busy || Number(editQuantity) <= 0 || editUnitPrice === "" || Number(editUnitPrice) < 0} onClick={saveEdit} className="bg-emerald-700 font-bold text-white hover:bg-emerald-800">Lưu thay đổi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
