"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export default function PayrollSettingsDialog({
  fixedSalary,
  onClose,
  onFixedSalaryChange,
  onSave,
  onSalaryTypeChange,
  onStandardHoursChange,
  salaryType,
  standardHours,
}: {
  fixedSalary: number;
  onClose: () => void;
  onFixedSalaryChange: (value: number) => void;
  onSave: () => void;
  onSalaryTypeChange: (value: "hourly" | "fixed") => void;
  onStandardHoursChange: (value: number) => void;
  salaryType: "hourly" | "fixed";
  standardHours: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cấu hình lương</h3>
            <p className="mt-1 text-sm text-slate-500">Chọn cách tính cho nhân viên hiện tại.</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[24px] bg-slate-100 p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onSalaryTypeChange("hourly")}
                className={cn(
                  "rounded-[20px] px-4 py-3 text-sm font-semibold transition",
                  salaryType === "hourly"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500"
                )}
              >
                Theo giờ
              </button>
              <button
                onClick={() => onSalaryTypeChange("fixed")}
                className={cn(
                  "rounded-[20px] px-4 py-3 text-sm font-semibold transition",
                  salaryType === "fixed"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500"
                )}
              >
                Cố định
              </button>
            </div>
          </div>

          {salaryType === "fixed" ? (
            <>
              <InputMoney
                label="Lương cứng"
                value={fixedSalary}
                set={onFixedSalaryChange}
                className="h-11 rounded-2xl bg-slate-50"
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Định mức giờ
                </label>
                <input
                  type="number"
                  value={standardHours}
                  onChange={(event) => onStandardHoursChange(Number(event.target.value) || 0)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-right outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 no-spin"
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>
            Hủy
          </Button>
          <Button className="rounded-2xl" onClick={onSave}>
            Lưu cấu hình
          </Button>
        </div>
      </div>
    </div>
  );
}
