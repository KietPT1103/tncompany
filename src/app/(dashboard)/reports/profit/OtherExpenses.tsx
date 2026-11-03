import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AmountInput } from './AmountInput';
import { profitOtherExpenses, roundedProfitMoney, type ProfitInputs } from './dailyProfit';

const money = roundedProfitMoney;

export function OtherExpensesEditor({inputs, onChange, date}: {inputs: ProfitInputs; onChange: (inputs: ProfitInputs) => void; date: string}) {
  const items = profitOtherExpenses(inputs);
  const update = (otherExpenses: NonNullable<ProfitInputs['otherExpenses']>) => onChange({...inputs, otherExpenses});
  return <section className="mt-5 min-w-0 border-t border-slate-200 pt-4 sm:col-span-2" aria-label="Chi phí khác trong ngày">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Chi phí khác trong ngày</h3>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 rounded-md border-[#064E3B] bg-[#064E3B] px-2.5 text-xs font-semibold text-[#F6C85F] hover:border-[#043D2E] hover:bg-[#043D2E] hover:text-[#F6C85F] focus-visible:ring-[#F6C85F]" disabled={items.length >= 100} onClick={() => update([...items,{id:crypto.randomUUID(),name:'',amount:null}])}><Plus className="h-3.5 w-3.5" aria-hidden="true"/>Thêm khoản chi</Button>
    </div>
    {!items.length && <p className="mt-2 text-xs text-slate-500">Chưa có khoản chi khác. Thêm tên khoản chi và số tiền khi phát sinh.</p>}
    <div className="mt-3 space-y-3">
      {items.map((item,index) => <div key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor={`other-name-${date}-${item.id}`} className="mb-1 block text-xs font-medium text-slate-600">Tên khoản chi {index+1}</label>
          <Input id={`other-name-${date}-${item.id}`} value={item.name} maxLength={200} required placeholder="Ví dụ: Dung dịch tuyết" className="min-w-0 rounded-sm border-slate-200 bg-white hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0" onChange={event => update(items.map(row => row.id === item.id ? {...row,name:event.target.value} : row))}/>
        </div>
        <div className="min-w-0"><label htmlFor={`other-amount-${date}-${item.id}`} className="mb-1 block text-xs font-medium text-slate-600">Số tiền</label><AmountInput id={`other-amount-${date}-${item.id}`} label={`Số tiền khoản chi ${index+1}`} value={item.amount} onChange={amount => update(items.map(row => row.id === item.id ? {...row,amount} : row))}/></div>
        <Button type="button" variant="ghost" className="text-red-700" aria-label={`Xóa khoản chi ${index+1}`} onClick={() => update(items.filter(row => row.id !== item.id))}><Trash2 className="h-4 w-4" aria-hidden="true"/></Button>
      </div>)}
    </div>
    <p className="mt-3 flex justify-between gap-3 text-sm font-semibold"><span>Tổng chi phí khác</span><span>{inputs.other === null ? 'Chưa nhập đủ số tiền' : money(inputs.other)}</span></p>
    {items.some(item => !item.name.trim()) && <p className="mt-1 text-xs text-amber-700">Nhập tên cho từng khoản chi trước khi lưu.</p>}
  </section>;
}

export function OtherExpensesDetails({inputs}: {inputs: ProfitInputs}) {
  const items = profitOtherExpenses(inputs);
  if (!items.length) return null;
  return <ul className="mt-2 space-y-1.5 text-xs font-normal text-slate-500" aria-label="Chi tiết chi phí khác">
    {items.map(item => <li key={item.id} className="flex min-w-0 justify-between gap-4"><span className="min-w-0 break-words">{item.name || 'Chưa nhập tên'}</span><span className="shrink-0 tabular-nums">{item.amount === null ? 'Chưa nhập' : money(item.amount)}</span></li>)}
  </ul>;
}
