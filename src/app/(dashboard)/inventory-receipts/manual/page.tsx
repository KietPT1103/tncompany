import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getIngredients, type Ingredient } from "@/services/ingredients";
import { getSuppliers, type Supplier } from "@/services/suppliers";
import { createManualInventoryReceipt } from "@/services/inventoryReceiptService";

type DraftLine = {
  key: string;
  ingredientCode: string;
  quantity: string;
  unitCost: string;
  note: string;
};

const localKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const emptyLine = (): DraftLine => ({ key: localKey(), ingredientCode: "", quantity: "", unitCost: "", note: "" });
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;
const formatQuantity = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const formatMoney = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export default function ManualInventoryReceiptPage() {
  const navigate = useNavigate();
  const { storeId } = useStore();
  const { user } = useAuth();
  const actor = user?.displayName || user?.username || user?.email || "";
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receiptDate, setReceiptDate] = useState(localToday());
  const [enteredBy, setEnteredBy] = useState(actor);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftLine[]>([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (actor && !enteredBy) setEnteredBy(actor);
  }, [actor, enteredBy]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getIngredients(storeId), getSuppliers(storeId)])
      .then(([ingredientResult, supplierResult]) => {
        setIngredients(ingredientResult.items.filter((item) => item.isActive));
        setSuppliers(supplierResult.items.filter((item) => item.isActive));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu nhập kho."))
      .finally(() => setLoading(false));
  }, [storeId]);

  const ingredientByCode = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.ingredientCode, ingredient])),
    [ingredients],
  );
  const totals = useMemo(() => items.reduce((result, item) => {
    const quantity = parseNumber(item.quantity);
    const unitCost = parseNumber(item.unitCost);
    result.quantity += quantity;
    result.amount += quantity * unitCost;
    return result;
  }, { quantity: 0, amount: 0 }), [items]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submit() {
    const normalized = items
      .filter((item) => item.ingredientCode || item.quantity.trim() || item.unitCost.trim())
      .map((item) => ({
        ingredientCode: item.ingredientCode,
        quantity: parseNumber(item.quantity),
        unitCost: parseNumber(item.unitCost),
        note: item.note.trim(),
      }));
    if (!receiptDate || !enteredBy.trim() || normalized.length === 0) {
      setError("Vui lòng nhập ngày, người nhập liệu và ít nhất một nguyên liệu.");
      return;
    }
    if (normalized.some((item) => !item.ingredientCode || item.quantity <= 0 || item.unitCost < 0)) {
      setError("Mỗi dòng phải chọn nguyên liệu, có số lượng lớn hơn 0 và đơn giá không âm.");
      return;
    }
    if (new Set(normalized.map((item) => item.ingredientCode)).size !== normalized.length) {
      setError("Một nguyên liệu chỉ được xuất hiện một lần trong phiếu.");
      return;
    }
    if (!window.confirm(`Hoàn thành nhập ${formatQuantity(totals.quantity)} đơn vị, tổng tiền ${formatMoney(totals.amount)} ₫ và cộng tồn kho ngay?`)) return;
    setSaving(true);
    setError("");
    try {
      const receipt = await createManualInventoryReceipt({
        storeId,
        receiptDate,
        enteredBy: enteredBy.trim(),
        supplierId: supplierId || null,
        note: note.trim(),
        items: normalized,
      });
      navigate(`/admin/inventory-receipts/${receipt.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn thành nhập kho.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6 2xl:p-8">
    <div className="mx-auto max-w-[1680px]">
      <button onClick={() => navigate("/admin/inventory?tab=receipts")} className="inline-flex min-h-10 items-center gap-2 font-bold text-emerald-800 hover:text-emerald-950"><ArrowLeft className="h-4 w-4" /> Sổ kho</button>
      <header className="mt-4"><div className="text-sm font-bold uppercase tracking-[.2em] text-amber-600">Thu ngân ghi sổ</div>
        <h1 className="mt-2 text-3xl font-black text-emerald-950 sm:text-4xl">Nhập nguyên liệu vào kho</h1>
        <p className="mt-2 text-slate-600">Dùng khi mua nguyên liệu về. Hoàn thành phiếu sẽ cộng tồn ngay và lưu lại người nhập liệu.</p></header>
      {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-700">{error}</div>}
      <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-4 border-b bg-emerald-950 p-5 text-white md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">Ngày nhập<input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} className="mt-2 h-11 w-full rounded-md border bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Người nhập liệu<input value={enteredBy} onChange={(event) => setEnteredBy(event.target.value)} className="mt-2 h-11 w-full rounded-md border bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Nhà phân phối<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-2 h-11 w-full rounded-md border bg-white px-3 text-slate-950"><option value="">Không chọn</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}</select></label>
          <label className="text-sm font-semibold">Ghi chú<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Số hóa đơn, người giao..." className="mt-2 h-11 w-full rounded-md border bg-white px-3 text-slate-950" /></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-blue-600 text-white"><tr><th className="w-16 p-3 text-center">STT</th><th className="w-28 p-3">Mã NL</th><th className="p-3">Tên nguyên vật liệu</th><th className="w-36 p-3 text-right">Số lượng nhập</th><th className="w-24 p-3">Đơn vị</th><th className="w-32 p-3 text-right">Tồn trước</th><th className="w-32 p-3 text-right">Tồn sau</th><th className="w-40 p-3 text-right">Đơn giá</th><th className="w-40 p-3 text-right">Thành tiền</th><th className="p-3">Ghi chú</th><th className="w-14"></th></tr></thead>
          <tbody className="divide-y">{items.map((item, index) => {
            const ingredient = ingredientByCode.get(item.ingredientCode);
            const itemQuantity = parseNumber(item.quantity);
            const itemCost = parseNumber(item.unitCost);
            return <tr key={item.key} className="hover:bg-blue-50/40"><td className="p-3 text-center font-bold">{index + 1}</td><td className="p-3 font-bold text-emerald-800">{ingredient?.ingredientCode || "—"}</td>
              <td className="p-2"><select disabled={loading} value={item.ingredientCode} onChange={(event) => { const selected = ingredientByCode.get(event.target.value); updateLine(index, { ingredientCode: event.target.value, unitCost: item.unitCost || String(selected?.cost || 0) }); }} className="h-10 w-full rounded-md border px-3"><option value="">Chọn nguyên liệu...</option>{ingredients.map((option) => <option key={option.id} value={option.ingredientCode}>{option.ingredientName} ({option.ingredientCode})</option>)}</select></td>
              <td className="p-2"><input inputMode="decimal" value={item.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="h-10 w-full rounded-md border px-3 text-right font-bold" /></td><td className="p-3"><b>{ingredient?.purchaseUnit || ingredient?.unit || "—"}</b>{ingredient && ingredient.purchaseToBaseFactor !== 1 ? <small className="block text-slate-500">1 {ingredient.purchaseUnit} = {ingredient.purchaseToBaseFactor} {ingredient.baseUnit}</small> : null}</td>
              <td className="p-3 text-right">{ingredient ? formatQuantity(ingredient.stockQuantity) : "—"}</td><td className="p-3 text-right font-bold text-emerald-800">{ingredient ? formatQuantity(ingredient.stockQuantity + itemQuantity) : "—"}</td>
              <td className="p-2"><input inputMode="decimal" value={item.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} className="h-10 w-full rounded-md border px-3 text-right" /></td><td className="p-3 text-right font-bold">{formatMoney(itemQuantity * itemCost)} ₫</td>
              <td className="p-2"><input value={item.note} onChange={(event) => updateLine(index, { note: event.target.value })} className="h-10 w-full rounded-md border px-3" /></td><td className="p-2"><button disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td></tr>;
          })}</tbody>
          <tfoot className="bg-slate-50 font-black"><tr><td colSpan={3} className="p-3 text-right">Tổng</td><td className="p-3 text-right">{formatQuantity(totals.quantity)}</td><td colSpan={4}></td><td className="p-3 text-right">{formatMoney(totals.amount)} ₫</td><td colSpan={2}></td></tr></tfoot>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><button onClick={() => setItems((current) => [...current, emptyLine()])} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4 font-bold hover:bg-slate-50"><Plus className="h-4 w-4" /> Thêm dòng</button>
          <button disabled={saving || loading} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-800 px-5 font-bold text-white hover:bg-emerald-900 disabled:opacity-50"><PackagePlus className="h-4 w-4" /> {saving ? "Đang nhập kho..." : "Hoàn thành & cộng kho"}</button></div>
      </section>
    </div>
  </div>;
}
