"use client";

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Box,
  ReceiptText,
  Save,
  WalletCards,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type OperatingCostPanelProps = {
  electric: number;
  isSaving: boolean;
  materialCost: number;
  onElectricChange: (value: number) => void;
  onOtherChange: (value: number) => void;
  onSalaryChange: (value: number) => void;
  onSave: () => void;
  other: number;
  revenue: number;
  salary: number;
};

type MoneyFieldProps = {
  icon: LucideIcon;
  id: string;
  label: string;
  onChange: (value: number) => void;
  tone: "emerald" | "amber" | "rose";
  value: number;
};

type CostBreakdownItem = {
  colorClass: string;
  icon: LucideIcon;
  label: string;
  value: number;
};

const toneClasses: Record<MoneyFieldProps["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatInputValue = (value: number) =>
  value > 0 ? value.toLocaleString("vi-VN") : "";

const parseInputValue = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

const formatPercent = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

function MoneyField({
  icon: Icon,
  id,
  label,
  onChange,
  tone,
  value,
}: MoneyFieldProps) {
  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.9fr)] sm:items-center">
      <label htmlFor={id} className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
            toneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </label>

      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatInputValue(value)}
          onChange={(event) => onChange(parseInputValue(event.target.value))}
          placeholder="0"
          className="h-11 rounded-md border-slate-200 bg-white px-3 pr-9 text-right font-mono text-sm font-semibold tabular-nums text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
          đ
        </span>
      </div>
    </div>
  );
}

export default function OperatingCostPanel({
  electric,
  isSaving,
  materialCost,
  onElectricChange,
  onOtherChange,
  onSalaryChange,
  onSave,
  other,
  revenue,
  salary,
}: OperatingCostPanelProps) {
  const operatingCost = salary + electric + other;
  const totalCost = materialCost + operatingCost;
  const revenuePercent = revenue > 0 ? (totalCost / revenue) * 100 : 0;
  const breakdown: CostBreakdownItem[] = [
    {
      label: "Nguyên liệu (COGS)",
      value: materialCost,
      icon: Box,
      colorClass: "bg-sky-500",
    },
    {
      label: "Lương nhân viên",
      value: salary,
      icon: Banknote,
      colorClass: "bg-emerald-500",
    },
    {
      label: "Điện / Nước / Net",
      value: electric,
      icon: Zap,
      colorClass: "bg-amber-500",
    },
    {
      label: "Chi phí khác",
      value: other,
      icon: ReceiptText,
      colorClass: "bg-rose-500",
    },
  ];

  return (
    <section
      aria-labelledby="operating-cost-title"
      className="overflow-hidden rounded-lg bg-white shadow-[6px_8px_14px_rgba(6,78,59,0.22)] ring-1 ring-slate-200/80"
    >
      <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-emerald-700 text-[#ECBE40] ring-1 ring-inset ring-emerald-600"
        >
          <WalletCards className="h-5 w-5" />
        </span>
        <h2
          id="operating-cost-title"
          className="text-base font-semibold text-slate-950"
        >
          Chi phí vận hành
        </h2>
      </header>

      <div className="divide-y divide-slate-100 px-4 sm:px-5">
        <MoneyField
          id="operating-cost-salary"
          icon={Banknote}
          label="Lương nhân viên"
          value={salary}
          onChange={onSalaryChange}
          tone="emerald"
        />
        <MoneyField
          id="operating-cost-utilities"
          icon={Zap}
          label="Điện / Nước / Net"
          value={electric}
          onChange={onElectricChange}
          tone="amber"
        />
        <MoneyField
          id="operating-cost-other"
          icon={ReceiptText}
          label="Chi phí khác"
          value={other}
          onChange={onOtherChange}
          tone="rose"
        />
      </div>

      <div className="border-t border-slate-200 px-4 py-5 sm:px-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Cơ cấu chi phí
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Tỷ trọng trên tổng chi phí
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-slate-500 tabular-nums">
            {formatMoney(totalCost)}
          </span>
        </div>

        <div className="space-y-4">
          {breakdown.map((item) => {
            const share = totalCost > 0 ? (item.value / totalCost) * 100 : 0;
            const Icon = item.icon;

            return (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                    <Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-slate-500"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <strong className="font-semibold text-slate-900">
                      {formatMoney(item.value)}
                    </strong>
                    <span className="w-10 text-right text-slate-500">
                      {formatPercent(share)}%
                    </span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Tỷ trọng ${item.label}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(share.toFixed(1))}
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className={cn(
                      "h-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none",
                      item.colorClass,
                    )}
                    style={{ transform: `scaleX(${Math.min(share, 100) / 100})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-slate-600">Chi phí vận hành</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">
              {formatMoney(operatingCost)}
            </dd>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-3">
            <dt>
              <span className="block text-sm font-semibold text-slate-950">
                Tổng chi phí
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">
                {formatPercent(revenuePercent)}% doanh thu
              </span>
            </dt>
            <dd className="text-lg font-bold text-slate-950 tabular-nums">
              {formatMoney(totalCost)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
        <Button
          type="button"
          onClick={onSave}
          isLoading={isSaving}
          className="h-11 w-full rounded-md bg-emerald-700 text-sm font-semibold text-white shadow-[0_2px_6px_rgba(4,120,87,0.22)] transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:transition-none"
        >
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          Lưu báo cáo
        </Button>
      </div>
    </section>
  );
}
