import { useEffect, useState } from "react";
import { getInternalInvoiceWarehouse, type InternalInvoiceWarehouseResponse } from "@/services/invoiceEntryService";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
export default function InternalInvoiceWarehouse({revision}:{revision:number}) {
  const [search,setSearch]=useState(""); const [category,setCategory]=useState(""); const [page,setPage]=useState(1);
  const [data,setData]=useState<InternalInvoiceWarehouseResponse|null>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(false); const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);const timer=setTimeout(()=>getInternalInvoiceWarehouse(search,category,page).then(result=>{if(active){setData(result);setError("");}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)}),200);return()=>{active=false;clearTimeout(timer)}},[search,category,page,revision,retry]);
  return <section className="space-y-4 rounded-xl border bg-white p-4 sm:p-5">
    <div><h2 className="text-xl font-bold text-emerald-950">Kho nội bộ</h2><p className="mt-1 text-sm text-slate-500">Tổng số lượng đã nhập từ hóa đơn nội bộ, gồm cả hóa đơn cũ. Các đơn vị tính được tổng hợp riêng.</p></div>
    <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-[1_1_260px]"><Input aria-label="Tìm vật tư kho nội bộ" placeholder="Tìm tên vật tư..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} className="w-full"/></div><select aria-label="Lọc loại hàng" className="h-10 rounded-md border bg-white px-3 text-sm" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">Tất cả loại hàng</option><option value="uncategorized">Chưa phân loại</option>{data?.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><Button variant="outline" onClick={()=>setRetry(x=>x+1)}>Tải lại</Button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="overflow-x-auto" aria-busy={loading}><table className="w-full min-w-[540px] text-sm"><thead className="bg-slate-50 text-left"><tr>{["Vật tư","Loại hàng","Đơn vị tính","Tổng đã nhập"].map(label=><th className="px-3 py-3 last:text-right" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{loading?<tr><td colSpan={4} className="p-8 text-center text-slate-500">Đang tải kho nội bộ...</td></tr>:!error && !data?.items.length?<tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có vật tư phù hợp.</td></tr>:!error && data?.items.map((item,index)=><tr key={index}><td className="px-3 py-3 font-semibold">{item.name}</td><td className="px-3 py-3">{item.categoryName || "Chưa phân loại"}</td><td className="px-3 py-3">{item.unit || "—"}</td><td className="px-3 py-3 text-right font-bold text-emerald-800">{item.totalReceived.toLocaleString("vi-VN",{maximumFractionDigits:3})}</td></tr>)}</tbody></table></div>
    {data && <Pagination currentPage={data.pagination.page} totalItems={data.pagination.total} pageSize={data.pagination.limit} onPageChange={setPage} disabled={loading}/>}
  </section>
}
