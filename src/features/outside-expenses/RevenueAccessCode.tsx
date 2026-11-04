import { useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function RevenueAccessCode() {
  const [custom, setCustom] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function create(customCode?: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest<{ code: string }>('/revenue-access-code.php', { method: 'POST', body: JSON.stringify(customCode === undefined ? {} : { code: customCode }) });
      setCode(result.code); setCustom(''); setMessage('Đã lưu mã mới. Hãy sao chép để chia sẻ.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tạo được mã.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code); setMessage('Đã sao chép mã.'); }
    catch { setMessage('Hãy chọn mã bên dưới để sao chép.'); }
  }
  return <section aria-label="Mã xem doanh thu" className="space-y-3 rounded-2xl border bg-white p-4">
    <h2 className="font-semibold text-slate-900">Mã xem doanh thu</h2>
    <p className="text-sm text-slate-600">Người có mã có thể vào /doanh-thu mà không cần đăng nhập. Mã mới thay mã cũ; các thiết bị đã mở sẽ cần nhập lại.</p>
    <button type="button" disabled={busy} onClick={() => create()} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Tạo mã xem doanh thu ngẫu nhiên'}</button>
    <form onSubmit={e => { e.preventDefault(); create(custom); }} className="space-y-2">
      <label className="block text-sm text-slate-700">Hoặc tự đặt mã
        <input required minLength={6} maxLength={64} autoComplete="new-password" autoCapitalize="none" spellCheck={false} value={custom} onChange={e => setCustom(e.target.value)} disabled={busy} placeholder="Mã từ 6 đến 64 ký tự" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
      </label>
      <button disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50">Lưu mã tự nhập</button>
    </form>
    <div aria-live="polite" className="space-y-2">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-800">{message}</p>}
      {code && <div className="space-y-2 rounded-xl bg-emerald-50 p-3">
        <p className="text-xs text-slate-600">Mã vừa lưu · chỉ hiển thị tại đây đến khi tải lại trang</p>
        <code className="block break-all text-lg font-bold text-emerald-900 select-all">{code}</code>
        <button type="button" onClick={copy} className="min-h-11 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold">Sao chép mã</button>
      </div>}
    </div>
  </section>;
}
