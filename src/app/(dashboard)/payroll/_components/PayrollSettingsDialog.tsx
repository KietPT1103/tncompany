"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export default function PayrollSettingsDialog({
  monthlySalary,
  expectedWorkDays,
  onClose,
  onExpectedWorkDaysChange,
  onMonthlySalaryChange,
  onOvertimeRateChange,
  onPaidLeaveDaysChange,
  onSave,
  onSalaryTypeChange,
  onStandardHoursChange,
  overtimeRate,
  paidLeaveDays,
  salaryType,
  standardHours,
}: {
  monthlySalary: number;
  expectedWorkDays: number;
  onClose: () => void;
  onExpectedWorkDaysChange: (value: number) => void;
  onMonthlySalaryChange: (value: number) => void;
  onOvertimeRateChange: (value: number) => void;
  onPaidLeaveDaysChange: (value: number) => void;
  onSave: () => void;
  onSalaryTypeChange: (value: "hourly" | "monthly") => void;
  onStandardHoursChange: (value: number) => void;
  overtimeRate: number;
  paidLeaveDays: number;
  salaryType: "hourly" | "monthly";
  standardHours: number;
}) {
  const resolvedExpectedWorkDays = expectedWorkDays || 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cấu hình lương</h3>
            <p className="mt-1 text-sm text-slate-500">Chọn cách tính lương cho nhân viên hiện tại.</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[24px] bg-slate-100 p-1">
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => onSalaryTypeChange("hourly")} className={cn("rounded-[20px] px-4 py-3 text-sm font-semibold transition", salaryType === "hourly" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500")}>
                Theo giờ
              </button>
              <button onClick={() => onSalaryTypeChange("monthly")} className={cn("rounded-[20px] px-4 py-3 text-sm font-semibold transition", salaryType === "monthly" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")}>
                Lương tháng
              </button>
            </div>
          </div>

          {salaryType === "monthly" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <InputMoney label="Lương cứng" value={monthlySalary} set={onMonthlySalaryChange} className="h-11 rounded-2xl bg-slate-50" />
              <Input type="number" label="Số ngày phải đi làm trong tháng" value={resolvedExpectedWorkDays} onChange={(event) => onExpectedWorkDaysChange(Number(event.target.value) || 30)} className="h-11 rounded-2xl bg-slate-50 text-right" />
              <Input type="number" label="Nghỉ phép được tính lương" value={paidLeaveDays || ""} onChange={(event) => onPaidLeaveDaysChange(Number(event.target.value) || 0)} className="h-11 rounded-2xl bg-slate-50 text-right" />
              <Input type="number" label="Số giờ cần làm" value={standardHours || ""} onChange={(event) => onStandardHoursChange(Number(event.target.value) || 0)} className="h-11 rounded-2xl bg-slate-50 text-right" />
              <InputMoney label="Lương OT / giờ" value={overtimeRate} set={onOvertimeRateChange} className="h-11 rounded-2xl bg-slate-50" />
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Mặc định số ngày phải đi làm là 30. Nếu tổng giờ làm vượt mốc giờ cần làm thì phần vượt sẽ được cộng thêm theo lương OT / giờ.
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Nhân viên theo giờ dùng tổng giờ làm, giờ cuối tuần và phụ cấp để tính lương như hiện tại.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>Hủy</Button>
          <Button className="rounded-2xl" onClick={onSave}>Lưu cấu hình</Button>
        </div>
      </div>
    </div>
  );
}
