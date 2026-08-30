import {createElement as h,useState} from 'react';
import {Boxes,PackageMinus,PackagePlus} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
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
 const [params,setParams]=useSearchParams();const requested=params.get('tab');
 const [active,setActive]=useState<TabId>(tabs.some(tab=>tab.id===requested)?requested as TabId:'receipts');
 function select(id:TabId){setActive(id);const next=new URLSearchParams(params);next.set('tab',id);setParams(next,{replace:true});}
 const body=active==='receipts'?h(InventoryReceiptsPage):active==='issues'?h(InventoryIssuesPage):h(InventoryStockTab);
 return h('div',{className:'min-h-screen bg-slate-50'},h(InventoryWorkspaceHeader,{active,select}),body);
}
function InventoryWorkspaceHeader({active,select}:{active:TabId;select:(id:TabId)=>void}){
 return h('div',{className:'sticky top-0 z-20 border-b bg-white px-4 pt-4 shadow-sm'},
  h('div',{className:'mx-auto max-w-[1680px]'},
   h('div',{className:'mb-3'},h('p',{className:'text-xs font-black uppercase tracking-[.2em] text-amber-600'},'Sổ kho nguyên liệu'),h('h1',{className:'text-2xl font-black text-emerald-950'},'Nhập · Xuất · Tồn kho'),h('p',{className:'text-sm text-slate-500'},'Một nơi duy nhất để theo dõi toàn bộ luồng nguyên liệu.')),
   h('div',{className:'flex gap-1 overflow-x-auto',role:'tablist'},...tabs.map(tab=>h('button',{key:tab.id,role:'tab','aria-selected':active===tab.id,onClick:()=>select(tab.id),className:`flex min-w-36 items-center justify-center gap-2 border-b-4 px-5 py-3 font-bold ${active===tab.id?'border-emerald-700 bg-emerald-50 text-emerald-900':'border-transparent text-slate-500 hover:bg-slate-50'}`},h(tab.icon,{className:'h-5 w-5'}),tab.label))))
 );
}
