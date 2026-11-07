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
  const errorCount=(status?.result?.errors.length || 0)+(error?1:0);
  return <section className="rounded-xl border border-emerald-100 bg-white px-4 py-3" aria-label="Đồng bộ Google Sheet">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div><h2 className="text-sm font-semibold text-emerald-950">Đồng bộ Google Sheet</h2>
        <p className="mt-0.5 text-xs text-slate-500" role="status">{busy?"Đang đồng bộ…":status?.result?`${status.result.created} mới · ${status.result.updated} cập nhật · ${status.result.unchanged} không đổi`:"Tự kiểm tra mỗi 5 phút"}{!busy && status?.lastAttemptAt ? ` · ${new Date(status.lastAttemptAt*1000).toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"})}`:""}</p>
      </div>
      <div className="flex items-center gap-3"><a className="text-sm font-medium text-emerald-700 underline" href={status?.spreadsheetUrl || "https://docs.google.com/spreadsheets/d/1XwdmXbGZwXo3-cSPg-WgzkrcJ_HfCQ1aD1bP2xNDIdY/edit"} target="_blank" rel="noreferrer">Mở Sheet</a><Button variant="outline" isLoading={busy} onClick={()=>void run()}>Đồng bộ ngay</Button></div>
    </div>
    <details className="mt-2 text-xs text-slate-500">
      <summary className={`cursor-pointer ${errorCount?'font-medium text-rose-700':''}`}>{errorCount?`${errorCount} lỗi cần kiểm tra`:'Chi tiết đồng bộ'}</summary>
      <p className="mt-2">Tự kiểm tra mỗi 5 phút khi mở trang, đọc các tab trong “Danh sách tuần”. Link bill không bắt buộc; có link thì gắn vào minh chứng. Không có link thì gom cùng ngày và người bán trong từng tab.</p>
      {status?.lastAttemptAt && <p className="mt-1">Lần kiểm tra: {new Date(status.lastAttemptAt*1000).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})} · {status.result?.tabs || 0} tab</p>}
      {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
      {!!status?.result?.errors.length && <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-rose-700">{status.result.errors.map((message,i)=><li key={i}>{message}</li>)}</ul>}
    </details>
  </section>;
}
