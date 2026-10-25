import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
type Result = {
  config: null | {
    url: string;
    sheetName: string;
    gid: string | null;
    lastSyncedAt: string | null;
    error: string | null;
  };
  stores: { id: string; name: string }[];
  report: {
    complete: boolean;
    days: { total: number | null; status: string; items: unknown[] }[];
  };
};
const input =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";
export default function OutsideExpensesPage() {
  const [month, setMonth] = useState(() =>
    new Date()
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
      .slice(0, 7),
  );
  const [storeId, setStoreId] = useState("cafe");
  const [url, setUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [gid, setGid] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    apiRequest<Result>(
      `/outside-expenses.php?month=${encodeURIComponent(month)}&storeId=${encodeURIComponent(storeId)}`,
    )
      .then((r) => {
        if (!active) return;
        setData(r);
        setUrl(r.config?.url || "");
        setSheetName(r.config?.sheetName || "");
        setGid(r.config?.gid || "");
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, storeId]);
  async function submit(method: "PUT" | "POST") {
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<Result>("/outside-expenses.php", {
        method,
        body: JSON.stringify({ month, storeId, url, sheetName, gid }),
        timeoutMs: 30000,
      });
      setData(r);
      if (r.config?.error) setError(r.config.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa đồng bộ được.");
    } finally {
      setBusy(false);
    }
  }
  const total =
    data?.report.days.reduce((sum, day) => sum + (day.total || 0), 0) || 0;
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Liên kết sheet chi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Chi ngoài POS · tự kiểm tra mỗi 30 phút
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          Tháng
          <input
            disabled={busy}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={input}
          />
        </label>
        <label className="space-y-1 text-sm">
          Quầy
          <select
            disabled={busy}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className={input}
          >
            {(data?.stores || [{ id: storeId, name: "Cà phê" }]).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit("PUT");
        }}
        className="space-y-4 rounded-2xl border bg-white p-4"
      >
        <label className="block space-y-1 text-sm">
          <span>Liên kết Google Sheet công khai</span>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={input}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Tên tab
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder={`Tổng chi T${Number(month.slice(5))}`}
              className={input}
            />
          </label>
          <label className="space-y-1 text-sm">
            gid (nếu có)
            <input
              inputMode="numeric"
              value={gid}
              onChange={(e) => setGid(e.target.value)}
              className={input}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Đọc ngày ở A, tiền chi ở B, ghi chú ở C. Có gid trong link thì dùng
          đúng tab đó.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || loading}
            className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : "Kiểm tra & lưu"}
          </button>
          <button
            type="button"
            disabled={busy || loading || !data?.config}
            onClick={() => submit("POST")}
            className="min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
          >
            Đồng bộ ngay
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Đang tải…</p>
        ) : (
          <section className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold">
              {data?.report.complete
                ? "Đã đồng bộ"
                : data?.config?.lastSyncedAt
                  ? "Dữ liệu cũ · cần đồng bộ lại"
                  : "Chưa có dữ liệu đã xác minh"}
            </p>
            {data?.config?.lastSyncedAt && (
              <>
                <p className="mt-1 text-slate-500">
                  Lần thành công: {data.config.lastSyncedAt}
                </p>
                <p className="mt-3 text-xl font-bold">
                  {total.toLocaleString("vi-VN")} ₫
                </p>
                <p className="text-slate-500">
                  {data.report.days.reduce((n, d) => n + d.items.length, 0)}{" "}
                  khoản chi
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
