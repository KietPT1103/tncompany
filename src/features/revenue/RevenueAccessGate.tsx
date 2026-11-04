import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';

const storageKey = 'tn_revenue_access_token';
const readToken = () => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } };
const remember = (token: string) => { try { if (token) localStorage.setItem(storageKey, token); else localStorage.removeItem(storageKey); } catch { /* Still allow this visit when browser storage is unavailable. */ } };
export const revenueHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function RevenueAccessGate({ children }: { children: (token: string, lock: () => void) => ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [state, setState] = useState<'checking' | 'locked' | 'open'>(() => readToken() ? 'checking' : 'locked');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useCallback(() => {
    remember(''); setToken(''); setCode(''); setState('locked'); setError('Vui lòng nhập lại mã xem doanh thu.');
  }, []);
  useEffect(() => {
    if (state !== 'checking') return;
    const controller = new AbortController();
    setError('');
    const timer = window.setTimeout(() => {
      controller.abort();
      setError('Kiểm tra quá lâu. Vui lòng thử lại.');
    }, 14000);
    apiRequest<{ unlocked: boolean }>('/revenue-access.php', { headers: revenueHeaders(token), signal: controller.signal }, false)
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.unlocked) setState('open'); else lock();
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa kiểm tra được mã.'); })
      .finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [token, state, retry, lock]);
  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiRequest<{ token: string }>('/revenue-access.php', { method: 'POST', body: JSON.stringify({ code }) }, false);
      remember(result.token); setToken(result.token); setCode(''); setState('open');
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa mở được trang.'); }
    finally { setBusy(false); }
  }
  if (state === 'open') return <>{children(token, lock)}</>;
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f5] p-4">
    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <LockKeyhole className="mb-4 h-7 w-7 text-emerald-700" aria-hidden="true" />
      <h1 className="text-xl font-bold text-slate-900">Xem doanh thu</h1>
      {state === 'checking' ? <div className="mt-4 space-y-3">
        {!error && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><RefreshCw className="h-4 w-4 animate-spin" />Đang kiểm tra quyền truy cập…</p>}
        {error && <><p role="alert" className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => setRetry(v => v + 1)} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Thử lại</button></>}
      </div> : <form onSubmit={unlock} className="mt-4 space-y-4">
        <p className="text-sm text-slate-600">Nhập mã được chia sẻ để mở trang. Trình duyệt sẽ ghi nhớ cho những lần sau.</p>
        <label className="block text-sm font-semibold text-slate-700">Mã xem doanh thu
          <input autoFocus required type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false} maxLength={64} value={code} onChange={e => setCode(e.target.value)} disabled={busy} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button disabled={busy} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang mở…' : 'Mở trang doanh thu'}</button>
      </form>}
    </section>
  </main>;
}
