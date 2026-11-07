import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/Input";
import { searchInternalInvoicePartners } from "@/services/invoiceEntryService";

export default function InternalInvoicePartnerInput({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const id=useId();
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(-1);
  useEffect(()=>{
    if(!open)return;
    let active=true;setLoading(true);setItems([]);setSelected(-1);
    const timer=setTimeout(()=>searchInternalInvoicePartners(value).then(result=>{if(active){setItems(result.items);setError("");}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Không tải được người bán cũ.");}).finally(()=>{if(active)setLoading(false);}),200);
    return()=>{active=false;clearTimeout(timer)};
  },[value,open]);
  const choose=(name:string)=>{onChange(name);setOpen(false);setSelected(-1)};
  return <div className="relative" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false)}}>
    <Input label="Đơn vị / người bán" value={value} placeholder="Nhập hoặc tìm người bán cũ..." autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={selected>=0?`${id}-${selected}`:undefined}
      onFocus={()=>setOpen(true)} onChange={e=>{onChange(e.target.value);setOpen(true)}} onKeyDown={e=>{
        if(e.key==="Escape"){setOpen(false);setSelected(-1);}
        if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);setSelected(i=>Math.min(i+1,items.length-1));}
        if(e.key==="ArrowUp"){e.preventDefault();setSelected(i=>Math.max(i-1,-1));}
        if(e.key==="Enter" && open && selected>=0 && items[selected]){e.preventDefault();choose(items[selected]);}
      }}/>
    {open && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
      <ul id={id} role="listbox" aria-label="Người bán đã nhập">
        {items.map((name,index)=><li id={`${id}-${index}`} role="option" aria-selected={selected===index} key={name} className={`cursor-pointer px-3 py-2 text-sm hover:bg-emerald-50 ${selected===index?'bg-emerald-50':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(name)}>{name}</li>)}
      </ul>
      {loading?<p className="p-3 text-xs text-slate-500" role="status">Đang tìm người bán...</p>:!items.length && !error?<p className="p-3 text-xs text-slate-500">Chưa có người bán phù hợp. Bạn có thể nhập tên mới.</p>:null}
      {error && <p role="alert" className="p-3 text-xs text-rose-700">{error} Bạn vẫn có thể nhập tên trực tiếp.</p>}
    </div>}
  </div>;
}
