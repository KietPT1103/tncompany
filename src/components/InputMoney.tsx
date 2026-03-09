import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type InputMoneyProps = {
  label?: string;
  set: (value: number) => void;
  value?: number;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function InputMoney({
  label,
  set,
  value,
  className,
  placeholder = "0",
  autoFocus
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
    
    // Only allow numbers
    if (!/^\d*$/.test(rawValue)) return;

    const num = Number(rawValue);
    if (!isNaN(num)) {
      set(num);
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={formatValue(value)}
          onChange={handleChange}
          autoFocus={autoFocus}
          className={cn(
            "text-right font-mono pr-8 text-base", 
            "focus-visible:ring-primary/20 focus-visible:border-primary",
            className
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">đ</span>
      </div>
    </div>
  );
}
