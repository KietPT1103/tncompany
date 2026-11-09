import { useEffect, useRef, useState, type FormEvent } from "react";
import { Coins, Info, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiRequest } from "@/lib/api";

const currency = new Intl.NumberFormat("vi-VN");

export function OfficePayroll({ initialMonth, onClose, onSaved }: {
  initialMonth: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="office-payroll-heading"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-950/55">
      <div className="space-y-5 p-5 sm:p-7">
        <header className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700"><Coins aria-hidden="true" className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="office-payroll-heading" className="text-xl font-bold tracking-tight text-slate-950">Lương văn phòng</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Nhập quỹ lương tháng của toàn công ty do Cà phê chi trả.</p>
          </div>
          <Button type="button" variant="outline" aria-label="Đóng" className="size-9 shrink-0 p-0" onClick={() => dialog.current?.close()}><X className="size-4" /></Button>
        </header>
        <Input label="Tháng lương" type="month" required value={month}
          className="h-11 rounded-xl border-sky-200 bg-slate-50"
          onChange={(event) => setMonth(event.target.value)} />
        {/^\d{4}-\d{2}$/.test(month) && <OfficePayrollAmount key={month} month={month}
          onCancel={() => dialog.current?.close()} onSaved={() => {
            onSaved();
            dialog.current?.close();
          }} />}
      </div>
    </dialog>
  );
}

export function OfficePayrollOverview({ month, revision, onEdit }: { month: string; revision: number; onEdit: () => void }) {
  const [summary, setSummary] = useState<{ amount: number | null } | "error" | null>(null);
  useEffect(() => {
    let active = true;
    apiRequest<{ amount: number | null }>(`/office-payroll.php?month=${encodeURIComponent(month)}`)
      .then((data) => { if (active) setSummary(data); })
      .catch(() => { if (active) setSummary("error"); });
    return () => { active = false; };
  }, [month, revision]);

  const amount = summary && summary !== "error" ? summary.amount : null;
  const monthLabel = `${month.slice(5)}/${month.slice(0, 4)}`;
  return (
    <button type="button" onClick={onEdit} aria-label={`Nhập lương văn phòng tháng ${monthLabel}`}
      className="flex w-52 shrink-0 snap-start flex-col rounded-xl border border-sky-200 bg-sky-50 px-3 pb-4 pt-3 text-left text-slate-950 hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-700">
      <span className="flex min-h-9 items-center gap-2 text-xs font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-700"><Coins className="size-4" aria-hidden="true" /></span>
        Văn phòng
      </span>
      <span className="mt-2 text-xs text-slate-600">Tổng tháng {monthLabel}</span>
      <span className="mb-3 mt-0.5 font-bold tabular-nums">
        {amount !== null ? `${currency.format(amount)} đ` : summary === "error" ? "Không tải được" : summary ? "Chưa nhập" : "Đang tải…"}
      </span>
      <span className="mt-auto border-t border-sky-200 pt-2 text-xs text-slate-700">
        {amount === null ? "Bấm để nhập hoặc xem lại" : `${currency.format(Math.round(amount / 30))} đ/ngày (chia 30)`}
      </span>
    </button>
  );
}

function OfficePayrollAmount({ month, onCancel, onSaved }: { month: string; onCancel: () => void; onSaved: () => void }) {
  const endpoint = `/office-payroll.php?month=${encodeURIComponent(month)}`;
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không lưu được lương văn phòng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Input label="Tổng lương tháng (đ)" inputMode="numeric" value={amount} disabled={!loaded || saving}
        className="h-11 rounded-xl border-sky-200 bg-slate-50 tabular-nums"
        onChange={(event) => setAmount(event.target.value)} />
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden="true" />
        <p>Thẻ tổng quan hiển thị mức quy đổi theo 30 ngày. Báo cáo Cà phê phân bổ theo số ngày thực tế trong tháng.</p>
      </div>
      <p role="status" className="text-sm text-slate-600">
        {loading ? "Đang tải…" : loaded && saved === null ? "Tháng này chưa có số liệu." : ""}
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Hủy</Button>
        <Button type="submit" disabled={!loaded || saving} className="bg-sky-800 text-white hover:bg-sky-900">{saving ? "Đang lưu…" : "Lưu lương văn phòng"}</Button>
      </div>
    </form>
  );
}
