import { useState } from "react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SelectBox } from "@/components/ui/SelectBox";
import { inventoryPeriodRange, type InventoryPeriod } from "@/lib/inventoryPeriods";
const options = [
  { value: "today", label: "Hôm nay" }, { value: "yesterday", label: "Hôm qua" },
  { value: "week", label: "Tuần qua" }, { value: "month", label: "Tháng này" },
  { value: "previousMonth", label: "Tháng trước" }, { value: "custom", label: "Khoảng ngày" },
];
export function InventoryDateFilter({ from, to, onChange, disabled = false, className = "" }: { from: string; to: string; onChange: (from: string, to: string) => void; disabled?: boolean; className?: string }) {
  const [custom, setCustom] = useState(false);
  const selected = custom ? "custom" : options.find(option => { if (option.value === "custom") return false; const range = inventoryPeriodRange(option.value as InventoryPeriod); return range.from === from && range.to === to; })?.value || "custom";
  return <div className={"flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto " + className}>
    <label className="w-full min-w-0 max-w-full space-y-1 sm:w-36"><span className="text-sm font-medium text-slate-700">Thời gian</span><SelectBox ariaLabel="Lọc thời gian" value={selected} options={options} disabled={disabled} className="w-full" onValueChange={value => { setCustom(value === "custom"); if (value === "custom") return; const range = inventoryPeriodRange(value as InventoryPeriod); onChange(range.from, range.to); }}/></label>
    <DateRangePicker className="w-full max-w-full sm:w-72" label="Khoảng ngày" startDate={from} endDate={to} onChange={(start,end)=>{setCustom(true);onChange(start,end)}} disabled={disabled}/>
  </div>;
}
