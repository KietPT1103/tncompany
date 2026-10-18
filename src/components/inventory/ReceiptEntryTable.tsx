import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addInventoryReceiptItem, attachReceiptProduct, createReceiptProduct, searchWarehouseProducts, type ProductResult, type WarehouseType } from "@/services/inventoryReceiptService";
import { validReceiptLine } from "./receiptLineValidation";

type Line = { key: string; product: ProductResult | null; query: string; quantity: string; unitPrice: string; note: string };
const emptyLine = (): Line => ({ key: crypto.randomUUID(), product: null, query: "", quantity: "", unitPrice: "", note: "" });
const money = (value: number) => value.toLocaleString("vi-VN");
export default function ReceiptEntryTable({ receiptId, areaId, warehouseType, disabled, canCreate, onSaved, onPendingChange, onSavingChange }: {
  receiptId: string; areaId: string; warehouseType: WarehouseType; disabled: boolean; canCreate: boolean;
  onSaved: () => Promise<void>; onPendingChange: (pending: boolean) => void; onSavingChange: (saving: boolean) => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [active, setActive] = useState<string | null>(null);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const current = lines.find(line => line.key === active);
  const pending = lines.some(line => !!(line.query.trim() || line.quantity || line.unitPrice || line.note));
  useEffect(() => { onSavingChange(saving); }, [saving, onSavingChange]);
  useEffect(() => { onPendingChange(pending || saving); }, [pending, saving, onPendingChange]);
  useEffect(() => {
    if (!current || current.product) { setResults([]); return; }
    let alive = true;
    setResults([]);
    const timer = setTimeout(() => {
      searchWarehouseProducts(current.query, areaId, warehouseType).then(items => { if (alive) { setResults(items); setError(""); } }).catch(error => { if (alive) setError(error.message); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [active, current?.query, current?.product, areaId, warehouseType]);
  const update = (key: string, patch: Partial<Line>) => setLines(rows => rows.map(row => row.key === key ? { ...row, ...patch } : row));
  async function choose(key: string, product: ProductResult) {
    try {
      if (!product.attachedToCurrentArea) {
        const attached = await attachReceiptProduct(product.id, areaId);
        product = { ...product, id: attached.id, areaId, attachedToCurrentArea: true };
      }
      update(key, { product, query: product.productName, unitPrice: product.unitPrice == null ? "" : String(product.unitPrice) });
      setActive(null); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể chọn hàng hóa."); }
  }
  async function create(key: string, name: string) {
    const unit = prompt("Đơn vị tính của hàng hóa mới", "cái");
    if (unit === null || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try { await choose(key, await createReceiptProduct({ areaId, warehouseType, ingredientName: name, unit })); }
    catch (error) { setError(error instanceof Error ? error.message : "Không thể tạo hàng hóa."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const filled = lines.filter(line => line.query.trim() || line.quantity || line.unitPrice || line.note);
  async function save() {
    if (savingRef.current || !filled.length || filled.some(line => !validReceiptLine(line))) return;
    savingRef.current = true; setSaving(true); setError(""); setActive(null);
    let saved = 0;
    try {
      for (const line of filled) {
        const product = line.product!;
        await addInventoryReceiptItem({ receiptId, productId: product.id, itemType: warehouseType, productCode: product.productCode, productName: product.productName, unit: product.unit, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), note: line.note });
        saved++;
        setLines(rows => rows.filter(row => row.key !== line.key));
      }
      setLines([emptyLine()]);
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể lưu dòng hàng. Các dòng chưa lưu được giữ lại để thử lại."); }
    finally {
      if (saved) { try { await onSaved(); } catch { setError("Đã lưu dòng hàng. Vui lòng tải lại phiếu để xem cập nhật."); } }
      savingRef.current = false; setSaving(false);
    }
  }
  const locked = disabled || saving;
  const inputClass = "h-11 w-full rounded-md border border-slate-200 bg-white px-3 disabled:opacity-50";
  return <div className="border-t border-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-4 py-3"><h3 className="font-bold text-emerald-950">Nhập mặt hàng</h3><p className="text-sm text-slate-600">Chọn hàng, nhập số lượng và đơn giá cho từng dòng</p></div>
    {error && <p role="alert" className="px-4 py-3 text-sm text-rose-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
      <thead className="bg-emerald-950 text-white"><tr>{["STT", "Mã hàng", "Tên mặt hàng", "Số lượng nhập", "Đơn vị", "Đơn giá", "Thành tiền", "Ghi chú", ""].map((label, index) => <th key={index} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody className="divide-y">{lines.map((line, index) => <tr key={line.key} className="align-top">
        <td className="p-3 text-center">{index + 1}</td><td className="p-3 text-emerald-800">{line.product?.productCode || "—"}</td>
        <td className="min-w-72 p-2"><input aria-label={`Mặt hàng dòng ${index + 1}`} disabled={locked} value={line.query} onFocus={() => setActive(line.key)} onChange={event => { update(line.key, { query: event.target.value, product: null }); setActive(line.key); }} onKeyDown={event => { if (event.key === "Escape") setActive(null); }} placeholder="Tìm tên hoặc mã hàng..." className={inputClass}/>
          {active === line.key && !line.product && <div className="mt-1 max-h-60 overflow-y-auto rounded-md border bg-white shadow-sm">
            {results.map(product => <button key={`${product.areaId}-${product.id}`} disabled={locked} onClick={() => void choose(line.key, product)} className="block w-full px-3 py-2 text-left hover:bg-emerald-50"><b>{product.productName}</b><small className="block text-slate-500">{product.productCode} · {product.unit}{!product.attachedToCurrentArea ? ` · ${product.areaName}` : ""}</small></button>)}
            {!results.length && <p className="px-3 py-2 text-slate-500">Nhập tên để tìm hàng hóa.</p>}
            {canCreate && line.query.trim().length >= 2 && <button disabled={locked} onClick={() => void create(line.key, line.query.trim())} className="w-full px-3 py-2 text-left font-bold text-emerald-700">+ Tạo mới “{line.query.trim()}”</button>}
          </div>}
        </td>
        <td className="w-36 p-2"><input aria-label={`Số lượng dòng ${index + 1}`} disabled={locked} type="number" min="0" step="0.001" value={line.quantity} onChange={event => update(line.key, { quantity: event.target.value })} className={`${inputClass} text-right`}/></td>
        <td className="p-3">{line.product?.unit || "—"}{line.product?.purchaseToBaseFactor && line.product.purchaseToBaseFactor !== 1 ? <small className="block text-slate-500">1 {line.product.unit} = {line.product.purchaseToBaseFactor} {line.product.baseUnit}</small> : null}</td>
        <td className="w-40 p-2"><input aria-label={`Đơn giá dòng ${index + 1}`} disabled={locked} type="number" min="0" step="any" value={line.unitPrice} onChange={event => update(line.key, { unitPrice: event.target.value })} className={`${inputClass} text-right`}/></td>
        <td className="whitespace-nowrap p-3 text-right font-bold">{money((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))} ₫</td>
        <td className="min-w-40 p-2"><input aria-label={`Ghi chú dòng ${index + 1}`} disabled={locked} value={line.note} onChange={event => update(line.key, { note: event.target.value })} className={inputClass}/></td>
        <td className="p-2"><button aria-label={`Xóa dòng ${index + 1}`} disabled={locked} onClick={() => setLines(rows => rows.length === 1 ? [emptyLine()] : rows.filter(row => row.key !== line.key))} className="flex h-11 w-11 items-center justify-center text-rose-600"><Trash2 size={16}/></button></td>
      </tr>)}</tbody>
      <tfoot className="bg-slate-50 font-bold"><tr><td colSpan={6} className="p-3 text-right">Tạm tính các dòng mới</td><td className="p-3 whitespace-nowrap text-right">{money(lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0))} ₫</td><td colSpan={2}/></tr></tfoot>
    </table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 p-4"><button disabled={locked} onClick={() => setLines(rows => [...rows, emptyLine()])} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-semibold"><Plus size={16}/>Thêm dòng</button><button disabled={locked || !filled.length || filled.some(line => !validReceiptLine(line))} onClick={() => void save()} className="min-h-11 rounded-md bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu nháp"}</button></div>
    {pending && <p className="px-4 pb-3 text-sm text-amber-800">Tạm lưu trước khi hoàn thành và cộng kho.</p>}
  </div>;
}
