import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/Input";
import { createInternalInvoiceCategory, searchInternalInvoiceMaterials, type InternalInvoiceCategory, type InternalInvoiceMaterial } from "@/services/invoiceEntryService";
import type { InternalInvoiceDraftRow } from "@/lib/internalInvoiceDraft";

export default function InternalInvoiceMaterialInput({row,onChange,kind}:{row:InternalInvoiceDraftRow;onChange:(patch:Partial<InternalInvoiceDraftRow>)=>void;kind:"material"|"category"}) {
  const id=useId();
  const [open,setOpen]=useState(false);
  const [materials,setMaterials]=useState<InternalInvoiceMaterial[]>([]);
  const [categories,setCategories]=useState<InternalInvoiceCategory[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const query=kind==="material"?row.name:row.categoryName || "";
  useEffect(()=>{
    if(!open) return;
    let active=true;
    const timer=setTimeout(()=>searchInternalInvoiceMaterials(kind==="material"?query:"").then(data=>{if(active){setMaterials(data.items);setCategories(data.categories);setError("");}}).catch(e=>{if(active)setError(e.message);}),200);
    return ()=>{active=false;clearTimeout(timer)};
  },[query,open,kind]);
  const choose=(material:InternalInvoiceMaterial)=>{
    onChange({name:material.name,unit:material.unit || "",unitPrice:String(material.unitPrice),categoryId:material.categoryId,categoryName:material.categoryName || ""});setOpen(false);
  };
  const filtered=categories.filter(c=>c.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const create=async()=>{setBusy(true);setError("");try{const c=await createInternalInvoiceCategory(query);onChange({categoryId:Number(c.id),categoryName:c.name});setCategories(previous=>[...previous.filter(x=>Number(x.id)!==Number(c.id)),c]);setOpen(false);}catch(e){setError(e instanceof Error?e.message:"Không tạo được loại hàng.");}finally{setBusy(false)}};
  return <div className="min-w-40" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node | null))setOpen(false)}}>
    <Input aria-label={kind==="material"?"Tên vật tư":"Loại hàng"} className="h-8 px-2" value={query} onFocus={()=>setOpen(true)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false)}} onChange={e=>{onChange(kind==="material"?{name:e.target.value}:{categoryName:e.target.value,categoryId:null});setOpen(true)}} placeholder={kind==="material"?"Nhập hoặc tìm vật tư...":"Chọn hoặc tạo loại..."} aria-expanded={open} aria-controls={id}/>
    {open && <div id={id} className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-white text-xs shadow-sm">
      {kind==="material"?materials.map((m,index)=><button type="button" key={index} className="block w-full px-2 py-2 text-left hover:bg-emerald-50 focus:bg-emerald-50" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(m)}>{m.name}<small className="ml-1 text-slate-500">{m.unit} · {m.categoryName || "Chưa phân loại"} · {m.unitPrice.toLocaleString("vi-VN")} ₫</small></button>):<>
        {filtered.map(c=><button type="button" key={c.id} className="block w-full px-2 py-2 text-left hover:bg-emerald-50" onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange({categoryId:Number(c.id),categoryName:c.name});setOpen(false)}}>{c.name}</button>)}
        {query.trim() && !categories.some(c=>c.name.toLocaleLowerCase("vi")===query.trim().toLocaleLowerCase("vi")) && <button type="button" disabled={busy} className="block w-full px-2 py-2 text-left font-semibold text-emerald-700" onMouseDown={e=>e.preventDefault()} onClick={()=>void create()}>{busy?"Đang tạo...":`+ Tạo loại “${query.trim()}”`}</button>}
      </>}
      {kind==="material" && !materials.length && <p className="p-2 text-slate-500">Chưa có vật tư phù hợp. Nhập tên để tạo khi lưu phiếu.</p>}
    </div>}
    {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
  </div>;
}
