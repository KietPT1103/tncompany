import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type InputMoneyProps = {
  label?: string;
  set: (value: number) => void;
  value?: number;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
};

export default function InputMoney({
  label,
  set,
  value,
  className,
  placeholder = "0",
  autoFocus,
  onBlur,
}: InputMoneyProps) {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return "";
    return val === 0 ? "" : val.toLocaleString("en-US");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "");
    if (rawValue === "") {
      set(0);
      return;
    }

    if (!/^\d*$/.test(rawValue)) return;

    const num = Number(rawValue);
    if (!isNaN(num)) {
      set(num);
    }
  };

  return (
    <div className="w-full space-y-1.5">
      {label ? (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      ) : null}
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={formatValue(value)}
          onChange={handleChange}
          autoFocus={autoFocus}
          onBlur={onBlur}
          className={cn(
            "pr-8 text-right font-mono text-base",
            "focus-visible:border-primary focus-visible:ring-primary/20",
            className
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-slate-400">
          đ
        </span>
      </div>
    </div>
  );
}
