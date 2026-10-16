import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { normalizeSearchText } from "@/lib/utils";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { InventoryPagination } from "@/components/ui/InventoryPagination";
import * as XLSX from "xlsx";

type EquipmentStock = { productCode: string; productName: string; unit: string; quantity: number; value?: number };
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
export default function EquipmentWarehouseStock() {
  const { storeId } = useStore();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<EquipmentStock[]>([]);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]);
    apiRequest<{ items: EquipmentStock[] }>(`/inventory-equipment-stock.php?areaId=${encodeURIComponent(storeId)}`)
      .then(data => { if (active) setItems(data.items); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải tồn dụng cụ."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, version]);
  useEffect(() => { setPage(1); }, [storeId, search, unit, pageSize]);
  const filtered = useMemo(() => {
    const term = normalizeSearchText(search.trim());
    return items.filter(item => (!unit || item.unit === unit) && (!term || normalizeSearchText(`${item.productCode} ${item.productName}`).includes(term)));
  }, [items, search, unit]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function exportStock() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(filtered.map(item => ({ "Mã": item.productCode, "Dụng cụ": item.productName, "Đơn vị": item.unit, "Số lượng": item.quantity, ...(isAdmin ? { "Giá trị nhập": item.value || 0 } : {}) }))), "Tồn dụng cụ");
    XLSX.writeFile(book, `ton-dung-cu-${storeId}.xlsx`);
  }
  return <div className="mx-auto max-w-[1680px] space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div><h2 className="text-2xl font-bold text-emerald-950">Tồn kho dụng cụ</h2><p className="mt-1 text-sm text-slate-500">Số lượng dụng cụ từ các phiếu nhập đã hoàn thành.</p></div>
      <div className="flex gap-2">{isAdmin && <button disabled={loading || !!error} onClick={exportStock} className="warehouse-button"><Download size={16}/>Xuất Excel</button>}<button disabled={loading} onClick={() => setVersion(value => value + 1)} className="warehouse-button"><RefreshCw size={16}/>Tải lại</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Số loại dụng cụ</p><b className="text-2xl text-emerald-950">{items.length}</b></div></div>
      <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Tổng số lượng · theo đơn vị từng dụng cụ</p><b className="text-2xl text-emerald-950">{number(items.reduce((sum, item) => sum + item.quantity, 0))}</b></div></div>
      {isAdmin && <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Tổng giá trị nhập</p><b className="text-2xl text-emerald-950">{number(items.reduce((sum, item) => sum + (item.value || 0), 0))} ₫</b></div></div>}
    </div>
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap gap-3 p-3"><input aria-label="Tìm dụng cụ" placeholder="Tìm mã hoặc tên dụng cụ…" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"/><select aria-label="Đơn vị dụng cụ" value={unit} onChange={event => setUnit(event.target.value)} className="min-h-11 rounded-lg border px-3"><option value="">Tất cả đơn vị</option>{[...new Set(items.map(item => item.unit))].map(value => <option value={value} key={value}>{value}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-emerald-50"><tr>{["Mã", "Tên dụng cụ", "Tồn kho hiện tại", "Đơn vị", ...(isAdmin ? ["Giá trị nhập"] : [])].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={isAdmin ? 5 : 4} className="p-8 text-center">Đang tải…</td></tr> : rows.map((item, index) => <tr className="border-t" key={index}><td className="p-3">{item.productCode || "—"}</td><td className="p-3 font-semibold">{item.productName}</td><td className="p-3 font-bold text-emerald-800">{number(item.quantity)}</td><td className="p-3">{item.unit}</td>{isAdmin && <td className="p-3">{number(item.value || 0)} ₫</td>}</tr>)}{!loading && !rows.length && <tr><td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-slate-500">Không có dụng cụ phù hợp.</td></tr>}</tbody></table></div>
      <InventoryPagination page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading}/>
    </section>
  </div>;
}
