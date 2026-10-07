import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { parseMoneyInput } from "./dailyProfit";
export function AmountInput({ id, value, onChange, label }: { id: string; value: number | null; onChange: (value: number | null) => void; label: string }) {
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  useEffect(() => { if (parseMoneyInput(raw) !== value) setRaw(value === null ? "" : String(value)); }, [value]);
  const invalid = raw !== "" && parseMoneyInput(raw) === null;
  return <div>
    <div className="relative"><Input id={id} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      type="text" inputMode="decimal" required placeholder="Nhập số tiền" value={raw} className="min-w-0 rounded-sm border-slate-200 bg-white pr-12 text-slate-900 tabular-nums hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 focus-visible:ring-offset-0"
      onChange={event => { setRaw(event.target.value); onChange(parseMoneyInput(event.target.value)); }} />
      <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-500">VND</span></div>
    {invalid && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">Nhập số không âm, tối đa 1.000 tỷ.</p>}
  </div>;
}

