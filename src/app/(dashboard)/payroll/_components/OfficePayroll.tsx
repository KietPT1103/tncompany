import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiRequest } from "@/lib/api";

const currency = new Intl.NumberFormat("vi-VN");

export function OfficePayroll({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);

  return (
    <section aria-labelledby="office-payroll-heading" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h2 id="office-payroll-heading" className="text-lg font-bold text-slate-950">Lương văn phòng</h2>
        <p className="text-sm text-slate-600">Quỹ lương tháng của toàn công ty. Chi phí được chia theo số ngày trong tháng và cộng vào lương nhân viên trên báo cáo Cà phê.</p>
      </div>
      <div className="max-w-xs">
        <Input label="Tháng lương" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      {/^\d{4}-\d{2}$/.test(month) && <OfficePayrollAmount key={month} month={month} />}
    </section>
  );
}

function OfficePayrollAmount({ month }: { month: string }) {
  const endpoint = `/office-payroll.php?month=${encodeURIComponent(month)}`;
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ amount: number | null }>(endpoint)
      .then((data) => {
        if (!active) return;
        setSaved(data.amount);
        setAmount(data.amount === null ? "" : currency.format(data.amount));
        setLoaded(true);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : "Không tải được lương văn phòng.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || saving) return;
    const digits = amount.trim().replace(/\./g, "");
    const value = Number(digits);
    setStatus("");
    setError("");
    if (!/^\d+$/.test(digits) || !Number.isSafeInteger(value) || value > 1_000_000_000_000) {
      setError("Nhập số tiền nguyên từ 0 đến 1.000.000.000.000 đồng.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ amount: number }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ amount: value }),
      });
      setSaved(data.amount);
      setAmount(currency.format(data.amount));
      setStatus("Đã lưu lương văn phòng.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không lưu được lương văn phòng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input label="Tổng lương tháng (đ)" inputMode="numeric" value={amount} disabled={!loaded || saving}
            onChange={(event) => { setAmount(event.target.value); setStatus(""); }} />
        </div>
        <Button type="submit" disabled={!loaded || saving}>{saving ? "Đang lưu…" : "Lưu lương văn phòng"}</Button>
      </div>
      <p role="status" className="text-sm text-slate-600">
        {loading ? "Đang tải…" : status || (loaded && saved === null ? "Tháng này chưa có số liệu." : "")}
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
