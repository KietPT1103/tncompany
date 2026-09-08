import {createElement as h,useEffect,useMemo,useState} from 'react';
import {Boxes,LoaderCircle,RefreshCw,Save} from 'lucide-react';
import {useStore} from '@/context/StoreContext';
import {useAuth} from '@/context/AuthContext';
import {getInventoryOverview,saveCounterCount,type InventoryOverview} from '@/services/inventoryOverviewService';
import {getIngredients,type Ingredient} from '@/services/ingredients';

const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const qty=(value:number|null)=>value===null?'Chưa kiểm':value.toLocaleString('vi-VN',{maximumFractionDigits:3});
const money=(value:number)=>`${Math.round(value).toLocaleString('vi-VN')} ₫`;

export default function InventoryStockTab(){
 return h(MainWarehouseStock);
}

function MainWarehouseStock(){
 const {user}=useAuth();const isAdmin=user?.role==='admin';
 const {storeId}=useStore();const isConstructionWarehouse=storeId==='warehouse';const [items,setItems]=useState<Ingredient[]>([]);const [search,setSearch]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const result=await getIngredients(storeId,'','stock');setItems(result.items.filter(item=>item.isActive));}catch(reason){setError(reason instanceof Error?reason.message:'Không thể tải tồn kho vật tư.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[storeId]);
 const filtered=useMemo(()=>{const term=search.trim().toLocaleLowerCase('vi');return !term?items:items.filter(item=>`${item.ingredientCode} ${item.ingredientName} ${item.supplierName||''}`.toLocaleLowerCase('vi').includes(term));},[items,search]);
 const totalValue=isAdmin?items.reduce((sum,item)=>sum+item.stockQuantity*Number(item.cost||0),0):0;const totalQuantity=items.reduce((sum,item)=>sum+item.stockQuantity/(item.purchaseToBaseFactor||1),0);
 if(loading)return h('div',{className:'p-16 text-center text-slate-500'},h(LoaderCircle,{className:'mx-auto mb-3 animate-spin'}),'Đang tải tồn kho vật tư...');
 return h('div',{className:'mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6'},
  h('section',{className:'rounded-2xl border bg-white p-5 shadow-sm'},h('div',{className:'flex flex-wrap items-center justify-between gap-4'},h('div',{},h('h2',{className:'text-2xl font-black text-emerald-950'},isConstructionWarehouse?'Tồn vật tư xây dựng':'Tồn kho nguyên liệu'),h('p',{className:'text-sm text-slate-500'},isConstructionWarehouse?'Tổng hợp số lượng và giá trị vật tư hiện có trong Kho thợ.':'Kho chính chỉ hiển thị số lượng theo đơn vị nhập hàng.')),h('button',{onClick:()=>void load(),className:'flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800'},h(RefreshCw,{className:'h-4 w-4'}),'Tải lại'))),
  error?h('div',{className:'rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700'},error):null,
  h('div',{className:`grid gap-3 ${isAdmin?'sm:grid-cols-3':'sm:grid-cols-2'}`},Summary('Số loại vật tư',String(items.length),'Đang hoạt động'),Summary('Tổng số lượng',qty(totalQuantity),'Theo đơn vị của từng vật tư'),isAdmin?Summary('Giá trị tồn',money(totalValue),'Số lượng tồn × giá vốn'):null),
  h('section',{className:'overflow-hidden rounded-2xl border bg-white shadow-sm'},h('div',{className:'border-b p-4'},h('input',{value:search,onChange:(event:any)=>setSearch(event.target.value),placeholder:'Tìm mã, tên nguyên liệu hoặc nhà phân phối...',className:'h-11 w-full max-w-md rounded-lg border bg-slate-50 px-4'})),h('div',{className:'overflow-x-auto'},h('table',{className:`w-full ${isAdmin?'min-w-[900px]':'min-w-[680px]'} text-sm`},h('thead',{className:'bg-emerald-950 text-left text-white'},h('tr',{},...['Mã','Tên nguyên liệu','Nhà phân phối','Tồn kho','Đơn vị',...(isAdmin?['Giá vốn / đơn vị nhập','Giá trị tồn']:[])].map(label=>h('th',{key:label,className:'px-4 py-3 last:text-right'},label)))),h('tbody',{className:'divide-y'},...filtered.map(item=>{const factor=item.purchaseToBaseFactor||1;return h('tr',{key:item.id,className:'hover:bg-emerald-50/40'},h('td',{className:'px-4 py-3 font-bold text-emerald-800'},item.ingredientCode),h('td',{className:'px-4 py-3 font-semibold'},item.ingredientName),h('td',{className:'px-4 py-3'},item.supplierName||'Chưa gán'),h('td',{className:'px-4 py-3 text-right font-bold'},qty(item.stockQuantity/factor)),h('td',{className:'px-4 py-3'},item.purchaseUnit||item.unit||'—'),...(isAdmin?[h('td',{key:'cost',className:'px-4 py-3 text-right'},money(Number(item.cost||0)*factor)),h('td',{key:'value',className:'px-4 py-3 text-right font-bold'},money(item.stockQuantity*Number(item.cost||0)))]:[]))})))),filtered.length===0?h('div',{className:'p-14 text-center text-slate-500'},h(Boxes,{className:'mx-auto mb-2 text-slate-300'}),'Không có nguyên liệu phù hợp.'):null));
}

export function PreparationInventoryStockTab(){
 const {storeId}=useStore();const now=new Date();
 const [from,setFrom]=useState(iso(new Date(now.getFullYear(),now.getMonth(),1)));const [to,setTo]=useState(iso(now));
 const [data,setData]=useState<InventoryOverview|null>(null);const [actual,setActual]=useState<Record<string,string>>({});
 const [search,setSearch]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const result=await getInventoryOverview(storeId,from,to);setData(result);setActual(Object.fromEntries(result.items.map(item=>[item.ingredientId,String(item.actualCounterQuantity??item.expectedCounterQuantity)])));}catch(reason){setError(reason instanceof Error?reason.message:'Không thể tải tồn kho.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[storeId]);
 const setPeriod=(kind:'today'|'week'|'month')=>{const end=new Date();const start=kind==='today'?end:kind==='week'?new Date(end.getFullYear(),end.getMonth(),end.getDate()-6):new Date(end.getFullYear(),end.getMonth(),1);setFrom(iso(start));setTo(iso(end));};
 const items=useMemo(()=>{const term=search.trim().toLocaleLowerCase('vi');return !term?(data?.items??[]):(data?.items??[]).filter(item=>`${item.ingredientCode} ${item.ingredientName}`.toLocaleLowerCase('vi').includes(term));},[data,search]);
 async function saveCount(){if(!data?.canCount||data.isLocked)return;setSaving(true);setError('');try{await saveCounterCount({storeId,countDate:to,items:data.items.map(item=>({ingredientId:item.ingredientId,actualQuantity:Math.max(0,Number((actual[item.ingredientId]??'0').replace(',','.'))||0)}))});await load();}catch(reason){setError(reason instanceof Error?reason.message:'Không thể chốt tồn quầy.');}finally{setSaving(false);}}
 if(loading&&!data)return h('div',{className:'p-16 text-center text-slate-500'},h(LoaderCircle,{className:'mx-auto mb-3 animate-spin'}),'Đang tổng hợp tồn kho...');
 const totals=data?.totals;
 return h('div',{className:'mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6'},
  h('section',{className:'rounded-2xl border bg-white p-5 shadow-sm'},
   h('div',{className:'flex flex-wrap items-end justify-between gap-4'},h('div',{},h('h2',{className:'text-2xl font-black text-emerald-950'},data?.isAdmin?'Tồn nguyên liệu pha chế':'Chốt tồn cuối ngày'),h('p',{className:'text-sm text-slate-500'},data?.isAdmin?'Theo dõi tồn quầy, tiêu hao theo món bán và hao hụt thực tế.':'Nhập số lượng thực tế còn lại tại quầy pha chế.')),
    data?.isAdmin?h('div',{className:'flex flex-wrap items-end gap-2'},h('div',{className:'flex h-10 overflow-hidden rounded-lg border'},...([['today','Ngày'],['week','7 ngày'],['month','Tháng']] as const).map(([kind,label])=>h('button',{key:kind,type:'button',onClick:()=>setPeriod(kind),className:'border-r px-3 text-xs font-bold text-emerald-800 last:border-r-0'},label))),DateField('Từ ngày',from,setFrom),DateField('Đến ngày',to,setTo),h('button',{onClick:()=>void load(),className:'flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800'},h(RefreshCw,{className:'h-4 w-4'}),'Xem')):h('button',{onClick:()=>void load(),className:'flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800'},h(RefreshCw,{className:'h-4 w-4'}),'Tải lại'))),
  error?h('div',{className:'rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700'},error):null,
  data?.isLocked?h('div',{className:'rounded-xl border border-slate-300 bg-slate-100 p-3 text-sm font-semibold text-slate-700'},'Ngày này đã khóa. Chỉ admin hoặc tài khoản có quyền sửa chốt kho quá ngày được chỉnh sửa.'):null,
  data?.isAdmin&&data.canCount&&!data.canCalculateLoss&&data.lossMessage?h('div',{className:'rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900'},data.lossMessage):null,
  totals?(data?.isAdmin?h('div',{className:'grid gap-3 sm:grid-cols-2 xl:grid-cols-5'},Summary('Tồn trong kho',qty(totals.warehouseQuantity),'Nguyên liệu sẵn sàng cấp quầy'),Summary('Tồn tại quầy',qty(totals.counterQuantity),data?.latestCountDate?`Kiểm ngày ${data.latestCountDate}`:'Theo sổ, chưa kiểm thực tế'),Summary('Đã dùng theo công thức',qty(totals.usedQuantity),`${from} — ${to}`),Summary('% hao hụt',data.canCalculateLoss&&totals.lossPercent!==null?`${totals.lossPercent.toLocaleString('vi-VN')}%`:'—',data.canCalculateLoss?`Giá trị hao hụt ${money(totals.lossValue)}`:'Cần đủ hai lần chốt tồn'),Summary('Giá trị tồn',money(totals.warehouseValue+totals.counterValue),`Kho ${money(totals.warehouseValue)} · Quầy ${money(totals.counterValue)}`)):h('div',{className:'grid gap-3 sm:grid-cols-2'},Summary('Nhập trong quầy',qty((data?.items??[]).reduce((sum,item)=>sum+item.issuedQuantity,0)),`Từ ${from} đến ${to}`),Summary('Tồn quầy dự kiến',qty((data?.items??[]).reduce((sum,item)=>sum+item.expectedCounterQuantity,0)),'Nhập số thực tế còn lại để chốt tồn'))):null,
  h('section',{className:'overflow-hidden rounded-2xl border bg-white shadow-sm'},
   h('div',{className:'flex flex-wrap items-center justify-between gap-3 border-b p-4'},h('label',{className:'flex-1'},h('input',{value:search,onChange:(event:any)=>setSearch(event.target.value),placeholder:'Tìm mã hoặc tên nguyên liệu...',className:'h-11 w-full max-w-md rounded-lg border bg-slate-50 px-4'})),data?.canCount?h('button',{disabled:saving||data.isLocked,onClick:()=>void saveCount(),title:data.isLocked?'Ngày này đã khóa':undefined,className:'flex h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50'},h(Save,{className:'h-4 w-4'}),saving?'Đang lưu...':data.isLocked?'Ngày đã khóa':'Chốt tồn cuối ngày'):null),
   h('div',{className:'overflow-x-auto'},h('table',{className:'w-full min-w-[1050px] text-sm'},
    h('thead',{className:'bg-emerald-950 text-left text-white'},h('tr',{},...(data?.isAdmin?['Mã','Nguyên liệu','ĐVT','Tồn kho','Tồn quầy dự kiến','Nhập quầy','Dùng theo công thức','Thực dùng','Tăng/giảm tồn BTP',...(data?.canCount?['Tồn cuối ngày']:[]),'Hao hụt','% hao hụt','Giá trị tồn']:['Mã','Nguyên liệu','ĐVT','Nhập trong quầy','Tồn quầy dự kiến','Số lượng còn lại']).map(label=>h('th',{key:label,className:'px-4 py-3 last:text-right'},label)))),
    h('tbody',{className:'divide-y'},...items.map(item=>data?.isAdmin?InventoryRow(item,Boolean(data?.canCount),true,Boolean(data?.isLocked),actual,setActual):PreparationCountRow(item,Boolean(data?.isLocked),actual,setActual))))),
   items.length===0?h('div',{className:'p-14 text-center text-slate-500'},h(Boxes,{className:'mx-auto mb-2 text-slate-300'}),'Không có nguyên liệu phù hợp.'):null),
  data?.recipeErrors.length?h('div',{className:'rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'},h('b',{},'Cần bổ sung công thức: '),data.recipeErrors.join(' · ')):null
 );
}
function PreparationCountRow(item:InventoryOverview['items'][number],locked:boolean,actual:Record<string,string>,setActual:(next:Record<string,string>)=>void){
 return h('tr',{key:item.ingredientId,className:'hover:bg-emerald-50/40'},
  h('td',{className:'px-4 py-3 font-bold text-emerald-800'},item.ingredientCode),h('td',{className:'px-4 py-3 font-semibold'},item.ingredientName),h('td',{className:'px-4 py-3'},item.unit||'—'),h('td',{className:'px-4 py-3 text-right font-semibold'},qty(item.issuedQuantity)),h('td',{className:'px-4 py-3 text-right font-semibold'},qty(item.expectedCounterQuantity)),h('td',{className:'px-4 py-2 text-right'},h('input',{disabled:locked,inputMode:'decimal',value:actual[item.ingredientId]??'',onChange:(event:any)=>setActual({...actual,[item.ingredientId]:event.target.value}),className:'h-9 w-28 rounded-md border px-2 text-right font-bold disabled:bg-slate-100 disabled:text-slate-500'})));
}
function DateField(label:string,value:string,setter:(value:string)=>void){return h('label',{className:'text-xs font-bold text-slate-600'},label,h('input',{type:'date',value,onChange:(event:any)=>setter(event.target.value),className:'mt-1 block h-10 rounded-lg border px-3 text-sm'}));}
function Summary(label:string,value:string,note:string){return h('article',{className:'rounded-2xl border bg-white p-5 shadow-sm'},h('p',{className:'text-xs font-black uppercase tracking-wider text-slate-500'},label),h('p',{className:'mt-2 text-2xl font-black text-emerald-900'},value),h('p',{className:'mt-1 text-xs text-slate-500'},note));}
function InventoryRow(item:InventoryOverview['items'][number],canCount:boolean,admin:boolean,locked:boolean,actual:Record<string,string>,setActual:(next:Record<string,string>)=>void){
 const real=Number((actual[item.ingredientId]??'0').replace(',','.'))||0;const loss=item.lossQuantity;
 const cells=[item.ingredientCode,item.ingredientName,item.unit||'—',qty(item.warehouseQuantity),qty(item.expectedCounterQuantity),qty(item.issuedQuantity),qty(item.usedQuantity),qty(item.actualUsedQuantity),qty(item.preparedStockChange)];
 return h('tr',{key:item.ingredientId,className:'hover:bg-emerald-50/40'},...cells.map((value,index)=>h('td',{key:index,className:`px-4 py-3 ${index===0?'font-bold text-emerald-800':''} ${index>=3?'text-right font-semibold':''}`},value)),...(canCount?[
  h('td',{key:'actual',className:'px-4 py-2'},h('input',{disabled:locked,inputMode:'decimal',value:actual[item.ingredientId]??'',onChange:(event:any)=>setActual({...actual,[item.ingredientId]:event.target.value}),className:'h-9 w-28 rounded-md border px-2 text-right font-bold disabled:bg-slate-100 disabled:text-slate-500'})),
 ]:[]),...(admin?[
  h('td',{key:'loss',className:`px-4 py-3 text-right font-bold ${loss!==null&&loss>0?'text-rose-700':'text-emerald-700'}`},qty(loss)),
  h('td',{key:'loss-percent',className:`px-4 py-3 text-right font-bold ${item.lossPercent!==null&&item.lossPercent>0?'text-rose-700':'text-emerald-700'}`},item.lossPercent===null?'—':`${item.lossPercent.toLocaleString('vi-VN')}%`),
  h('td',{key:'value',className:'px-4 py-3 text-right font-semibold'},money((item.warehouseValue??0)+real*(item.cost??0)))
 ]:[]));
}
