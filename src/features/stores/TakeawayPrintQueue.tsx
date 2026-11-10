import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Job = { id: string; billId: string; kind: 'receipt'|'label'; status: string; error: string; document: { item?: { name: string }; labelNumber?: number } };
const statuses: Record<string,string> = { pending:'Chờ laptop', printing:'Đang gửi tới máy in', printed:'Đã gửi máy in', failed:'Lỗi', uncertain:'Cần kiểm tra bản in' };

export default function TakeawayPrintQueue({ storeId }: { storeId: string }) {
  const [open,setOpen]=useState(false);
  const [jobs,setJobs]=useState<Job[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [offset,setOffset]=useState(0);
  const [billId,setBillId]=useState('');
  const query=`storeId=${encodeURIComponent(storeId)}&offset=${offset}&billId=${encodeURIComponent(billId.trim())}`;
  useEffect(()=>{
    const show=(event:Event)=>{setOpen(true);setOffset(0);setBillId((event as CustomEvent<string>).detail || '');};
    const queued=()=>setMessage('Đã lưu bill và xếp hàng in hóa đơn, tem tại laptop.');
    window.addEventListener('takeaway-print-queue',show);
    window.addEventListener('takeaway-print-queued',queued);
    return()=>{window.removeEventListener('takeaway-print-queue',show);window.removeEventListener('takeaway-print-queued',queued);};
  },[]);
  useEffect(()=>{
    if(!open) return;
    let active=true;
    const load=()=>apiRequest<{items:Job[]}>(`/takeaway-print-jobs.php?${query}`).then(d=>{if(active){setJobs(d.items);setError('');}}).catch(e=>{if(active)setError(e.message);});
    void load(); const timer=window.setInterval(load,3000);
    return()=>{active=false;window.clearInterval(timer);};
  },[open,query]);
  async function act(job:Job) {
    if(busy) return;
    if(!window.confirm(`Kiểm tra bản in trước khi ${job.status==='printed'?'in thêm bản':'thử lại'}. Chỉ xử lý ${job.kind==='receipt'?'hóa đơn':'tem này'}?`)) return;
    setBusy(true);
    try {
      await apiRequest('/takeaway-print-jobs.php',{method:'POST',body:JSON.stringify({storeId,id:job.id,action:job.status==='printed'?'reprint':'retry',requestId:crypto.randomUUID()})});
      const data=await apiRequest<{items:Job[]}>(`/takeaway-print-jobs.php?${query}`);setJobs(data.items);setError('');
    } catch(e) {setError(e instanceof Error?e.message:'Không cập nhật được lệnh in.');} finally {setBusy(false);}
  }
  return <section className="border-b bg-emerald-50 px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><span>{message || 'Hóa đơn và tem được in qua laptop của quầy.'}</span><button type="button" className="rounded border border-emerald-700 px-3 py-2 font-semibold text-emerald-900" onClick={()=>setOpen(!open)}>{open?'Đóng hàng đợi':'Hàng đợi in bill / tem'}</button></div>
    {open && <div className="mt-3 flex flex-wrap items-center gap-2"><input aria-label="Tìm lệnh theo mã bill" placeholder="Mã bill (để trống xem tất cả)" value={billId} onChange={e=>{setBillId(e.target.value);setOffset(0);setJobs([]);}} className="rounded border p-2" /><button disabled={offset===0} onClick={()=>{setOffset(Math.max(0,offset-200));setJobs([]);}} className="rounded border p-2 disabled:opacity-40">Trang trước</button><span>Trang {offset/200+1}</span><button disabled={jobs.length<200} onClick={()=>{setOffset(offset+200);setJobs([]);}} className="rounded border p-2 disabled:opacity-40">Trang sau</button></div>}
    {open && <div className="mt-3 max-h-80 overflow-auto"><p className="mb-2 text-xs">Laptop phải mở chương trình Takeaway Print Helper. “Đã gửi máy in” không xác nhận giấy đã in ra. Kiểm tra giấy trước khi in lại.</p>{error && <p role="alert" className="text-red-700">{error}</p>}{jobs.length===0 && <p>Chưa có lệnh in.</p>}{jobs.map(job=><div key={job.id} className="flex items-center justify-between gap-3 border-t border-emerald-200 py-2"><div><strong>{job.billId}</strong> · {job.kind==='receipt'?'Hóa đơn':`Tem ${job.document.labelNumber || ''}: ${job.document.item?.name || ''}`}<div>{statuses[job.status] || job.status}</div>{job.error && <p className="text-red-700">{job.error}</p>}</div>{['failed','uncertain','printed'].includes(job.status) && <button type="button" disabled={busy} onClick={()=>void act(job)} className="shrink-0 rounded border bg-white px-3 py-2 disabled:opacity-40">{job.status==='printed'?'In thêm bản':'Thử lại'}</button>}</div>)}</div>}
  </section>;
}
