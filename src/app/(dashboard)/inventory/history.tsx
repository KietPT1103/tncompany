import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { getInventoryHistory, type InventoryHistoryEntry } from "@/services/inventoryHistoryService";

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
const statusText: Record<InventoryHistoryEntry["status"], string> = {
  pending_explanation: "Chờ giải trình", draft: "Nháp", completed: "Hoàn thành", cancelled: "Đã hủy",
};

export default function InventoryHistoryTab() {
  const { storeId } = useStore();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(iso(today));
  const [type, setType] = useState<"all" | "receipt" | "issue">("all");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<InventoryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await getInventoryHistory({ storeId, type, dateFrom, dateTo, limit: 200 });
      setEntries(result.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lịch sử kho.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [storeId]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return entries.flatMap((entry) => entry.items.map((item) => ({ entry, item }))).filter(({ entry, item }) =>
      !keyword || `${entry.code} ${entry.actorName} ${entry.counterpart} ${item.ingredientCode} ${item.ingredientName}`.toLocaleLowerCase("vi").includes(keyword)
    );
  }, [entries, query]);
  const receiptTotal = rows.filter(({ entry }) => entry.type === "receipt").reduce((sum, row) => sum + row.item.quantity, 0);
  const issueTotal = rows.filter(({ entry }) => entry.type === "issue").reduce((sum, row) => sum + row.item.quantity, 0);

  return <div className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6">
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-emerald-950">Lịch sử nhập · xuất kho</h2><p className="text-sm text-slate-500">Đối chiếu chi tiết từng nguyên liệu, số lượng, giá nhập và người thực hiện.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-600">Loại<select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="mt-1 block h-10 rounded-lg border px-3 text-sm"><option value="all">Tất cả</option><option value="receipt">Nhập kho</option><option value="issue">Xuất kho</option></select></label>
          <label className="text-xs font-bold text-slate-600">Từ ngày<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block h-10 rounded-lg border px-3 text-sm" /></label>
          <label className="text-xs font-bold text-slate-600">Đến ngày<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block h-10 rounded-lg border px-3 text-sm" /></label>
          <button onClick={() => void load()} disabled={loading} className="flex h-10 items-center gap-2 rounded-lg border border-emerald-700 px-4 font-bold text-emerald-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Xem</button>
        </div>
      </div>
    </section>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Summary label="Dòng nguyên liệu" value={number(rows.length)} />
      <Summary label="Tổng nhập" value={number(receiptTotal)} tone="emerald" />
      <Summary label="Tổng xuất" value={number(issueTotal)} tone="amber" />
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative border-b p-4"><Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, nguyên liệu, người nhập/xuất..." className="h-11 w-full max-w-xl rounded-lg border bg-slate-50 pl-10 pr-4" /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1350px] text-sm">
          <thead className="bg-emerald-950 text-left text-white"><tr>{["Ngày","Loại","Mã phiếu","Mã NL","Tên nguyên liệu","Số lượng","Đơn vị","Đơn giá","Thành tiền","Người nhập/xuất","NCC/Nơi nhận","Trạng thái","Ghi chú"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y">
            {rows.map(({ entry, item }) => <tr key={entry.type + entry.id + item.id} className="hover:bg-emerald-50/50">
              <td className="whitespace-nowrap px-3 py-3">{new Date(entry.date + "T00:00:00").toLocaleDateString("vi-VN")}</td>
              <td className="px-3 py-3"><span className={entry.type === "receipt" ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-800" : "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800"}>{entry.type === "receipt" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}{entry.type === "receipt" ? "Nhập" : "Xuất"}</span></td>
              <td className="px-3 py-3 font-bold text-emerald-800">{entry.code}</td>
              <td className="px-3 py-3 font-mono">{item.ingredientCode}</td>
              <td className="px-3 py-3 font-semibold">{item.ingredientName}</td>
              <td className="px-3 py-3 text-right font-bold">{number(item.quantity)}</td>
              <td className="px-3 py-3">{item.unit || "—"}</td>
              <td className="px-3 py-3 text-right">{entry.type === "receipt" ? money(item.unitCost) : "—"}</td>
              <td className="px-3 py-3 text-right font-semibold">{entry.type === "receipt" ? money(item.lineTotal) : "—"}</td>
              <td className="px-3 py-3">{entry.actorName}</td><td className="px-3 py-3">{entry.counterpart}</td>
              <td className="px-3 py-3">{statusText[entry.status] || entry.status}</td><td className="max-w-56 px-3 py-3 text-slate-500">{item.note || entry.note || "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {loading ? <div className="p-14 text-center text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Đang tải lịch sử...</div> : rows.length === 0 ? <div className="p-14 text-center text-slate-500">Không có dữ liệu phù hợp.</div> : null}
    </section>
  </div>;
}

function Summary({label,value,tone="slate"}:{label:string;value:string;tone?:"slate"|"emerald"|"amber"}) {
  const color = tone === "emerald" ? "text-emerald-800" : tone === "amber" ? "text-amber-700" : "text-slate-800";
  return <article className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className={"mt-2 text-2xl font-black " + color}>{value}</p></article>;
}
