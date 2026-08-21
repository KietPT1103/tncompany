import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, PackageOpen, Pencil, Plus, RefreshCw, Store, Trash2, UserRound, X, ZoomIn } from "lucide-react";
import {
  addInventoryReceiptItem, attachReceiptProduct, completeInventoryReceipt, createReceiptProduct,
  cancelInventoryReceipt, deleteInventoryReceiptItem, getInventoryReceipt, searchReceiptProducts,
  unlockInventoryReceipt, updateInventoryReceiptItem, type InventoryReceipt, type InventoryReceiptItem, type ProductResult, type ReceiptStatus
} from "@/services/inventoryReceiptService";
import PrivateApiImage from "@/components/PrivateApiImage";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const statusLabels: Record<ReceiptStatus, string> = {
  pending_explanation: "Chưa giải trình",
  draft: "Đang giải trình",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const statusClasses: Record<ReceiptStatus, string> = {
  pending_explanation: "bg-amber-100 text-amber-800",
  draft: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function FieldInventoryReceiptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
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
  const searchSequence = useRef(0);
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
    const timer = setTimeout(() => searchReceiptProducts(query, receipt.areaId).then((items) => {
      if (searchSequence.current === sequence) {
        setResults(items); setActiveResult(0); setSearchError("");
      }
    }).catch((error) => {
      if (searchSequence.current === sequence) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Không thể tải danh sách sản phẩm.");
      }
    }), 250);
    return () => clearTimeout(timer);
  }, [query, receipt?.areaId, suggestionsOpen]);
  if (loading && !receipt) {
    return (
      <div className="min-h-full bg-slate-50 p-4 sm:p-6 2xl:p-8" aria-busy="true" aria-label="Đang tải chi tiết phiếu nhập">
        <div className="mx-auto max-w-[1720px] space-y-5">
          <div className="h-10 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="grid gap-5 xl:grid-cols-[minmax(360px,.82fr)_minmax(0,1.18fr)]">
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
  const editable = editableStatus && receipt.canEdit;
  const listReturnTo = (location.state as { returnTo?: string } | null)?.returnTo || "/admin/inventory-receipts";

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
      await addInventoryReceiptItem({ receiptId: receipt.id, productId: selected.id, quantity: Number(quantity), unitPrice: Number(unitPrice), note });
      setQuery(""); setSelected(null); setQuantity(""); setUnitPrice(""); setNote(""); await reload();
    } finally { setBusy(false); }
  }
  async function finish() {
    if (!confirm(`Hoàn thành ${receipt.items.length} món, tổng ${receipt.totalAmount.toLocaleString("vi-VN")} ₫?`)) return;
    setBusy(true);
    try { setReceipt(await completeInventoryReceipt(receipt.id)); } catch (error) { alert(error instanceof Error ? error.message : "Không thể hoàn thành."); }
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
        productId: editingItem.productId,
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
  async function unlockReceipt() {
    if (!confirm("Mở khóa để nhân viên có thể tiếp tục giải trình phiếu này?")) return;
    setBusy(true);
    try { setReceipt(await unlockInventoryReceipt(receipt.id)); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể mở khóa phiếu."); }
    finally { setBusy(false); }
  }
  async function createNew() {
    setBusy(true);
    try {
      const product = await createReceiptProduct({ areaId: receipt.areaId, ingredientCode: newCode, ingredientName: query.trim(), unit: newUnit });
      setSelected(product); setResults([]); setShowCreate(false);
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể tạo sản phẩm."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-5 lg:p-6 2xl:p-8">
      <div className="mx-auto max-w-[1720px]">
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
                <p className="font-bold">Phiếu đã tự động khóa sau 24 giờ</p>
                <p className="mt-1 text-sm text-amber-900">
                  {role === "admin" ? "Admin vẫn có thể giải trình trực tiếp hoặc mở khóa cho nhân viên." : "Chỉ admin mới có thể giải trình hoặc mở khóa phiếu này."}
                </p>
              </div>
              {receipt.canUnlock && (
                <Button disabled={busy} onClick={unlockReceipt} className="bg-amber-600 font-bold text-white hover:bg-amber-700">
                  Mở khóa cho nhân viên
                </Button>
              )}
            </div>
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between 2xl:px-7">
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
            {editable && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={cancelReceipt}
                className="border-rose-200 font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
              >
                Hủy phiếu
              </Button>
            )}
          </div>

          <dl className="grid border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <div className="px-5 py-4 sm:px-6 2xl:px-7">
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
          <div className="flex items-start gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 sm:px-6 2xl:px-7">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span><b className="font-semibold text-slate-900">Địa điểm:</b> {receipt.images[0]?.locationAddress || "Tọa độ đã được lưu trong ảnh"}</span>
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(360px,.82fr)_minmax(0,1.18fr)] 2xl:mt-5 2xl:gap-5">
          <section className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Camera className="h-5 w-5 text-emerald-700" />Ảnh hóa đơn</h2>
              <span className="text-sm font-semibold text-slate-500">{receipt.imageCount} ảnh</span>
            </div>
            {receipt.images.length === 0 ? (
              <div className="grid min-h-52 place-items-center px-5 py-10 text-center">
                <div><Camera className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">Phiếu chưa có ảnh hóa đơn.</p></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-2">
                {receipt.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setLightbox(index)}
                    className="group relative overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    aria-label={`Xem ảnh hóa đơn ${index + 1}`}
                  >
                    <PrivateApiImage src={image.thumbnailUrl} className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
                    <span className="absolute inset-0 grid place-items-center bg-slate-950/0 text-white opacity-0 transition-[background-color,opacity] duration-200 group-hover:bg-slate-950/35 group-hover:opacity-100 group-focus-visible:bg-slate-950/35 group-focus-visible:opacity-100">
                      <ZoomIn className="h-6 w-6" />
                    </span>
                    <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">Ảnh {index + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><PackageOpen className="h-5 w-5 text-emerald-700" />Giải trình hàng hóa</h2>
              <span className="text-sm font-semibold text-slate-500">{receipt.itemCount} dòng hàng</span>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {receipt.items.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-4 py-8 text-center">
                  <PackageOpen className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-700">Chưa có hàng hóa được giải trình</p>
                  <p className="mt-1 text-sm text-slate-500">Tìm và thêm món từ biểu mẫu bên dưới.</p>
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
                        {editable && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => beginEdit(item)} className="h-10 w-10 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" aria-label={`Sửa ${item.productName}`}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Xóa dòng hàng?")) { await deleteInventoryReceiptItem(item.id); reload(); } }} className="h-10 w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Xóa ${item.productName}`}><Trash2 className="h-4 w-4" /></Button>
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
                  <h3 className="font-bold text-emerald-950">Thêm hàng hóa</h3>
                  <span className="text-xs font-semibold text-emerald-800">Chọn món rồi nhập số lượng và đơn giá</span>
                </div>
                <div className="relative z-10 mt-3">
                  <label htmlFor="receipt-product-search" className="mb-1.5 block text-sm font-semibold text-emerald-950">Tên hoặc mã hàng</label>
                  <input
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
                  {searchError && <p className="mt-2 text-sm font-medium text-rose-700">{searchError}</p>}
                  {suggestionsOpen && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                      {results.map((product, index) => (
                        <button key={`${product.areaId}-${product.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(product)} className={`block w-full rounded-md p-3 text-left ${activeResult === index ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                          <b>{product.productName}</b><small className="ml-2 text-slate-500">{product.productCode} • {product.unit}</small>
                          {!product.attachedToCurrentArea && <span className="block text-xs text-amber-700">Đã tồn tại – chưa sử dụng tại {receipt.area.name}. Nhấn để thêm.</span>}
                        </button>
                      ))}
                      {query.trim().length >= 2 && <button onClick={() => setShowCreate(true)} className="w-full rounded-md p-3 text-left font-bold text-emerald-700"><Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query}”</button>}
                    </div>
                  )}
                  {suggestionsOpen && query.trim().length >= 2 && results.length === 0 && !selected && !searchError && (
                    <button onMouseDown={(event) => event.preventDefault()} onClick={() => setShowCreate(true)} className="mt-2 min-h-12 w-full rounded-md border border-emerald-100 bg-white p-3 text-left font-bold text-emerald-700 shadow-sm">
                      <Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query.trim()}”
                    </button>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input label="Số lượng" value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="0.001" placeholder="0" className="h-11 border-emerald-200 bg-white" />
                  <Input label="Đơn giá" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} type="number" min="0" step="100" placeholder="0 VND" className="h-11 border-emerald-200 bg-white" />
                </div>
                <Input label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin bổ sung (nếu có)" className="mt-3 h-11 border-emerald-200 bg-white" />
                <div className="mt-4 flex flex-col gap-3 border-t border-emerald-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-emerald-950">Tạm tính: <b className="tabular-nums">{((Number(quantity) || 0) * (Number(unitPrice) || 0)).toLocaleString("vi-VN")} ₫</b></p>
                  <Button disabled={busy || !selected || Number(quantity) <= 0 || unitPrice === ""} onClick={addItem} className="h-11 bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800">Thêm món</Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-b-xl border-t border-slate-200 bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">Tổng số lượng {receipt.totalQuantity}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{receipt.totalAmount.toLocaleString("vi-VN")} ₫</p>
              </div>
              {editable && (
                <Button disabled={busy || !receipt.items.length || !receipt.images.length} onClick={finish} className="h-12 gap-2 bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />Hoàn thành nhập kho
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
              <Button disabled={!newCode || !newUnit || busy} onClick={createNew} className="bg-emerald-700 font-bold text-white hover:bg-emerald-800">Tạo và chọn</Button>
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
