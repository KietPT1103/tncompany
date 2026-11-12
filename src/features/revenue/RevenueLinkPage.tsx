import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { rememberRevenueToken } from './RevenueAccessGate';

export default function RevenueLinkPage() {
  const { link = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const timer = window.setTimeout(() => {
      controller.abort();
      setError('Mở trang quá lâu. Vui lòng thử lại.');
    }, 14000);
    apiRequest<{ token: string }>('/revenue-access.php', {
      method: 'POST',
      body: JSON.stringify({ link }),
      signal: controller.signal,
      referrerPolicy: 'no-referrer',
    }, false).then(result => {
      if (controller.signal.aborted) return;
      rememberRevenueToken(result.token);
      // Router state also permits this visit when browser storage is blocked.
      navigate('/doanh-thu', { replace: true, state: { revenueAccessToken: result.token } });
    }).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa mở được trang doanh thu.');
    }).finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [link, navigate, retry]);

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f5] p-4">
    <section className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <LockKeyhole className="h-7 w-7 text-emerald-700" aria-hidden="true" />
      <h1 className="text-xl font-bold text-slate-900">Xem doanh thu</h1>
      {error ? <>
        <p role="alert" className="text-sm text-rose-700">{error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Thử lại</button>
        <Link to="/doanh-thu" replace className="block text-sm font-semibold text-emerald-700 underline">Mở bằng mã doanh thu</Link>
      </> : <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />Đang mở trang doanh thu…</p>}
    </section>
  </main>;
}
