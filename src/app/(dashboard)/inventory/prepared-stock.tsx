import { createElement as h, useEffect, useMemo, useState } from "react";
import { FlaskConical, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { getPreparedStock, savePreparedStockCount, type PreparedStockOverview } from "@/services/preparedStockService";

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const qty = (value: number | null) => value === null ? "Chưa chốt" : value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function PreparedStockTab() {
  const { storeId } = useStore(); const now = new Date();
  const [from] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [data, setData] = useState<PreparedStockOverview | null>(null);
  const [values, setValues] = useState<Record<string,string>>({});
  const [search, setSearch] = useState(""); const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await getPreparedStock(storeId, from, to); setData(result);
      setValues(Object.fromEntries(result.items.map((item) => [item.ingredientId, String(item.actualQuantity ?? item.currentQuantity)])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải tồn bán thành phẩm."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [storeId]);
  const items = useMemo(() => { const term=search.trim().toLocaleLowerCase("vi"); return !term?(data?.items??[]):(data?.items??[]).filter((item)=>`${item.ingredientCode} ${item.ingredientName} ${item.components.map((component)=>component.ingredientName).join(" ")}`.toLocaleLowerCase("vi").includes(term)); }, [data,search]);
  async function save() {
    if (!data || data.items.length === 0 || data.isLocked) return; setSaving(true); setError(""); setMessage("");
    try {
      await savePreparedStockCount({ storeId, countDate: to, note, items: data.items.map((item)=>({ ingredientId:item.ingredientId, actualQuantity:Math.max(0,Number((values[item.ingredientId]??"0").replace(",","."))||0) })) });
      setMessage(`Đã lưu tồn bán thành phẩm ngày ${to}.`); setNote(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu tồn bán thành phẩm."); }
    finally { setSaving(false); }
  }
  if (loading&&!data) return h("div",{className:"p-16 text-center text-slate-500"},h(LoaderCircle,{className:"mx-auto mb-3 animate-spin"}),"Đang tải tồn bán thành phẩm...");
  return h("div",{className:"mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6"},
    h("section",{className:"rounded-2xl border bg-white p-5 shadow-sm"},h("div",{className:"flex flex-wrap items-end justify-between gap-4"},
      h("div",{},h("h2",{className:"text-2xl font-black text-emerald-950"},"Tồn bán thành phẩm"),h("p",{className:"text-sm text-slate-500"},"Ghi nhận cốt, trà ủ, syrup hoặc nguyên liệu đã sơ chế còn lại để chuyển sang ngày sau.")),
      h("div",{className:"flex items-end gap-2"},h("label",{className:"text-xs font-bold text-slate-600"},"Ngày chốt",h("input",{type:"date",max:iso(now),value:to,onChange:(event:any)=>setTo(event.target.value),className:"mt-1 block h-10 rounded-lg border px-3 text-sm"})),h("button",{onClick:()=>void load(),className:"flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800"},h(RefreshCw,{className:"h-4 w-4"}),"Xem")))),
    h("div",{className:"rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"},"Số tồn này được quy đổi về nguyên liệu gốc và bù trừ khi tính thực dùng. Ví dụ cốt cà phê tồn tăng sẽ không bị tính là cà phê hao hụt."),
    data?.isLocked?h("div",{className:"rounded-xl border border-slate-300 bg-slate-100 p-3 text-sm font-semibold text-slate-700"},"Ngày này đã khóa. Chỉ admin hoặc tài khoản có quyền sửa chốt kho quá ngày được chỉnh sửa."):null,
    error?h("div",{className:"rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700"},error):null,
    message?h("div",{className:"rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"},message):null,
    h("section",{className:"overflow-hidden rounded-2xl border bg-white shadow-sm"},
      h("div",{className:"flex flex-wrap items-end justify-between gap-3 border-b p-4"},h("label",{className:"flex-1"},h("input",{value:search,onChange:(event:any)=>setSearch(event.target.value),placeholder:"Tìm mã, tên bán thành phẩm hoặc nguyên liệu gốc...",className:"h-11 w-full max-w-md rounded-lg border bg-slate-50 px-4"})),h("label",{className:"flex-1 text-sm font-bold text-slate-700"},"Ghi chú",h("input",{disabled:data?.isLocked,value:note,onChange:(event:any)=>setNote(event.target.value),placeholder:"Mẻ pha, tình trạng bảo quản...",className:"mt-1 h-10 w-full max-w-md rounded-lg border px-3 font-normal disabled:bg-slate-100"})),h("button",{disabled:saving||!data?.items.length||data?.isLocked,onClick:()=>void save(),title:data?.isLocked?"Ngày này đã khóa":undefined,className:"flex h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"},h(Save,{className:"h-4 w-4"}),saving?"Đang lưu...":data?.isLocked?"Ngày đã khóa":"Lưu tồn cuối ngày")),
      h("div",{className:"overflow-x-auto"},h("table",{className:"w-full min-w-[900px] text-sm"},
        h("thead",{className:"bg-emerald-950 text-left text-white"},h("tr",{},...["Mã","Bán thành phẩm","Đơn vị","Đã dùng theo món","Nguyên liệu gốc","Quy đổi tồn nguyên liệu gốc","Tồn cuối ngày"].map((label)=>h("th",{key:label,className:"px-4 py-3 last:text-right"},label)))),
        h("tbody",{className:"divide-y"},...items.map((item)=>{const actual=Math.max(0,Number((values[item.ingredientId]??"0").replace(",","."))||0);return h("tr",{key:item.ingredientId,className:"hover:bg-emerald-50/40"},h("td",{className:"px-4 py-3 font-bold text-emerald-800"},item.ingredientCode),h("td",{className:"px-4 py-3 font-semibold"},item.ingredientName),h("td",{className:"px-4 py-3"},item.unit||"—"),h("td",{className:"px-4 py-3 text-right"},qty(item.usedQuantity)),h("td",{className:"px-4 py-3"},...item.components.map((component)=>h("p",{key:component.ingredientId},`${component.ingredientName} (${component.unit})`))),h("td",{className:"px-4 py-3 text-right font-semibold"},...item.components.map((component)=>h("p",{key:component.ingredientId},`${qty(actual*component.conversionFactor)} ${component.unit}`))),h("td",{className:"px-4 py-2 text-right"},h("input",{disabled:data?.isLocked,inputMode:"decimal",value:values[item.ingredientId]??"",onChange:(event:any)=>setValues({...values,[item.ingredientId]:event.target.value}),className:"h-10 w-32 rounded-lg border px-3 text-right font-bold disabled:bg-slate-100 disabled:text-slate-500"})))})))),
      items.length===0?h("div",{className:"p-14 text-center text-slate-500"},h(FlaskConical,{className:"mx-auto mb-2 text-slate-300"}),"Chưa có bán thành phẩm. Hãy đánh dấu ‘Đây là bán thành phẩm’ tại trang Nguyên liệu."):null),
    data?.latestCountDate?h("p",{className:"text-sm text-slate-500"},`Lần chốt gần nhất: ${data.latestCountDate}`):null);
}
