import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { syncInternalInvoiceSheet, type InternalInvoiceSheetStatus } from "@/services/invoiceEntryService";

export default function InternalInvoiceSheetSync({onSynced}:{onSynced:()=>void}) {
  const [status,setStatus]=useState<InternalInvoiceSheetStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const callback=useRef(onSynced);callback.current=onSynced;
  const running=useRef(false);
  const mounted=useRef(true);
  const run=async(automatic=false)=>{
    if(running.current)return;running.current=true;setBusy(true);setError("");
    try {
      const result=await syncInternalInvoiceSheet(automatic);
      if(!mounted.current)return;
      setStatus(result);
      if(result.result && (result.result.created || result.result.updated))callback.current();
    } catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Không đồng bộ được Google Sheet.");}
    finally{running.current=false;if(mounted.current)setBusy(false);}
  };
  useEffect(()=>{
    mounted.current=true;
    void run(true);
    const timer=setInterval(()=>{if(document.visibilityState==="visible")void run(true);},300000);
    return()=>{mounted.current=false;clearInterval(timer)};
  },[]);
  return <section className="rounded-xl border border-emerald-100 bg-white p-4" aria-label="Đồng bộ Google Sheet">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-emerald-950">Nhập hóa đơn từ Google Sheet</h2><p className="mt-1 text-sm text-slate-600">Gom các dòng cùng ngày và link bill. Nguồn cung là người bán; link bill được gắn vào minh chứng.</p></div>
      <div className="flex items-center gap-3"><a className="text-sm font-medium text-emerald-700 underline" href={status?.spreadsheetUrl || "https://docs.google.com/spreadsheets/d/1XwdmXbGZwXo3-cSPg-WgzkrcJ_HfCQ1aD1bP2xNDIdY/edit"} target="_blank" rel="noreferrer">Mở Sheet</a><Button variant="outline" isLoading={busy} onClick={()=>void run()}>Đồng bộ ngay</Button></div>
    </div>
    <p className="mt-2 text-xs text-slate-500">Tự kiểm tra mỗi 5 phút khi mở trang. Đọc các tab trong “Danh sách tuần”; điền đủ ngày, vật tư, số lượng, nguồn cung, đơn giá và link bill.</p>
    {status?.lastAttemptAt && <p className="mt-2 text-xs text-slate-500">Lần kiểm tra: {new Date(status.lastAttemptAt*1000).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}{status.lastSyncedAt ? ` · Lần hoàn tất: ${new Date(status.lastSyncedAt*1000).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`:""}</p>}
    {status?.result && <p className="mt-2 text-sm" role="status">{status.result.tabs} tab · {status.result.created} hóa đơn mới · {status.result.updated} cập nhật · {status.result.unchanged} không đổi</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    {!!status?.result?.errors.length && <details className="mt-2 text-sm text-rose-700" open><summary className="cursor-pointer font-medium">Có {status.result.errors.length} lỗi cần kiểm tra; các bill lỗi được giữ nguyên</summary><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5">{status.result.errors.map((message,i)=><li key={i}>{message}</li>)}</ul></details>}
  </section>;
}
