import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { apiRequest } from '@/lib/api';
import type { Ingredient } from '@/services/ingredients';

export function StockAdjustmentButton({ item, onSaved }: { item: Ingredient; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const { storeId } = useStore();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [snapshot, setSnapshot] = useState({ stock: item.stockQuantity, factor: item.purchaseToBaseFactor || 1 });
  useEffect(() => { setOpen(false); }, [storeId, user?.role]);
  if (user?.role !== 'admin') return null;
  const unit = item.purchaseUnit || item.unit;
  async function save() {
    if (busy.current) return;
    const raw = quantity.trim().replace(',', '.');
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) { setError('Số tồn mới phải lớn hơn hoặc bằng 0.'); return; }
    if (!reason.trim()) { setError('Vui lòng nhập lý do điều chỉnh.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      await apiRequest('/inventory-stock-adjustment.php', { method: 'POST', body: JSON.stringify({ storeId, ingredientId: item.id, expectedStock: snapshot.stock, quantity: value, reason: reason.trim() }) });
      setOpen(false);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tồn.'); }
    finally { busy.current = false; setSaving(false); }
  }
  return <>
    <button type="button" className="warehouse-button whitespace-nowrap" disabled={saving} onClick={() => {
      const factor = item.purchaseToBaseFactor || 1;
      setSnapshot({ stock: item.stockQuantity, factor });
      setQuantity(String(item.stockQuantity / factor)); setReason(''); setError(''); setOpen(true);
    }}>{'Sửa tồn'}</button>
    <ConfirmDialog open={open} title={'Điều chỉnh tồn kho'} confirmLabel={'Cập nhật tồn'} cancelLabel={'Hủy'} isLoading={saving} onCancel={() => { if (!busy.current) setOpen(false); }} onConfirm={() => void save()}
      description={<div className="space-y-4 text-left">
        <p className="font-bold text-slate-900">{item.ingredientCode} &middot; {item.ingredientName}</p>
        <p>{'Tồn hiện tại: '}{(snapshot.stock / snapshot.factor).toLocaleString('vi-VN', { maximumFractionDigits: 6 })} {unit}</p>
        <label className="block font-semibold">{'Tồn thực tế mới'} ({unit}) *
          <input className="mt-1 w-full rounded-lg border px-3 py-2" inputMode="decimal" value={quantity} disabled={saving} onChange={e => setQuantity(e.target.value)} />
        </label>
        <label className="block font-semibold">{'Lý do điều chỉnh'} *
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} maxLength={1000} value={reason} disabled={saving} onChange={e => setReason(e.target.value)} />
        </label>
        <p className="text-sm text-slate-500">{'Thay đổi được lưu thành phiếu kiểm kho kèm người sửa và lý do.'}</p>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
      </div>} />
  </>;
}
