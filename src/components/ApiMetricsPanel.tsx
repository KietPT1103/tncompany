import { useState } from "react";
import { apiRequest } from "@/lib/api";

type Metrics = {
  enabled: boolean;
  peakPerMinute?: number;
  rows?: { route: string; method: string; requests: number; errors4xx: number; errors5xx: number; avgMs: number; slow: number; maxMs: number }[];
};

export default function ApiMetricsPanel() {
  const [minutes, setMinutes] = useState(60);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(false);
    setMetrics(null);
    try {
      setMetrics(await apiRequest<Metrics>(`/api-metrics.php?minutes=${minutes}`));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Lưu lượng API</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Khoảng thời gian thống kê" className="rounded border px-3 py-2" value={minutes}
          disabled={loading} onChange={event => { setMinutes(Number(event.target.value)); setMetrics(null); }}>
          <option value={15}>15 phút gần nhất</option>
          <option value={60}>1 giờ gần nhất</option>
          <option value={360}>6 giờ gần nhất</option>
        </select>
        <button className="rounded border px-3 py-2" disabled={loading} onClick={() => void refresh()}>
          {loading ? "Đang tải…" : "Xem thống kê"}
        </button>
      </div>
      {error && <p role="alert">Không tải được thống kê. Mục này yêu cầu tài khoản quản trị.</p>}
      {metrics && !metrics.enabled && <p>Chưa bật thu thập số liệu API.</p>}
      {metrics?.enabled && (
        <>
          <p>Đỉnh lưu lượng {metrics.peakPerMinute} request/phút.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr>{["API", "Request", "Lỗi 4xx", "Lỗi 5xx", "TB (ms)", "Trên 2 giây", "Chậm nhất (ms)"]
                .map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
              <tbody>{metrics.rows?.map(row => (
                <tr key={`${row.method} ${row.route}`} className="border-t">
                  {[row.method + " " + row.route, row.requests, row.errors4xx, row.errors5xx, row.avgMs, row.slow, row.maxMs]
                    .map((value, index) => <td key={index} className="p-2">{value}</td>)}
                </tr>
              ))}</tbody>
            </table>
            {!metrics.rows?.length && <p>Chưa có request được ghi trong khoảng này.</p>}
          </div>
        </>
      )}
    </section>
  );
}
