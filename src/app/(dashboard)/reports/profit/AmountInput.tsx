import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { formatProfitMoneyInput, normalizeProfitMoneyInput, parseMoneyInput } from "./dailyProfit";
export function AmountInput({ id, value, onChange, label, required = true }: { id: string; value: number | null; onChange: (value: number | null) => void; label: string; required?: boolean }) {
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useEffect(() => { if (parseMoneyInput(raw) !== value) setRaw(value === null ? "" : String(value)); }, [value]);
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    const position = pendingCaret.current;
    inputRef.current.setSelectionRange(position, position);
    pendingCaret.current = null;
  });
  const invalid = raw !== "" && parseMoneyInput(raw) === null;
  return <div>
    <div className="relative"><Input ref={inputRef} id={id} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      type="text" inputMode="decimal" required={required} placeholder="Nhập số tiền" value={formatProfitMoneyInput(raw)} className="min-w-0 rounded-sm border-slate-200 bg-white pr-12 text-slate-900 tabular-nums hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 focus-visible:ring-offset-0"
      onChange={event => {
        const display = event.target.value;
        const nextRaw = normalizeProfitMoneyInput(display);
        const logicalPosition = display.slice(0, event.target.selectionStart ?? display.length).replace(/\./g, '').length;
        const formatted = formatProfitMoneyInput(nextRaw);
        let position = 0;
        let characters = 0;
        while (position < formatted.length && characters < logicalPosition) {
          if (formatted[position] !== '.') characters++;
          position++;
        }
        pendingCaret.current = position;
        setRaw(nextRaw);
        onChange(!required && nextRaw === "" ? 0 : parseMoneyInput(nextRaw));
      }} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">VND</span></div>
    {invalid && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">Nhập số không âm, tối đa 1.000 tỷ.</p>}
  </div>;
}

