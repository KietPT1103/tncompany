import { useState } from 'react';
import { Calculator, History, Store } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { ProfitCalculation } from './ProfitCalculation';
import { ProfitHistory } from './ProfitHistory';

export default function ProfitPage() {
  const { storeId, storeName } = useStore();
  const [tab, setTab] = useState<'calculate' | 'history'>('calculate');
  const [revision, setRevision] = useState(0);
  return <section aria-labelledby="profit-heading" className="min-h-full min-w-0 bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8 lg:py-7">
    <div className="mx-auto w-full max-w-[1440px] space-y-5 2xl:max-w-[1680px]">
      <header><div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><Store className="h-4 w-4" aria-hidden="true" /><span>{storeName}</span></div><h1 id="profit-heading" className="mt-2 font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-6xl">Lợi nhuận</h1><p className="mt-1 text-sm font-medium text-[#d6ba5d]">Theo dõi lợi nhuận theo ngày, tuần, tháng và lưu lịch sử báo cáo.</p></header>
      <nav aria-label="Nội dung báo cáo lợi nhuận" className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
        {([{ id: 'calculate', label: 'Tính lợi nhuận', icon: Calculator }, { id: 'history', label: 'Lịch sử', icon: History }] as const).map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} aria-controls={`profit-${item.id}-panel`} onClick={() => setTab(item.id)} className={`inline-flex h-12 shrink-0 items-center gap-2 rounded border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset ${tab === item.id ? 'border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]' : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-800'}`}><item.icon className="h-4 w-4" aria-hidden="true" />{item.label}</button>)}
      </nav>
      <div id="profit-calculate-panel" hidden={tab !== 'calculate'}><ProfitCalculation storeId={storeId} onSaved={() => setRevision(value => value + 1)} /></div>
      <div id="profit-history-panel" hidden={tab !== 'history'}><ProfitHistory key={storeId} storeId={storeId} active={tab === 'history'} revision={revision} /></div>
    </div>
  </section>;
}
