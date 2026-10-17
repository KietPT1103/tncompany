import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { inventoryToday } from "@/lib/inventoryPeriods";
import { apiRequest } from "@/lib/api";
import { normalizeSearchText } from "@/lib/utils";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { InventoryPagination } from "@/components/ui/InventoryPagination";
import * as XLSX from "xlsx";

type EquipmentStock = { productCode: string; productName: string; unit: string; quantity: number; adjusted?: number; value?: number };
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
export default function EquipmentWarehouseStock() {
  const { storeId } = useStore();
  const navigate=useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [version, setVersion] = useState(0);
  const [date,setDate]=useState(inventoryToday);
  const [links,setLinks]=useState<Array<{productCode:string;productName:string;unit:string;posCode:string;salesStartAt:string;opening:number;received:number;sold:number;quantity:number}>>([]);
  const [products,setProducts]=useState<Array<{code:string;name:string}>>([]);
  const [linkTarget,setLinkTarget]=useState<EquipmentStock|null>(null);
  const [posCode,setPosCode]=useState("");
  const [linking,setLinking]=useState(false);
  const [salesStartDate,setSalesStartDate]=useState(inventoryToday);
  const [editTarget,setEditTarget]=useState<EquipmentStock|null>(null);
  const [editForm,setEditForm]=useState({code:"",name:"",unit:"",quantity:"",reason:""});
  const [editBusy,setEditBusy]=useState(false);
  useEffect(()=>{setLinkTarget(null);setEditTarget(null);setLinks([]);},[storeId,date]);
  useEffect(()=>{
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!linking&&!editBusy){setLinkTarget(null);setEditTarget(null)}};
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
  },[linking,editBusy]);
  useEffect(()=>{let active=true;apiRequest<{items:typeof links;products:typeof products}>(`/inventory-pos-stock.php?storeId=${encodeURIComponent(storeId)}&date=${date}`).then(data=>{if(active){setLinks(data.items);setProducts(data.products)}}).catch(reason=>{if(active)setError(reason.message)});return()=>{active=false}},[storeId,date,version]);
  const linked=(item:EquipmentStock)=>links.find(link=>link.productCode===item.productCode&&link.productName===item.productName&&link.unit===item.unit);
  async function saveLink(){if(!linkTarget||!posCode||linking)return;setLinking(true);try{await apiRequest('/inventory-pos-stock.php',{method:'POST',body:JSON.stringify({...linkTarget,storeId,posCode,salesStartDate})});setLinkTarget(null);setVersion(value=>value+1);window.dispatchEvent(new Event('pos-stock-changed'))}catch(reason){setError(reason instanceof Error?reason.message:'Không thể liên kết')}finally{setLinking(false)}}
  function openLink(item:EquipmentStock) {
    const current=linked(item);setError("");setPosCode(current?.posCode||"");
    setSalesStartDate(current?.salesStartAt?.slice(0,10)||date);setLinkTarget(item);
  }
  function openEdit(item:EquipmentStock) {
    setError("");setEditTarget(item);
    setEditForm({code:item.productCode,name:item.productName,unit:item.unit,quantity:String(item.quantity),reason:""});
  }
  async function saveStock() {
    if(!editTarget||editBusy)return;
    const quantity=Number(editForm.quantity.replace(',','.'));
    if(!editForm.quantity.trim()||!Number.isFinite(quantity)){setError('Số tồn phải là số không âm.');return;}
    const changed=quantity!==editTarget.quantity;
    if(changed&&quantity<0){setError('Số tồn thực tế không được âm.');return;}
    if(changed&&!editForm.reason.trim()){setError('Vui lòng nhập lý do điều chỉnh số lượng.');return;}
    setEditBusy(true);setError("");
    try {
      await apiRequest('/inventory-pos-stock.php',{method:'PATCH',body:JSON.stringify({
        ...editTarget,storeId,action:'edit-stock',date,newProductCode:editForm.code.trim(),newProductName:editForm.name.trim(),newUnit:editForm.unit.trim(),
        ...(changed?{quantity,reason:editForm.reason.trim()}:{}),
      })});
      setEditTarget(null);setVersion(value=>value+1);window.dispatchEvent(new Event('pos-stock-changed'));
    } catch(reason){setError(reason instanceof Error?reason.message:'Không thể lưu hàng tồn.');}
    finally{setEditBusy(false);}
  }
  const [items, setItems] = useState<EquipmentStock[]>([]);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]);
    apiRequest<{ items: EquipmentStock[] }>(`/inventory-equipment-stock.php?areaId=${encodeURIComponent(storeId)}&date=${date}`)
      .then(data => { if (active) setItems(data.items); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải tồn hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, date, version]);
  useEffect(() => { setPage(1); }, [storeId, search, unit, pageSize]);
  const filtered = useMemo(() => {
    const term = normalizeSearchText(search.trim());
    return items.filter(item => (!unit || item.unit === unit) && (!term || normalizeSearchText(`${item.productCode} ${item.productName}`).includes(term)));
  }, [items, search, unit]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function exportStock() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(filtered.map(item => ({ "Mã": item.productCode, "hàng": item.productName, "Đơn vị": item.unit, "Số lượng": item.quantity, "Đầu ngày":linked(item)?.opening??null,"Nhập trong ngày":linked(item)?.received??null,"Bán trong ngày":linked(item)?.sold??null,"Điều chỉnh trong ngày":item.adjusted||0, ...(isAdmin ? { "Giá trị nhập": item.value || 0 } : {}) }))), "Tồn hàng");
    XLSX.writeFile(book, `ton-dung-cu-${storeId}.xlsx`);
  }
  return <div className="mx-auto max-w-[1680px] space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div><h2 className="text-2xl font-bold text-emerald-950">Tồn kho hàng</h2><p className="mt-1 text-sm text-slate-500">Hàng liên kết POS: tồn = nhập đã chốt − bán đã thanh toán ± điều chỉnh. Chọn ngày để đối soát.</p></div>
      <div className="flex flex-wrap gap-2">{isAdmin&&<button className="warehouse-button" onClick={()=>navigate("/admin/product")}>Thêm bánh / sản phẩm mới</button>}{isAdmin && <button disabled={loading || !!error} onClick={exportStock} className="warehouse-button"><Download size={16}/>Xuất Excel</button>}<button disabled={loading} onClick={() => setVersion(value => value + 1)} className="warehouse-button"><RefreshCw size={16}/>Tải lại</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Số loại hàng</p><b className="text-2xl text-emerald-950">{items.length}</b></div></div>
      <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Tổng số lượng · theo đơn vị từng hàng</p><b className="text-2xl text-emerald-950">{number(items.reduce((sum, item) => sum + (item.quantity), 0))}</b></div></div>
      {isAdmin && <div className="warehouse-stat"><div><p className="text-sm text-slate-500">Tổng giá trị nhập</p><b className="text-2xl text-emerald-950">{number(items.reduce((sum, item) => sum + (item.value || 0), 0))} ₫</b></div></div>}
    </div>
    <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Ngày kiểm kho<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
    {isAdmin&&linkTarget&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-3">
      <section role="dialog" aria-modal="true" aria-label="Liên kết POS" className="equipment-edit-dialog max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5">
        <h3 className="font-bold">{linked(linkTarget)?'Sửa liên kết':'Liên kết'} · {linkTarget.productName}</h3>
        <p className="my-3 text-sm">1 sản phẩm POS = 1 {linkTarget.unit}. Tồn sẽ được tính lại theo sản phẩm và ngày bắt đầu bên dưới, bao gồm bill cũ đã thanh toán. Bill đã hủy không bị trừ.</p>
        <label className="block text-sm font-semibold">Sản phẩm POS<select className="mt-1 w-full" value={posCode} onChange={event=>setPosCode(event.target.value)}><option value="">Chọn sản phẩm POS</option>{products.map(product=><option key={product.code} value={product.code}>{product.name} ({product.code})</option>)}</select></label>
        <label className="mt-3 block text-sm font-semibold">Tính bill từ ngày<input type="date" max={inventoryToday()} value={salesStartDate} onChange={event=>setSalesStartDate(event.target.value)} className="mt-1 w-full"/></label>
        {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button disabled={linking} className="warehouse-button" onClick={()=>setLinkTarget(null)}>Đóng</button><button disabled={linking||!posCode||!salesStartDate} className="warehouse-primary" onClick={()=>void saveLink()}>{linking?'Đang lưu…':'Lưu liên kết'}</button></div>
      </section>
    </div>}
    {isAdmin&&editTarget&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-3">
      <section role="dialog" aria-modal="true" aria-label="Sửa hàng tồn" className="equipment-edit-dialog max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <h3 className="text-lg font-bold">Sửa hàng tồn · {editTarget.productName}</h3>
        <p className="mt-2 text-sm text-slate-600">Điều chỉnh tồn tại ngày {date}. Số lượng và đơn giá trên phiếu nhập được giữ nguyên; chênh lệch tồn được lưu riêng kèm người sửa và lý do. Đổi đơn vị chỉ sửa tên đơn vị, không quy đổi số lượng.</p>
        <div className="my-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Mã hàng<input value={editForm.code} onChange={event=>setEditForm({...editForm,code:event.target.value})} className="mt-1 w-full"/></label>
          <label className="text-sm font-semibold">Tên hàng<input value={editForm.name} onChange={event=>setEditForm({...editForm,name:event.target.value})} className="mt-1 w-full"/></label>
          <label className="text-sm font-semibold">Đơn vị<input value={editForm.unit} onChange={event=>setEditForm({...editForm,unit:event.target.value})} className="mt-1 w-full"/></label>
          <label className="text-sm font-semibold">Số lượng tồn thực tế<input type="number" min="0" step="0.001" value={editForm.quantity} onChange={event=>setEditForm({...editForm,quantity:event.target.value})} className="mt-1 w-full"/></label>
        </div>
        <label className="block text-sm font-semibold">Lý do điều chỉnh số lượng<textarea value={editForm.reason} onChange={event=>setEditForm({...editForm,reason:event.target.value})} className="mt-1 w-full"/></label>
        {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button disabled={editBusy} className="warehouse-button" onClick={()=>setEditTarget(null)}>Hủy</button><button disabled={editBusy||!editForm.code.trim()||!editForm.name.trim()||!editForm.unit.trim()} className="warehouse-primary" onClick={()=>void saveStock()}>{editBusy?'Đang lưu…':'Lưu thay đổi'}</button></div>
      </section>
    </div>}
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap gap-3 p-3"><input aria-label="Tìm hàng" placeholder="Tìm mã hoặc tên hàng…" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"/><select aria-label="Đơn vị hàng" value={unit} onChange={event => setUnit(event.target.value)} className="min-h-11 rounded-lg border px-3"><option value="">Tất cả đơn vị</option>{[...new Set(items.map(item => item.unit))].map(value => <option value={value} key={value}>{value}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-emerald-50"><tr>{["Mã", "Tên hàng", "Tồn kho hiện tại", "Đơn vị", "Đầu ngày", "Nhập trong ngày", "Bán trong ngày", "Điều chỉnh trong ngày", "Liên kết POS", ...(isAdmin ? ["Giá trị nhập", "Thao tác"] : [])].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={isAdmin ? 11 : 9} className="p-8 text-center">Đang tải…</td></tr> : rows.map((item, index) => <tr className="border-t" key={index}><td className="p-3">{item.productCode || "—"}</td><td className="p-3 font-semibold">{item.productName}</td><td className="p-3 font-bold text-emerald-800">{number(item.quantity)}</td><td className="p-3">{item.unit}</td><td className="p-3">{linked(item)?number(linked(item)!.opening):'—'}</td><td className="p-3">{linked(item)?number(linked(item)!.received):'—'}</td><td className="p-3">{linked(item)?number(linked(item)!.sold):'—'}</td><td className="p-3">{number(item.adjusted||0)}</td><td className="p-3">{linked(item)?<div><span>{products.find(product=>product.code===linked(item)!.posCode)?.name||linked(item)!.posCode}</span>{isAdmin&&<button className="warehouse-button mt-1" onClick={()=>openLink(item)}>Sửa liên kết</button>}<small className="mt-1 block text-slate-500">Tính bill từ {linked(item)!.salesStartAt?.slice(0,10)}</small></div>:isAdmin?<button className="warehouse-button" onClick={()=>openLink(item)}>Liên kết sản phẩm POS</button>:'Chưa liên kết'}</td>{isAdmin && <><td className="p-3">{number(item.value || 0)} ₫</td><td className="p-3"><button className="warehouse-button" onClick={()=>openEdit(item)}>Sửa hàng tồn</button></td></>}</tr>)}{!loading && !rows.length && <tr><td colSpan={isAdmin ? 11 : 9} className="p-8 text-center text-slate-500">Không có hàng phù hợp.</td></tr>}</tbody></table></div>
      <InventoryPagination page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading}/>
    </section>
  </div>;
}
