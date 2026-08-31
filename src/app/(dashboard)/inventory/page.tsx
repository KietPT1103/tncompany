import {createElement as h,useEffect,useMemo,useState} from 'react';
import {Boxes,PackageMinus,PackagePlus} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {useStore} from '@/context/StoreContext';
import {useAuth} from '@/context/AuthContext';
import {hasPermission} from '@/lib/permissions';
import InventoryReceiptsPage from '../inventory-receipts/page';
import InventoryIssuesPage from '../product/issues/page';
import InventoryStockTab from './stock';

const tabs=[
 {id:'receipts',label:'Nhập kho',icon:PackagePlus},
 {id:'issues',label:'Xuất kho',icon:PackageMinus},
 {id:'stock',label:'Tồn kho',icon:Boxes},
] as const;
type TabId=(typeof tabs)[number]['id'];
export default function InventoryWorkspacePage(){
 const {user}=useAuth();
 const {storeId}=useStore();const isConstructionWarehouse=storeId==='warehouse';
 const [params,setParams]=useSearchParams();const requested=params.get('tab');
 const [active,setActive]=useState<TabId>(tabs.some(tab=>tab.id===requested)?requested as TabId:'receipts');
 const visibleTabs=useMemo(()=>tabs.filter(tab=>tab.id==='receipts'
  ?hasPermission(user,'inventory_receipts.view')
  :tab.id==='issues'?hasPermission(user,'inventory_issues.access')
  :hasPermission(user,'inventory_receipts.view')
    ||hasPermission(user,'inventory_issues.access')
    ||hasPermission(user,'inventory_checks.access')),[user]);
 const safeActive=visibleTabs.some(tab=>tab.id===active)?active:visibleTabs[0]?.id;
 useEffect(()=>{if(safeActive&&safeActive!==active)setActive(safeActive);},[active,safeActive]);
 function select(id:TabId){setActive(id);const next=new URLSearchParams(params);next.set('tab',id);setParams(next,{replace:true});}
 const body=safeActive==='receipts'?h(InventoryReceiptsPage):safeActive==='issues'?h(InventoryIssuesPage):safeActive==='stock'?h(InventoryStockTab):h('div',{className:'p-10 text-center text-slate-500'},'Tài khoản chưa được cấp quyền kho.');
 return h('div',{className:'min-h-screen bg-slate-50'},h(InventoryWorkspaceHeader,{active:safeActive??active,select,isConstructionWarehouse,visibleTabs}),body);
}
function InventoryWorkspaceHeader({active,select,isConstructionWarehouse,visibleTabs}:{active:TabId;select:(id:TabId)=>void;isConstructionWarehouse:boolean;visibleTabs:typeof tabs}){
 return h('div',{className:'sticky top-0 z-20 border-b bg-white px-4 pt-4 shadow-sm'},
  h('div',{className:'mx-auto max-w-[1680px]'},
   h('div',{className:'mb-3'},h('p',{className:'text-xs font-black uppercase tracking-[.2em] text-amber-600'},isConstructionWarehouse?'Kho thợ · Vật tư xây dựng':'Sổ kho nguyên liệu'),h('h1',{className:'text-2xl font-black text-emerald-950'},isConstructionWarehouse?'Nhập · Xuất · Tồn vật tư':'Nhập · Xuất · Tồn kho'),h('p',{className:'text-sm text-slate-500'},isConstructionWarehouse?'Theo dõi vật tư nhập kho, cấp cho đội thợ/công trình và tồn thực tế.':'Một nơi duy nhất để theo dõi toàn bộ luồng nguyên liệu.')),
   h('div',{className:'flex gap-1 overflow-x-auto',role:'tablist'},...visibleTabs.map(tab=>h('button',{key:tab.id,role:'tab','aria-selected':active===tab.id,onClick:()=>select(tab.id),className:`flex min-w-36 items-center justify-center gap-2 border-b-4 px-5 py-3 font-bold ${active===tab.id?'border-emerald-700 bg-emerald-50 text-emerald-900':'border-transparent text-slate-500 hover:bg-slate-50'}`},h(tab.icon,{className:'h-5 w-5'}),tab.label))))
 );
}
