import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { applyInternalInvoiceImport, type InternalImportPreviewRow } from "@/services/invoiceEntryService";
type Action="skip"|"create"|"category"|"update";
type Choice={action:Action;targetId:string;operationId:string;done?:boolean;error?:string};
const labels={new:"Mới",existing:"Đã có",category:"Bổ sung phân loại",changed:"Có thay đổi",ambiguous:"Chưa xác định"};
const money=(n:number)=>n.toLocaleString("vi-VN",{maximumFractionDigits:2});
export default function InternalInvoiceImportPreview({rows,fileName,skipped,onClose,onSaved}:{rows:InternalImportPreviewRow[];fileName:string;skipped:number;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [choices,setChoices]=useState<Choice[]>(()=>rows.map(row=>({action:row.status==="new"?"create":row.status==="category"?"category":"skip",targetId:row.candidates.length===1?row.candidates[0].id:"",operationId:crypto.randomUUID()})));
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const change=(index:number,patch:Partial<Choice>)=>setChoices(all=>all.map((c,i)=>i===index?{...c,...patch,operationId:crypto.randomUUID(),error:undefined}:c));
  const selected=choices.filter(c=>!c.done&&c.action!=="skip").length;
  const apply=async()=>{
    const extra=choices.filter((c,i)=>!c.done&&c.action==="create"&&rows[i].status!=="new").length;
    const updates=choices.filter(c=>!c.done&&c.action==="update").length;
    if ((extra||updates) && !confirm(`Bạn chọn cập nhật ${updates} bill và tạo riêng ${extra} bill có dữ liệu tương tự. Cập nhật sẽ thay toàn bộ dòng hàng của bill được chọn bằng dòng Excel đang xem. Tiếp tục?`)) return;
    setBusy(true);setMessage("");let saved=0,failed=0;
    try {
      for(let index=0;index<rows.length;index++) {
        const row=rows[index],choice=choices[index];
        if(choice.done||choice.action==="skip")continue;
        const candidate=row.candidates.find(c=>c.id===choice.targetId);
        if(choice.action!=="create"&&!candidate){setChoices(all=>all.map((c,i)=>i===index?{...c,error:"Chọn bill cần đối chiếu trước."}:c));failed++;continue;}
        try {
          await applyInternalInvoiceImport({operationId:choice.operationId,action:choice.action,incoming:row.incoming,targetId:candidate?.id,expectedVersion:candidate?.version,forceNew:choice.action==="create"&&row.status!=="new"});
          saved++;setChoices(all=>all.map((c,i)=>i===index?{...c,done:true,error:undefined}:c));
        } catch(e){failed++;setChoices(all=>all.map((c,i)=>i===index?{...c,error:e instanceof Error?e.message:"Không lưu được dòng này."}:c));}
      }
      setMessage(`Đã lưu ${saved} dòng. ${failed?`${failed} dòng chưa lưu; xem lỗi bên dưới. Đóng và chọn lại file để đối chiếu lại nếu bill đã thay đổi.`:"Các dòng bỏ qua được giữ nguyên."}`);
    } finally {try{await onSaved()}finally{setBusy(false)}}
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"><section role="dialog" aria-modal="true" aria-labelledby="internal-import-title" className="flex max-h-[94vh] w-full max-w-7xl flex-col rounded-xl bg-white shadow-xl">
    <header className="flex items-start justify-between gap-4 border-b p-4"><div><h2 id="internal-import-title" className="text-lg font-bold">Đối chiếu import hóa đơn nội bộ</h2><p className="mt-1 text-sm text-slate-500">{fileName} · {rows.length} dòng · {skipped} dòng không hợp lệ đã bỏ qua</p><p className="mt-1 text-sm text-emerald-800">Bổ sung phân loại giữ nguyên số lượng, tiền và minh chứng. Bill có thay đổi chỉ cập nhật khi bạn chọn.</p></div><Button variant="ghost" disabled={busy} onClick={onClose}>Đóng</Button></header>
    <div className="overflow-auto p-3"><table className="w-full min-w-[1000px] text-sm"><thead className="sticky top-0 bg-slate-100 text-left"><tr>{["Dòng Excel","Dữ liệu nhập","Trạng thái","Bill cũ / đối chiếu","Thao tác"].map(x=><th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row,index)=>{const choice=choices[index];const candidate=row.candidates.find(c=>c.id===choice.targetId);return <tr key={index} className="align-top"><td className="px-3 py-3 text-slate-500">{row.incoming.sourceSheetName}<br/>Dòng {row.incoming.sourceRowNumber}<br/>{row.incoming.invoiceDate}</td><td className="px-3 py-3">{row.incoming.items.map((item,i)=><div key={i} className="mb-2"><b>{item.name}</b><p>{money(item.quantity)} {item.unit} × {money(item.unitPrice)} ₫</p><small className="text-emerald-700">{item.categoryName || "Chưa phân loại"}</small></div>)}</td><td className="px-3 py-3 font-semibold">{choice.done?"Đã lưu":labels[row.status]}</td><td className="max-w-sm px-3 py-3">{row.candidates.length>0?<><select aria-label={`Bill đối chiếu dòng ${index+1}`} disabled={busy||choice.done} value={choice.targetId} onChange={e=>change(index,{targetId:e.target.value})} className="mb-2 h-9 w-full rounded border bg-white px-2"><option value="">Chọn bill để đối chiếu...</option>{row.candidates.map(c=><option key={c.id} value={c.id}>{c.invoiceDate} · {c.invoiceNumber || c.id} · {money(c.totalAmount)} ₫</option>)}</select>{candidate&&<div className="rounded bg-slate-50 p-2"><p className="mb-1 text-xs text-slate-500">{candidate.partnerName || "Chưa có người bán"}</p>{candidate.items.map((item,i)=><p key={i} className="mb-1">{item.name}: {money(item.quantity)} {item.unit} × {money(item.unitPrice)} ₫ <small className="text-slate-500">({item.categoryName || "Chưa phân loại"})</small></p>)}</div>}</>:<span className="text-slate-400">Chưa tìm thấy bill tương ứng.</span>}</td><td className="px-3 py-3"><select aria-label={`Thao tác dòng ${index+1}`} disabled={busy||choice.done} value={choice.action} onChange={e=>change(index,{action:e.target.value as Action})} className="h-9 max-w-56 rounded border bg-white px-2"><option value="skip">Bỏ qua</option><option value="create">{row.status==="new"?"Tạo bill mới":"Tạo thêm bill riêng"}</option>{row.status==="category"&&<option value="category">Chỉ bổ sung phân loại</option>}{row.candidates.length>0&&<option value="update">Cập nhật bill đã chọn</option>}</select>{choice.error&&<p role="alert" className="mt-2 max-w-56 text-xs text-rose-700">{choice.error}</p>}</td></tr>})}</tbody></table></div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><p aria-live="polite" className="text-sm text-slate-600">{message||`Sẽ xử lý ${selected} dòng theo lựa chọn. Các dòng còn lại giữ nguyên.`}</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Đóng</Button><Button disabled={busy||!selected} onClick={()=>void apply()}>{busy?"Đang xử lý...":`Lưu ${selected} dòng đã chọn`}</Button></div></footer>
  </section></div>
}
