import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type ResultTableProps = {
  revenue: number;
  materialCost: number;
  salary: number;
  electric: number;
  other: number;
  isEditing?: boolean;
  onUpdate?: (field: string, value: number) => void;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);

const parseMoneyInput = (value: string) => {
  const rawValue = value.replace(/[^\d]/g, "");
  return rawValue ? Number(rawValue) : 0;
};

const formatInput = (value: number) => (value > 0 ? value.toLocaleString("en-US") : "");

export default function ResultTable({
  revenue,
  materialCost,
  salary,
  electric,
  other,
  isEditing = false,
  onUpdate,
}: ResultTableProps) {
  const totalCost = materialCost + salary + electric + other;

  const percent = (value: number) =>
    revenue ? ((value / revenue) * 100).toFixed(1) : "0";

  const ProgressRow = ({
    label,
    value,
    colorClass,
    field,
    editable = false,
  }: {
    label: string;
    value: number;
    colorClass: string;
    field?: string;
    editable?: boolean;
  }) => {
    const p = parseFloat(percent(value));

    return (
      <div className="space-y-2">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-slate-600">{label}</span>
          {isEditing && editable && field && onUpdate ? (
            <div className="w-full sm:w-56">
              <Input
                value={formatInput(value)}
                onChange={(event) => onUpdate(field, parseMoneyInput(event.target.value))}
                inputMode="numeric"
                className="text-right font-mono"
                placeholder="0"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{formatMoney(value)}</span>
              <span className="w-12 text-right text-xs text-slate-400">({p}%)</span>
            </div>
          )}
        </div>
        {isEditing && editable ? (
          <div className="text-right text-xs text-slate-400">({p}%)</div>
        ) : null}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full", colorClass)}
            style={{ width: `${Math.min(p, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full overflow-hidden border-0 bg-transparent shadow-none ring-0">
      <CardHeader className="px-0 pb-4 pt-0">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Phan tich chi phi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        {isEditing && onUpdate ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Doanh thu
            </div>
            <Input
              value={formatInput(revenue)}
              onChange={(event) => onUpdate("revenue", parseMoneyInput(event.target.value))}
              inputMode="numeric"
              className="text-right text-lg font-bold"
              placeholder="0"
            />
          </div>
        ) : null}

        <div className="space-y-5">
          <ProgressRow
            label="Chi phi nguyen lieu (COGS)"
            value={materialCost}
            colorClass="bg-blue-500"
          />
          <ProgressRow
            label="Luong nhan vien"
            value={salary}
            colorClass="bg-purple-500"
            field="salary"
            editable={true}
          />
          <ProgressRow
            label="Dien / Nuoc / Net"
            value={electric}
            colorClass="bg-amber-500"
            field="electric"
            editable={true}
          />
          <ProgressRow
            label="Chi phi khac"
            value={other}
            colorClass="bg-rose-500"
            field="other"
            editable={true}
          />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600">Tong chi phi van hanh</span>
            <span className="text-lg font-bold text-slate-900">{formatMoney(totalCost)}</span>
          </div>
          <div className="mt-1 text-right">
            <span className="text-xs text-slate-400">{percent(totalCost)}% doanh thu</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
