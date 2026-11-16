import { normalizeSearchText as adminSearchText } from "@/lib/utils";
import { InventoryDateFilter } from "@/components/ui/InventoryDateFilter";
import { InventoryPagination } from "@/components/ui/InventoryPagination";
import { paginateItems } from "@/lib/listPagination";
import { inventoryToday } from "@/lib/inventoryPeriods";
import { createElement as h, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, FlaskConical, LoaderCircle, RefreshCw, Save, X } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { getPreparedStock, savePreparedStockCount, transferPreparedStock, type PreparedStockOverview } from "@/services/preparedStockService";

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const qty = (value: number | null) => value === null ? "Chưa chốt" : value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function PreparedStockTab() {
  const { storeId, activeStores } = useStore(); const now = new Date();
  const [transferItem, setTransferItem] = useState("");
  const [destination, setDestination] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const transferDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (transferOpen) transferDialog.current?.showModal();
    else transferDialog.current?.close();
  }, [transferOpen]);
  useEffect(() => { setTransferItem(""); setDestination(""); setTransferQuantity(""); setTransferNote(""); }, [storeId]);
  const [from, setFrom] = useState(inventoryToday);
  const [to, setTo] = useState(inventoryToday);
  useEffect(() => { setTransferOpen(false); }, [storeId, from, to]);
  const [data, setData] = useState<PreparedStockOverview | null>(null);
  const [values, setValues] = useState<Record<string,string>>({});
  const [page,setPage] = useState(1); const [pageSize,setPageSize] = useState(20);
  const [search, setSearch] = useState(""); const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function transfer() {
    const item = data?.items.find(item => item.ingredientId === transferItem);
    if (!item || saving || loading) return;
    if (data?.items.some(row => Number((values[row.ingredientId]??"0").replace(",",".")) !== (row.actualQuantity??row.currentQuantity))) {
      setError("Bạn có thay đổi tồn chưa lưu. Hãy lưu tồn cuối ngày hoặc tải lại trước khi xuất sang quầy.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      await transferPreparedStock({ storeId, destinationStoreId: destination, ingredientId: item.ingredientId,
        quantity: Number(transferQuantity.replace(",", ".")), expectedStock: item.currentQuantity, note: transferNote });
      setMessage("Đã xuất bán thành phẩm, cộng tồn quầy nhận và lưu lịch sử hai quầy.");
      setTransferQuantity(""); setTransferNote(""); setTransferOpen(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xuất bán thành phẩm."); }
    finally { setSaving(false); }
  }
  const loadSequence = useRef(0);
  async function load() {
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const result = await getPreparedStock(storeId, from, to); if(sequence!==loadSequence.current)return; setData(result);
      setValues(Object.fromEntries(result.items.map((item) => [item.ingredientId, String(item.actualQuantity ?? item.currentQuantity)])));
    } catch (reason) { if(sequence===loadSequence.current)setError(reason instanceof Error ? reason.message : "Không thể tải tồn bán thành phẩm."); }
    finally { if(sequence===loadSequence.current)setLoading(false); }
  }
  useEffect(() => { void load(); return()=>{loadSequence.current++}; }, [storeId,from,to]);
  const items = useMemo(() => { const term=adminSearchText(search.trim()); return !term?(data?.items??[]):(data?.items??[]).filter((item)=>adminSearchText(`${item.ingredientCode} ${item.ingredientName} ${item.components.map((component)=>component.ingredientName).join(" ")}`).includes(term)); }, [data,search]);
  useEffect(()=>{setPage(1)},[storeId,from,to,search,pageSize]);
  const paged=paginateItems(items,page,pageSize);
  async function save() {
    if (loading || saving || !data || data.items.length === 0 || data.isLocked || data.dateFrom!==from || data.dateTo!==to) return; setSaving(true); setError(""); setMessage("");
    try {
      await savePreparedStockCount({ storeId, countDate: to, note, items: data.items.map((item)=>({ ingredientId:item.ingredientId, expectedQuantity:item.currentQuantity, actualQuantity:Math.max(0,Number((values[item.ingredientId]??"0").replace(",","."))||0) })) });
      setMessage(`Đã lưu tồn bán thành phẩm ngày ${to}.`); setNote(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu tồn bán thành phẩm."); }
    finally { setSaving(false); }
  }
  if (loading&&!data) return h("div",{className:"p-16 text-center text-slate-500"},h(LoaderCircle,{className:"mx-auto mb-3 animate-spin"}),"Đang tải tồn bán thành phẩm...");
  return h("div",{className:"mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6"},
    h("section",{className:"rounded-2xl border bg-white p-5 shadow-sm"},h("div",{className:"flex flex-wrap items-end justify-between gap-4"},
      h("div",{},h("h2",{className:"text-2xl font-black text-emerald-950"},"Tồn bán thành phẩm"),h("p",{className:"text-sm text-slate-500"},"Ghi nhận cốt, trà ủ, syrup hoặc nguyên liệu đã sơ chế còn lại để chuyển sang ngày sau.")),
      h("div",{className:"flex w-full flex-wrap items-end gap-2 lg:w-auto"},h(InventoryDateFilter,{from,to,disabled:saving||loading,onChange:(start:string,end:string)=>{setFrom(start);setTo(end)}}),h("button",{disabled:loading||saving,onClick:()=>void load(),className:"flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800"},h(RefreshCw,{className:"h-4 w-4"}),"Tải lại"),h("button",{type:"button",disabled:loading||saving||!data?.items.length,title:to!==inventoryToday()?"Chọn ngày hôm nay để xuất bán thành phẩm":undefined,onClick:()=>{setError("");setTransferOpen(true)},className:"flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 font-bold text-white disabled:opacity-50"},h(ArrowRightLeft,{className:"h-4 w-4"}),"Xuất sang quầy")))),
    h("div",{className:"rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"},"Số tồn này được quy đổi về nguyên liệu gốc và bù trừ khi tính thực dùng. Ví dụ cốt cà phê tồn tăng sẽ không bị tính là cà phê hao hụt."),
    data?.isLocked?h("div",{className:"rounded-xl border border-slate-300 bg-slate-100 p-3 text-sm font-semibold text-slate-700"},"Ngày này đã khóa. Chỉ admin hoặc tài khoản có quyền sửa chốt kho quá ngày được chỉnh sửa."):null,
    error?h("div",{className:"rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700"},error):null,
    message?h("div",{className:"rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"},message):null,
    h("section",{className:"overflow-hidden rounded-2xl border bg-white shadow-sm"},
      h("div",{className:"flex flex-wrap items-end justify-between gap-3 border-b p-4"},h("label",{className:"flex-1"},h("input",{value:search,onChange:(event:any)=>setSearch(event.target.value),placeholder:"Tìm mã, tên bán thành phẩm hoặc nguyên liệu gốc...",className:"h-11 w-full max-w-md rounded-lg border bg-slate-50 px-4"})),h("label",{className:"flex-1 text-sm font-bold text-slate-700"},"Ghi chú",h("input",{disabled:loading||data?.isLocked,value:note,onChange:(event:any)=>setNote(event.target.value),placeholder:"Mẻ pha, tình trạng bảo quản...",className:"mt-1 h-10 w-full max-w-md rounded-lg border px-3 font-normal disabled:bg-slate-100"})),h("button",{disabled:saving||loading||!data?.items.length||data?.isLocked||data?.dateFrom!==from||data?.dateTo!==to,onClick:()=>void save(),title:data?.isLocked?"Ngày này đã khóa":undefined,className:"flex h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"},h(Save,{className:"h-4 w-4"}),saving?"Đang lưu...":data?.isLocked?"Ngày đã khóa":"Lưu tồn cuối ngày")),
      h("div",{className:"overflow-x-auto"},h("table",{className:"w-full min-w-[900px] text-sm"},
        h("thead",{className:"bg-emerald-950 text-left text-white"},h("tr",{},...["Mã","Bán thành phẩm","Đơn vị","Đã dùng theo món","Nguyên liệu gốc","Quy đổi tồn nguyên liệu gốc","Tồn cuối ngày"].map((label)=>h("th",{key:label,className:"px-4 py-3 last:text-right"},label)))),
        h("tbody",{className:"divide-y"},...paged.items.map((item)=>{const actual=Math.max(0,Number((values[item.ingredientId]??"0").replace(",","."))||0);return h("tr",{key:item.ingredientId,className:"hover:bg-emerald-50/40"},h("td",{className:"px-4 py-3 font-bold text-emerald-800"},item.ingredientCode),h("td",{className:"px-4 py-3 font-semibold"},item.ingredientName),h("td",{className:"px-4 py-3"},item.unit||"—"),h("td",{className:"px-4 py-3 text-right"},qty(item.usedQuantity)),h("td",{className:"px-4 py-3"},...item.components.map((component)=>h("p",{key:component.ingredientId},`${component.ingredientName} (${component.unit})`))),h("td",{className:"px-4 py-3 text-right font-semibold"},...item.components.map((component)=>h("p",{key:component.ingredientId},`${qty(actual*component.conversionFactor)} ${component.unit}`))),h("td",{className:"px-4 py-2 text-right"},h("input",{disabled:loading||data?.isLocked,inputMode:"decimal",value:values[item.ingredientId]??"",onChange:(event:any)=>setValues({...values,[item.ingredientId]:event.target.value}),className:"h-10 w-32 rounded-lg border px-3 text-right font-bold disabled:bg-slate-100 disabled:text-slate-500"})))})))),
      items.length===0?h("div",{className:"p-14 text-center text-slate-500"},h(FlaskConical,{className:"mx-auto mb-2 text-slate-300"}),"Chưa có bán thành phẩm. Hãy đánh dấu ‘Đây là bán thành phẩm’ tại trang Nguyên liệu."):null,h(InventoryPagination,{page:paged.pagination.currentPage,pageSize,total:items.length,onPageChange:setPage,onPageSizeChange:setPageSize,disabled:loading||saving})),
    h("dialog",{ref:transferDialog,"aria-labelledby":"prepared-transfer-title",onCancel:(event:any)=>{event.preventDefault();if(!saving)setTransferOpen(false)},onClose:()=>setTransferOpen(false),className:"m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"},
      h("form",{onSubmit:(event:any)=>{event.preventDefault();if(transferItem&&destination&&Number(transferQuantity.replace(",","."))>0&&to===inventoryToday())void transfer()},className:"space-y-4 p-5 sm:p-6"},
      h("div",{className:"flex items-start justify-between gap-4"},h("h3",{id:"prepared-transfer-title",className:"text-lg font-bold text-emerald-950"},"Xuất bán thành phẩm sang quầy khác"),h("button",{type:"button",disabled:saving,"aria-label":"Đóng",onClick:()=>setTransferOpen(false),className:"rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"},h(X,{className:"h-5 w-5"}))),
      h("p",{className:"text-sm text-slate-500"},"Trừ tồn quầy xuất, cộng tồn quầy nhận theo mã và đơn vị. Xem giao dịch tại Lịch sử kho của hai quầy."),
      error?h("div",{role:"alert",className:"rounded-lg bg-rose-50 p-3 text-sm text-rose-700"},error):null,
      h("fieldset",{disabled:saving||loading||to!==inventoryToday(),className:"grid gap-4 sm:grid-cols-2 disabled:opacity-50"},
        h("label",{className:"min-w-0 text-sm font-semibold sm:col-span-2"},"Bán thành phẩm",h("select",{required:true,value:transferItem,onChange:(e:any)=>setTransferItem(e.target.value),className:"mt-1 block h-11 w-full min-w-0 rounded-lg border px-3 font-normal"},h("option",{value:""},"Chọn bán thành phẩm"),...(data?.items??[]).map(item=>h("option",{key:item.ingredientId,value:item.ingredientId},`${item.ingredientCode} · ${item.ingredientName} (tồn ${qty(item.currentQuantity)} ${item.unit})`)))),
        h("label",{className:"min-w-0 text-sm font-semibold"},"Quầy nhận",h("select",{required:true,value:destination,onChange:(e:any)=>setDestination(e.target.value),className:"mt-1 block h-11 w-full rounded-lg border px-3 font-normal"},h("option",{value:""},"Chọn quầy nhận"),...activeStores.filter(store=>store.id!==storeId&&store.id!=="warehouse").map(store=>h("option",{key:store.id,value:store.id},store.name)))),
        h("label",{className:"text-sm font-semibold"},"Số lượng xuất",h("input",{required:true,value:transferQuantity,inputMode:"decimal",onChange:(e:any)=>setTransferQuantity(e.target.value),className:"mt-1 block h-11 w-full rounded-lg border px-3 font-normal"})),
        h("label",{className:"text-sm font-semibold sm:col-span-2"},"Ghi chú",h("input",{value:transferNote,onChange:(e:any)=>setTransferNote(e.target.value),className:"mt-1 block h-11 w-full rounded-lg border px-3 font-normal"}))),
      to!==inventoryToday()?h("p",{className:"text-sm text-amber-700"},"Chọn ngày hôm nay để xuất bán thành phẩm."):null,
      h("div",{className:"flex justify-end gap-3 border-t pt-4"},h("button",{type:"button",disabled:saving,onClick:()=>setTransferOpen(false),className:"h-11 rounded-lg border px-5 font-semibold disabled:opacity-50"},"Đóng"),h("button",{type:"submit",disabled:saving||loading||to!==inventoryToday()||!transferItem||!destination||!(Number(transferQuantity.replace(",","."))>0),className:"h-11 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:opacity-50"},saving?"Đang xử lý...":"Xuất sang quầy")))),
    data?.latestCountDate?h("p",{className:"text-sm text-slate-500"},`Lần chốt gần nhất: ${data.latestCountDate}`):null);
}
