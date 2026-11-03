import { useState } from 'react';
import { Calculator, History, Store } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { ProfitCalculation } from './ProfitCalculation';
import { ProfitHistory } from './ProfitHistory';
import type { ProfitHistoryDetail } from '@/services/dailyProfitService';
import { Button } from '@/components/ui/Button';

export default function ProfitPage() {
  const { storeId, storeName } = useStore();
  const [tab, setTab] = useState<'calculate' | 'history'>('calculate');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<{storeId:string; report:ProfitHistoryDetail; version:number} | null>(null);
  const editingReport = editing?.storeId === storeId ? editing : null;
  return <section aria-labelledby="profit-heading" className="min-h-full min-w-0 bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8 lg:py-7">
    <div className="mx-auto w-full max-w-[1440px] space-y-5 2xl:max-w-[1680px]">
      <header><div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><Store className="h-4 w-4" aria-hidden="true" /><span>{storeName}</span></div><h1 id="profit-heading" className="mt-2 font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-6xl">Lợi nhuận</h1><p className="mt-1 text-sm font-medium text-[#d6ba5d]">Theo dõi lợi nhuận theo ngày, tuần, tháng và lưu lịch sử báo cáo.</p></header>
      <nav aria-label="Nội dung báo cáo lợi nhuận" className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
        {([{ id: 'calculate', label: 'Tính lợi nhuận', icon: Calculator }, { id: 'history', label: 'Lịch sử', icon: History }] as const).map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} aria-controls={`profit-${item.id}-panel`} onClick={() => setTab(item.id)} className={`inline-flex h-12 shrink-0 items-center gap-2 rounded border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset ${tab === item.id ? 'border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]' : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-800'}`}><item.icon className="h-4 w-4" aria-hidden="true" />{item.label}</button>)}
      </nav>
      <div id="profit-calculate-panel" hidden={tab !== 'calculate'}>
        {editingReport && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><span>Đang chỉnh sửa báo cáo đã lưu</span><Button variant="outline" size="sm" onClick={() => setEditing(null)}>Tạo báo cáo mới</Button></div>}
        <ProfitCalculation key={`${storeId}:${editingReport?.version ?? 'new'}`} storeId={storeId} storeName={storeName} initialReport={editingReport?.report} onSaved={() => setRevision(value => value + 1)} />
      </div>
      <div id="profit-history-panel" hidden={tab !== 'history'}><ProfitHistory key={storeId} storeId={storeId} active={tab === 'history'} revision={revision} onEdit={report => {setEditing({storeId,report,version:(editing?.version ?? 0)+1});setTab('calculate');}} /></div>
    </div>
  </section>;
}
