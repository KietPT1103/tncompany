import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FilterX, ImageIcon, Search } from "lucide-react";
import { getAreas, getInventoryReceipts, type Area, type InventoryReceipt, type ReceiptFilters, type ReceiptStatus } from "@/services/inventoryReceiptService";
import PrivateApiImage from "@/components/PrivateApiImage";
import {
  inventoryReceiptFiltersFromSearchParams,
  inventoryReceiptFiltersToSearchParams,
} from "./inventoryReceiptFilters";

const tabs: Array<{ status?: ReceiptStatus; label: string }> = [
  { status: "pending_explanation", label: "Chưa giải trình" }, { status: "draft", label: "Đang giải trình" },
  { status: "completed", label: "Đã hoàn thành" }, { status: "cancelled", label: "Đã hủy" }, { label: "Tất cả" }
];
const labels: Record<ReceiptStatus, string> = {
  pending_explanation: "Chưa giải trình", draft: "Đang giải trình", completed: "Đã hoàn thành", cancelled: "Đã hủy"
};
const badges: Record<ReceiptStatus, string> = {
  pending_explanation: "bg-amber-100 text-amber-800", draft: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-700",
};
const tabClassName = (active: boolean) => active
  ? "bg-emerald-600 text-white"
  : "text-slate-600 hover:bg-slate-50";

export default function FieldInventoryReceiptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [areas, setAreas] = useState<Area[]>([]);
  const [items, setItems] = useState<InventoryReceipt[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const searchKey = searchParams.toString();
  const filters = useMemo(
    () => inventoryReceiptFiltersFromSearchParams(new URLSearchParams(searchKey)),
    [searchKey],
  );
  const key = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => { getAreas().then(setAreas).catch(() => setAreas([])); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getInventoryReceipts(filters).then((data) => {
      if (!active) return;
      setItems(data.items); setCounts(data.counts); setPagination(data.pagination);
    }).catch((reason: unknown) => {
      if (!active) return;
      setItems([]);
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách phiếu nhập.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [key, reloadKey]);
  const change = (next: Partial<ReceiptFilters>) => {
    const updated = { ...filters, ...next, page: next.page ?? 1 };
    setSearchParams(inventoryReceiptFiltersToSearchParams(updated), { replace: true });
  };
  const returnTo = `${location.pathname}${searchKey ? `?${searchKey}` : ""}`;

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6 2xl:p-8"><div className="mx-auto max-w-[1680px]">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>
      <div className="text-sm font-bold uppercase tracking-[.2em] text-emerald-600">Kho vận</div>
      <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Phiếu nhập hiện trường</h1>
      <p className="mt-2 text-slate-500">Theo dõi ảnh hóa đơn, giải trình và trạng thái nhập kho.</p>
    </div><div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-500">Tổng <b className="text-slate-900">{pagination.total}</b> phiếu</div></div>
    <div className="mt-7 overflow-x-auto rounded-2xl border bg-white p-2"><div className="flex min-w-max gap-2">
      {tabs.map((tab) => <button key={tab.label} onClick={() => change({ status: tab.status })}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tabClassName(filters.status === tab.status)}`}>
        {tab.label} <span className="ml-1 opacity-75">{counts[tab.status || "all"] || 0}</span></button>)}
    </div></div>
    <div className="mt-4 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_minmax(145px,1fr)_minmax(145px,1fr)_minmax(160px,1fr)_minmax(190px,1.4fr)_minmax(120px,.8fr)]">
      <label className="relative xl:col-span-2 2xl:col-span-1"><span className="sr-only">Tìm theo mã phiếu hoặc địa điểm</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input value={filters.keyword || ""} onChange={(e) => change({ keyword: e.target.value })} placeholder="Mã phiếu, địa điểm..." className="w-full rounded-xl border py-3 pl-10 pr-3 outline-none focus:border-emerald-400" /></label>
      <select aria-label="Lọc theo khu vực" value={filters.areaId || ""} onChange={(e) => change({ areaId: e.target.value })} className="min-h-12 rounded-xl border bg-white px-3"><option value="">Tất cả khu vực</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input aria-label="Từ ngày" type="date" value={filters.dateFrom || ""} onChange={(e) => change({ dateFrom: e.target.value })} className="min-h-12 rounded-xl border px-3" />
      <input aria-label="Đến ngày" type="date" value={filters.dateTo || ""} onChange={(e) => change({ dateTo: e.target.value })} className="min-h-12 rounded-xl border px-3" />
      <input aria-label="Mã người chụp ảnh" value={filters.employeeId || ""} onChange={(e) => change({ employeeId: e.target.value })} placeholder="Mã người chụp" className="min-h-12 rounded-xl border px-3" />
      <input aria-label="Tên hoặc mã hàng" value={filters.productKeyword || ""} onChange={(e) => change({ productKeyword: e.target.value })} placeholder="Tên/mã hàng" className="min-h-12 rounded-xl border px-3" />
      <button onClick={() => setSearchParams(inventoryReceiptFiltersToSearchParams({ status: filters.status, page: 1, limit: 20 }), { replace: true })} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border font-semibold text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"><FilterX className="h-4 w-4" /> Đặt lại</button>
    </div>
    <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
      <div className="hidden grid-cols-[72px_minmax(180px,1.2fr)_minmax(100px,.7fr)_minmax(150px,1fr)_minmax(100px,.7fr)_minmax(130px,.8fr)_minmax(120px,.8fr)] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500 xl:grid 2xl:px-6">
        <span>Ảnh</span><span>Phiếu</span><span>Khu</span><span>Người chụp ảnh</span><span>Số liệu</span><span>Tổng tiền</span><span>Trạng thái</span>
      </div>
      {loading ? <div className="p-12 text-center text-slate-500">Đang tải…</div> : error ? <div className="p-12 text-center">
        <p className="text-sm font-semibold text-red-600">{error}</p>
        <button onClick={() => setReloadKey((value) => value + 1)} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Thử lại</button>
      </div> : items.length === 0 ? <div className="p-12 text-center text-slate-500">Không có phiếu phù hợp.</div> :
        items.map((item) => <button key={item.id} onClick={() => navigate(`/admin/inventory-receipts/${item.id}`, { state: { returnTo } })}
          aria-label={`Mở chi tiết phiếu ${item.receiptCode}`}
          className="grid w-full gap-3 border-b px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 xl:grid-cols-[72px_minmax(180px,1.2fr)_minmax(100px,.7fr)_minmax(150px,1fr)_minmax(100px,.7fr)_minmax(130px,.8fr)_minmax(120px,.8fr)] xl:items-center xl:gap-4 2xl:px-6">
          <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">{item.thumbnailUrl ? <PrivateApiImage src={item.thumbnailUrl} className="h-full w-full object-cover" /> : <ImageIcon className="m-4 h-6 w-6 text-slate-300" />}</div>
          <div><div className="font-bold">{item.receiptCode}</div><div className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</div></div>
          <b className="text-slate-700">{item.area.name}</b><span className="text-sm font-medium text-slate-700">{item.capturedByName || item.createdByName || "Chưa xác định"}</span>
          <span className="text-sm text-slate-600">{item.status === "pending_explanation" ? "Chưa nhập" : `${item.itemCount} món`}<small className="block">{item.imageCount} ảnh</small></span>
          <b>{item.status === "pending_explanation" ? "Chưa nhập" : `${item.totalAmount.toLocaleString("vi-VN")} ₫`}</b>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${item.isLocked ? "bg-amber-100 text-amber-800" : badges[item.status]}`}>{item.isLocked ? "Đã khóa" : labels[item.status]}</span>
        </button>)}
    </div>
    <div className="mt-4 flex items-center justify-end gap-3"><button aria-label="Trang trước" disabled={pagination.page <= 1} onClick={() => change({ page: pagination.page - 1 })} className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white p-2 transition-colors hover:bg-slate-50 disabled:opacity-40"><ChevronLeft /></button>
      <span className="text-sm">Trang {pagination.page}/{Math.max(1, pagination.pages)}</span>
      <button aria-label="Trang sau" disabled={pagination.page >= pagination.pages} onClick={() => change({ page: pagination.page + 1 })} className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white p-2 transition-colors hover:bg-slate-50 disabled:opacity-40"><ChevronRight /></button></div>
  </div></div>;
}
