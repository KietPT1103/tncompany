import { useRef, useState } from 'react';
import { updateProductCost } from '@/services/products';
import { AmountInput } from './AmountInput';
import { validProfitAmount } from './dailyProfit';

export function ReportProductCostInput({id, label, storeId, productCode, value, onChange, onSaved}: {
  id: string; label: string; storeId: string; productCode: string; value: number | null;
  onChange: (value: number | null) => void; onSaved: (value: number) => void;
}) {
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState<number | null>(null);
  const [error,setError] = useState('');
  const inFlight = useRef(false);
  async function saveCost(amount: number | null) {
    if (!validProfitAmount(amount) || inFlight.current || amount === saved) return;
    if (!productCode) { setError('Món chưa có mã liên kết với danh mục. Vui lòng kiểm tra món trong Sản phẩm.'); return; }
    inFlight.current = true; setSaving(true); setError('');
    try {
      await updateProductCost(productCode,{cost:amount},storeId);
      setSaved(amount); onSaved(amount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được cost vào danh mục.');
    } finally { inFlight.current = false; setSaving(false); }
  }
  return <div>
    <AmountInput id={id} label={label} value={value} onChange={amount => {setError('');onChange(amount);}} onCommit={saveCost} disabled={saving}/>
    <p aria-live="polite" className={`mt-1 text-xs ${error ? 'text-red-700' : 'text-slate-500'}`}>
      {error || (saving ? 'Đang lưu vào danh mục…' : saved !== null && saved === value ? 'Đã lưu vào danh mục' : 'Rời ô để lưu cost vào danh mục')}
    </p>
    {error && <button type="button" onClick={() => void saveCost(value)} className="mt-1 text-xs font-semibold text-emerald-800 underline">Thử lưu lại</button>}
  </div>;
}
