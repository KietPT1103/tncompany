import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X, ZoomIn } from "lucide-react";
import {
  addInventoryReceiptItem, attachReceiptProduct, completeInventoryReceipt, createReceiptProduct,
  cancelInventoryReceipt, deleteInventoryReceiptItem, getInventoryReceipt, searchReceiptProducts,
  updateInventoryReceiptItem, type InventoryReceipt, type InventoryReceiptItem, type ProductResult
} from "@/services/inventoryReceiptService";
import PrivateApiImage from "@/components/PrivateApiImage";

export default function FieldInventoryReceiptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
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
  const reload = () => getInventoryReceipt(id).then(setReceipt);
  useEffect(() => { reload(); }, [id]);
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
  if (!receipt) return <div className="p-10 text-slate-500">Đang tải phiếu…</div>;
  const editable = receipt.status === "pending_explanation" || receipt.status === "draft";

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
  async function createNew() {
    setBusy(true);
    try {
      const product = await createReceiptProduct({ areaId: receipt.areaId, productCode: newCode, productName: query.trim(), unit: newUnit, itemType: "ingredient" });
      setSelected(product); setResults([]); setShowCreate(false);
    } catch (error) { alert(error instanceof Error ? error.message : "Không thể tạo sản phẩm."); }
    finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">
    <button onClick={() => navigate("/admin/inventory-receipts")} className="flex items-center gap-2 font-semibold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Danh sách phiếu</button>
    <div className="mt-5 rounded-3xl border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{receipt.receiptCode}</h1><p className="mt-2 text-slate-500">{receipt.area.name} • {receipt.createdByName} • {new Date(receipt.createdAt).toLocaleString("vi-VN")}</p></div>
      <div className="flex items-center gap-2">{editable && <button disabled={busy} onClick={cancelReceipt} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Hủy phiếu</button>}
        <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">{receipt.status}</div></div>
    </div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-slate-500">Địa điểm</span><b className="block">{receipt.images[0]?.locationAddress || "Tọa độ đã lưu trong ảnh"}</b></div>
      <div><span className="text-slate-500">Số món</span><b className="block">{receipt.itemCount}</b></div><div><span className="text-slate-500">Tổng tiền</span><b className="block text-lg">{receipt.totalAmount.toLocaleString("vi-VN")} ₫</b></div></div>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[40%_60%]">
      <section className="rounded-3xl border bg-white p-5"><h2 className="text-xl font-bold">Ảnh hóa đơn</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">{receipt.images.map((image, index) => <button key={image.id} onClick={() => setLightbox(index)} className="group relative overflow-hidden rounded-2xl bg-slate-100">
          <PrivateApiImage src={image.thumbnailUrl} className="aspect-[3/4] w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><ZoomIn /></span></button>)}</div>
      </section>
      <section className="rounded-3xl border bg-white p-5"><h2 className="text-xl font-bold">Giải trình hàng hóa</h2>
        <div className="mt-4 space-y-2">{receipt.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
          <div><b>{item.productName}</b><div className="mt-1 text-sm text-slate-500">{item.productCode} • {item.quantity} {item.unit} × {item.unitPrice.toLocaleString("vi-VN")} ₫</div></div>
          <div className="flex items-center gap-3"><b>{item.lineTotal.toLocaleString("vi-VN")} ₫</b>{editable && <>
            <button onClick={() => beginEdit(item)} className="text-emerald-700" aria-label={`Sửa ${item.productName}`}><Pencil className="h-4 w-4" /></button>
            <button onClick={async () => { if (confirm("Xóa dòng hàng?")) { await deleteInventoryReceiptItem(item.id); reload(); } }} className="text-rose-600" aria-label={`Xóa ${item.productName}`}><Trash2 className="h-4 w-4" /></button>
          </>}</div>
        </div>)}</div>
        {editable && <div className="mt-5 rounded-2xl bg-emerald-50 p-4"><h3 className="font-bold">Thêm món</h3>
          <div className="relative mt-3"><input value={query} onFocus={() => setSuggestionsOpen(true)} onChange={(e) => { setQuery(e.target.value); setSelected(null); setSuggestionsOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult((x) => Math.max(0, x - 1)); }
              if (e.key === "Enter" && results[activeResult]) { e.preventDefault(); choose(results[activeResult]); }
              if (e.key === "Escape") setResults([]);
            }} placeholder="Chạm để xem hàng của quầy hoặc nhập tên/mã" className="w-full rounded-xl border px-4 py-3 outline-none focus:border-emerald-500" />
            {searchError && <p className="mt-2 text-sm text-rose-700">{searchError}</p>}
            {suggestionsOpen && results.length > 0 && <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{results.map((product, index) =>
              <button key={`${product.areaId}-${product.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(product)} className={`block w-full rounded-lg p-3 text-left ${activeResult === index ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                <b>{product.productName}</b><small className="ml-2 text-slate-500">{product.productCode} • {product.unit}</small>
                {!product.attachedToCurrentArea && <span className="block text-xs text-amber-700">Đã tồn tại – chưa sử dụng tại {receipt.area.name}. Nhấn để thêm.</span>}
              </button>)}{query.trim().length >= 2 && <button onClick={() => setShowCreate(true)} className="w-full rounded-lg p-3 text-left font-bold text-emerald-700"><Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query}”</button>}</div>}
            {suggestionsOpen && query.trim().length >= 2 && results.length === 0 && !selected && !searchError &&
              <button onMouseDown={(event) => event.preventDefault()} onClick={() => setShowCreate(true)} className="mt-2 w-full rounded-xl bg-white p-3 text-left font-bold text-emerald-700 shadow-sm">
                <Plus className="mr-2 inline h-4 w-4" />Tạo mới “{query.trim()}”
              </button>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="0" step="0.001" placeholder="Số lượng" className="rounded-xl border px-4 py-3" />
            <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} type="number" min="0" step="100" placeholder="Đơn giá" className="rounded-xl border px-4 py-3" /></div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" className="mt-3 w-full rounded-xl border px-4 py-3" />
          <div className="mt-3 flex items-center justify-between"><b>Tạm tính: {((Number(quantity) || 0) * (Number(unitPrice) || 0)).toLocaleString("vi-VN")} ₫</b>
            <button disabled={busy || !selected || Number(quantity) <= 0 || unitPrice === ""} onClick={addItem} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">Thêm món</button></div>
        </div>}
        <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white"><div className="text-sm text-slate-300">Tổng số lượng {receipt.totalQuantity}</div><div className="mt-1 text-3xl font-bold">{receipt.totalAmount.toLocaleString("vi-VN")} ₫</div></div>
        {editable && <button disabled={busy || !receipt.items.length || !receipt.images.length} onClick={finish} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">Hoàn thành nhập kho</button>}
      </section>
    </div>
  </div>
  {lightbox !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"><button onClick={() => setLightbox(null)} className="absolute right-5 top-5 text-white"><X /></button>
    <button onClick={() => setLightbox((lightbox - 1 + receipt.images.length) % receipt.images.length)} className="absolute left-4 text-white"><ChevronLeft className="h-10 w-10" /></button>
    <PrivateApiImage src={receipt.images[lightbox].url} className="max-h-[90vh] max-w-[90vw] object-contain" />
    <button onClick={() => setLightbox((lightbox + 1) % receipt.images.length)} className="absolute right-4 text-white"><ChevronRight className="h-10 w-10" /></button></div>}
  {showCreate && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6">
    <h2 className="text-2xl font-bold">Tạo hàng hóa mới</h2><p className="mt-2 text-slate-500">Tên: <b>{query}</b></p>
    <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Mã sản phẩm" className="mt-4 w-full rounded-xl border px-4 py-3" />
    <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Đơn vị tính" className="mt-3 w-full rounded-xl border px-4 py-3" />
    <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-3">Hủy</button>
      <button disabled={!newCode || !newUnit || busy} onClick={createNew} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">Tạo và chọn</button></div>
  </div></div>}
  {editingItem && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6">
    <h2 className="text-2xl font-bold">Sửa dòng hàng</h2>
    <p className="mt-2 text-slate-500"><b>{editingItem.productName}</b> • {editingItem.productCode} • {editingItem.unit}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-600">Số lượng<input value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} type="number" min="0" step="0.001" className="mt-1 w-full rounded-xl border px-4 py-3 text-slate-900" /></label>
      <label className="text-sm font-semibold text-slate-600">Đơn giá<input value={editUnitPrice} onChange={(event) => setEditUnitPrice(event.target.value)} type="number" min="0" step="100" className="mt-1 w-full rounded-xl border px-4 py-3 text-slate-900" /></label>
    </div>
    <label className="mt-3 block text-sm font-semibold text-slate-600">Ghi chú<input value={editNote} onChange={(event) => setEditNote(event.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3 text-slate-900" /></label>
    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-right font-bold">Thành tiền: {((Number(editQuantity) || 0) * (Number(editUnitPrice) || 0)).toLocaleString("vi-VN")} ₫</div>
    <div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => setEditingItem(null)} className="rounded-xl px-4 py-3">Đóng</button>
      <button disabled={busy || Number(editQuantity) <= 0 || editUnitPrice === "" || Number(editUnitPrice) < 0} onClick={saveEdit} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">Lưu thay đổi</button></div>
  </div></div>}</div>;
}
