import {useAuth} from '@/context/AuthContext';
import {hasPermission} from '@/lib/permissions';
import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useStore} from '@/context/StoreContext';
import RoleGuard from '@/components/RoleGuard';
import {getIngredients,type Ingredient} from '@/services/ingredients';
import {getAllInventoryChecks,saveInventoryCheck,deleteInventoryCheck,type InventoryCheck} from '@/services/inventoryCheckService';
import {inventoryToday} from '@/lib/inventoryPeriods';
import {normalizeSearchText} from '@/lib/utils';
type Line={productCode:string;productName:string;systemQuantity:number;actualQuantity:string;note:string;resolutionType:'adjustment'|'missing_receipt'|'missing_issue';unit:string;factor:number};
const qty=(n:number)=>n.toLocaleString('vi-VN',{maximumFractionDigits:3});
const time=(s:string)=>s?s.replace('T',' ').slice(0,19):'—';
export default function InventoryChecksPage(){
 const {storeId}=useStore();const {user}=useAuth();
 const canCreate=hasPermission(user,'inventory_checks.create');
 const canUpdate=hasPermission(user,'inventory_checks.update');
 const canComplete=hasPermission(user,'inventory_checks.complete');
 const canDelete=hasPermission(user,'inventory_checks.delete');
 const [checks,setChecks]=useState<InventoryCheck[]>([]);const [products,setProducts]=useState<Ingredient[]>([]);
 const [selected,setSelected]=useState<InventoryCheck|null>(null);const [editing,setEditing]=useState(false);
 const [lines,setLines]=useState<Line[]>([]);const [date,setDate]=useState(inventoryToday);const [note,setNote]=useState('');
 const loadSequence=useRef(0);const currentStore=useRef(storeId);currentStore.current=storeId;
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [filter,setFilter]=useState('all');
 async function load(){const sequence=++loadSequence.current;setLoading(true);try{const [p,c]=await Promise.all([getIngredients(storeId,'','stock'),getAllInventoryChecks(storeId)]);if(sequence!==loadSequence.current)return;setProducts(p.items.filter(i=>i.isActive));setChecks(c.filter(i=>!i.checkCode.startsWith("DC-")&&!i.checkCode.startsWith("XN-")));}catch(e){if(sequence===loadSequence.current)setError(e instanceof Error?e.message:'Không thể tải kiểm kho');}finally{if(sequence===loadSequence.current)setLoading(false)}}
 useEffect(()=>{setEditing(false);setSelected(null);setLines([]);setProducts([]);setChecks([]);setError('');void load();return()=>{loadSequence.current++}},[storeId]);
 const finalized=selected?.status==='completed'||selected?.status==='cancelled';
 const canEdit=selected?canUpdate:canCreate;
 const readonly=finalized||!canEdit;
 function open(check:InventoryCheck){setSelected(check);setDate(check.checkDate);setNote(check.note);setLines(check.items.map(i=>{const p=products.find(p=>p.ingredientCode===i.productCode);const factor=p?.purchaseToBaseFactor||1;return {productCode:i.productCode,productName:i.productName,systemQuantity:i.systemQuantity,actualQuantity:i.actualQuantity===null?'':String(i.actualQuantity/factor),note:i.note||'',resolutionType:i.resolutionType||'adjustment',unit:p?.purchaseUnit||p?.unit||'',factor}}));setEditing(true);setFilter('all');setError('')}
 function create(){if(!canCreate)return;if(editing&&!readonly&&!window.confirm('Rời đợt đang nhập? Hãy lưu nháp trước nếu cần giữ dữ liệu.'))return;setSelected(null);setDate(inventoryToday());setNote('');setLines(products.map(p=>({productCode:p.ingredientCode,productName:p.ingredientName,systemQuantity:p.stockQuantity,actualQuantity:'',note:'',resolutionType:'adjustment' as const,unit:p.purchaseUnit||p.unit,factor:p.purchaseToBaseFactor||1})));setEditing(true);setError('');setFilter('all')}
 function change(code:string,patch:Partial<Line>){if(readonly)return;setLines(v=>v.map(i=>i.productCode===code?{...i,...patch}:i))}
 async function reconcile(){
  if(readonly||loading||saving)return;
  const targetStore=storeId;setSaving(true);setError('');
  try{const result=await getIngredients(targetStore,'','stock');if(currentStore.current!==targetStore)return;
   const current=new Map(result.items.map(p=>[p.ingredientCode,p.stockQuantity]));
   if(lines.some(i=>!current.has(i.productCode)))throw new Error('Có mặt hàng không còn trong kho. Vui lòng kiểm tra trước khi đối chiếu.');
   setLines(previous=>previous.map(i=>({...i,systemQuantity:current.get(i.productCode)!})));
  }catch(e){if(currentStore.current===targetStore)setError(e instanceof Error?e.message:'Không thể cập nhật tồn máy')}finally{setSaving(false)}
 }
 function resolutionSelect(i:Line){return <select aria-label={'Xử lý '+i.productName} value={i.resolutionType} disabled={readonly||saving||loading} onChange={e=>change(i.productCode,{resolutionType:e.target.value as Line['resolutionType']})} className="my-1 w-full"><option value="adjustment">Đã đối chiếu / chênh lệch thực tế</option><option value="missing_receipt">Thiếu phiếu nhập — chờ bổ sung</option><option value="missing_issue">Thiếu phiếu xuất — chờ bổ sung</option></select>}
 async function save(complete:boolean){
  if(saving||loading||finalized||(!selected&&!canCreate)||(complete?!canComplete:!canEdit))return;setError('');
  if(complete&&lines.some(i=>i.resolutionType!=='adjustment')){setError('Cần bổ sung phiếu nhập/xuất, cập nhật tồn máy và xác nhận đã đối chiếu trước khi chốt.');return}
  for(const i of lines){if(i.actualQuantity!==''&&(!Number.isFinite(Number(i.actualQuantity))||Number(i.actualQuantity)<0)){setError('Số tồn thực không hợp lệ: '+i.productName);return}if(complete&&(i.actualQuantity===''||(Math.abs(Number(i.actualQuantity)*i.factor-i.systemQuantity)>=0.0005&&!i.note.trim()))){setError('Nhập đủ số tồn thực và giải trình chênh lệch: '+i.productName);return}}
  if(complete&&!window.confirm('Xác nhận chốt đợt kiểm kho? Tồn kho sẽ được cập nhật theo số tồn thực. Đợt đã chốt không thể sửa.'))return;
  setSaving(true);try{const saved=await saveInventoryCheck({id:selected?.id,storeId,checkDate:date,status:complete?'completed':'draft',note,items:lines.map(i=>({productCode:i.productCode,systemQuantity:i.systemQuantity,actualQuantity:i.actualQuantity===''?null:Number(i.actualQuantity)*i.factor,note:i.note,resolutionType:i.resolutionType}))});if(currentStore.current!==storeId)return;await load();if(currentStore.current===storeId)open(saved);}catch(e){setError(e instanceof Error?e.message:'Không thể lưu đợt kiểm kho')}finally{setSaving(false)}
 }
 async function removeDraft(check:InventoryCheck){
  if(!canDelete||check.status!=='draft'||saving||loading)return;
  if(!window.confirm('Xác nhận xoá bản nháp '+check.checkCode+'?'))return;
  const targetStore=storeId;setSaving(true);setError('');
  try{await deleteInventoryCheck(check.id);if(currentStore.current!==targetStore)return;if(selected?.id===check.id){setEditing(false);setSelected(null);setLines([])}await load()}catch(e){if(currentStore.current===targetStore)setError(e instanceof Error?e.message:'Không thể xoá bản nháp')}finally{setSaving(false)}
 }
 const visibleLines=lines.filter(i=>filter==='all'||(filter==='unchecked'?i.actualQuantity==='':i.actualQuantity!==''&&(filter==='variance'?Math.abs(Number(i.actualQuantity)*i.factor-i.systemQuantity)>=0.0005:Math.abs(Number(i.actualQuantity)*i.factor-i.systemQuantity)<0.0005)));
 const list=checks.filter(c=>(!status||c.status===status)&&(!from||c.checkDate>=from)&&(!to||c.checkDate<=to)&&normalizeSearchText(c.checkCode+' '+c.note+' '+c.createdBy).includes(normalizeSearchText(search)));
 return <RoleGuard permission="inventory_checks.access"><main className="warehouse-ui min-w-0 mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><Link to="/admin/inventory?tab=stock" className="text-emerald-800">← Tồn kho</Link><h1 className="text-2xl font-black text-emerald-950">Quản lý các đợt kiểm kho</h1><p className="text-sm text-slate-500">Lưu nháp, giải trình thiếu/dư và chốt số tồn thực.</p></div>{canCreate&&<button disabled={loading||saving} className="warehouse-button" onClick={create}>+ Đợt kiểm kho mới</button>}</header>
 {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
 {editing&&<section className="min-w-0 space-y-4 rounded-2xl border bg-white p-3 sm:p-4"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{selected?.checkCode||'Đợt kiểm kho mới'} · {finalized?'Đã chốt':'Bản nháp'}</h2><button disabled={saving} className="warehouse-button" onClick={()=>{if(readonly||window.confirm('Đóng đợt đang nhập? Các thay đổi chưa lưu sẽ mất.'))setEditing(false)}}>Đóng</button></header>
 <div className="flex flex-wrap gap-3"><label>Ngày kiểm<input type="date" value={date} disabled={readonly||saving||loading} onChange={e=>setDate(e.target.value)}/></label><label className="flex-1">Ghi chú đợt<input value={note} disabled={readonly||saving||loading} onChange={e=>setNote(e.target.value)} className="w-full"/></label></div>
 {selected&&<p className="text-sm text-slate-500">Tạo lúc: {time(selected.createdAt)} · {selected.createdBy}{selected.completedAt&&<> · Chốt lúc: {time(selected.completedAt)} · {selected.completedBy}</>}</p>}
 <p className="text-sm">{lines.filter(i=>i.actualQuantity!=='').length}/{lines.length} mặt hàng đã kiểm. Số lượng theo đơn vị nhập hàng; để trống nếu chưa kiểm, nhập 0 nếu hết hàng.</p>
 {!finalized&&<div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nếu thiếu phiếu nhập/xuất, chọn chờ bổ sung và lưu nháp. Bổ sung phiếu trước, sau đó cập nhật tồn máy và xác nhận đã đối chiếu từng mặt hàng. Số thực đếm được giữ nguyên; nếu có giao dịch mới sau lúc đếm, cần kiểm đếm lại.{canEdit&&<button disabled={loading||saving} className="warehouse-button mt-2" onClick={()=>void reconcile()}>Cập nhật tồn máy để đối chiếu</button>}</div>}
 <select aria-label="Lọc chênh lệch" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Toàn bộ mặt hàng</option><option value="variance">Thiếu / dư</option><option value="matched">Đủ</option><option value="unchecked">Chưa kiểm</option></select>
 <div className="rounded-xl border md:hidden">
  <div className="grid grid-cols-[minmax(0,1fr)_4rem_5rem] items-center gap-2 rounded-t-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
   <span>Mặt hàng</span><span className="text-right">Tồn máy</span><span className="text-center">Tồn thực</span>
  </div>
  <div className="divide-y">
   {visibleLines.map(i=>{
    const counted=i.actualQuantity!=='';
    const diff=Number(i.actualQuantity)-i.systemQuantity/i.factor;
    const variance=counted&&Math.abs(Number(i.actualQuantity)*i.factor-i.systemQuantity)>=0.0005;
    return <article key={i.productCode} className="min-w-0 p-3">
     <div className="grid grid-cols-[minmax(0,1fr)_4rem_5rem] items-center gap-2">
      <div className="min-w-0"><p className="break-words text-sm font-semibold leading-5">{i.productName}</p><p className="mt-0.5 break-words text-xs text-slate-500">{i.productCode} · {i.unit}</p></div>
      <div className="min-w-0 break-words text-right text-sm font-bold tabular-nums">{qty(i.systemQuantity/i.factor)}</div>
      <input aria-label={'Tồn thực '+i.productName} type="number" inputMode="decimal" min="0" step="any" value={i.actualQuantity} disabled={readonly||saving||loading} onChange={e=>change(i.productCode,{actualQuantity:e.target.value})} placeholder="—" className="!min-h-11 !w-full !min-w-0 rounded-lg border !px-2 text-center !text-base tabular-nums"/>
     </div>
     <p className={'mt-2 text-xs '+(!counted?'text-slate-500':variance?(diff<0?'text-rose-700':'text-amber-700'):'text-emerald-700')}>{!counted?'Chưa kiểm':variance?(diff<0?'Thiếu ':'Dư ')+qty(Math.abs(diff))+' '+i.unit:'Đủ · Khớp tồn máy'}</p>
     {resolutionSelect(i)}
     {(variance||i.note)&&<label className="mt-2 block text-xs text-slate-600">Giải trình / lý do<input aria-label={'Giải trình '+i.productName} value={i.note} disabled={readonly||saving||loading} onChange={e=>change(i.productCode,{note:e.target.value})} placeholder="Nhập lý do thiếu / dư" className="mt-1 !min-h-11 !w-full !min-w-0 !text-base"/></label>}
    </article>;
   })}
   {!visibleLines.length&&<p className="p-4 text-center text-sm text-slate-500">Không có mặt hàng phù hợp.</p>}
  </div>
 </div>
 <div className="hidden max-h-[60vh] overflow-auto md:block"><table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 bg-emerald-50"><tr>{['Mã','Tên mặt hàng','Đơn vị','Tồn máy','Tồn thực','Chênh lệch','Giải trình / lý do'].map(t=><th className="p-3 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{visibleLines.map(i=>{const diff=Number(i.actualQuantity)-i.systemQuantity/i.factor;return <tr key={i.productCode} className="border-b"><td className="p-3">{i.productCode}</td><td>{i.productName}</td><td>{i.unit}</td><td>{qty(i.systemQuantity/i.factor)}</td><td><input aria-label={'Tồn thực '+i.productName} type="number" min="0" step="any" value={i.actualQuantity} disabled={readonly||saving||loading} onChange={e=>change(i.productCode,{actualQuantity:e.target.value})} className="w-28"/></td><td className={diff<0?'text-rose-700':'text-emerald-700'}>{i.actualQuantity===''?'Chưa kiểm':qty(diff)+(Math.abs(diff)<0.0005?' · Đủ':diff<0?' · Thiếu':' · Dư')}</td><td>{resolutionSelect(i)}<input aria-label={'Giải trình '+i.productName} value={i.note} disabled={readonly||saving||loading} onChange={e=>change(i.productCode,{note:e.target.value})} placeholder="Lý do thiếu / dư" className="w-full"/></td></tr>})}</tbody></table></div>
 {!finalized&&(canEdit||canComplete)&&<footer className="flex gap-3">{canEdit&&<button disabled={loading||saving||!lines.length} className="warehouse-button" onClick={()=>void save(false)}>Lưu nháp</button>}{canComplete&&<button disabled={loading||saving||!lines.length} className="warehouse-button bg-emerald-700 text-white" onClick={()=>void save(true)}>{saving?'Đang lưu…':'Chốt kiểm kho'}</button>}</footer>}</section>}
 <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex flex-wrap gap-3 p-4"><input placeholder="Tìm mã đợt, ghi chú, người kiểm…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Trạng thái đợt" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="draft">Nháp</option><option value="completed">Đã chốt</option></select><input aria-label="Từ ngày" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><input aria-label="Đến ngày" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="overflow-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-emerald-50"><tr>{['Mã đợt','Ngày kiểm','Ngày giờ tạo','Người tạo','Trạng thái','Đã kiểm','Thiếu / dư (đơn vị cơ sở)','Thao tác'].map(t=><th key={t} className="p-3 text-left">{t}</th>)}</tr></thead><tbody>{list.map(c=><tr key={c.id} className="border-b"><td className="p-3 font-bold">{c.checkCode}</td><td>{c.checkDate}</td><td>{time(c.createdAt)}</td><td>{c.createdBy}</td><td>{c.status==='draft'?'Nháp':'Đã chốt'}</td><td>{c.countedItemCount}/{c.items.length}</td><td>−{qty(c.decreaseQuantityTotal)} / +{qty(c.increaseQuantityTotal)}</td><td><button disabled={loading||saving} className="warehouse-button" onClick={()=>{if(!editing||readonly||window.confirm('Mở đợt khác? Các thay đổi chưa lưu sẽ mất.'))open(c)}}>{c.status==='draft'&&canUpdate?'Mở nháp / giải trình':'Xem chi tiết'}</button>{canDelete&&c.status==='draft'&&<button disabled={loading||saving} className="warehouse-button ml-2 text-rose-700" onClick={()=>void removeDraft(c)}>Xoá nháp</button>}</td></tr>)}</tbody></table></div>{loading?<p className="p-6">Đang tải…</p>:!list.length&&<p className="p-6">Chưa có đợt kiểm kho phù hợp.</p>}</section>
 </main></RoleGuard>
}
