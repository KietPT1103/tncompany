"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Employee, EmployeeAllowance } from "@/services/employees.firebase";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmployeeSalaryFormValues = {
  employeeCode: string;
  name: string;
  role: string;
  salaryType: "hourly" | "monthly";
  hourlyRate: number;
  monthlySalary: number;
  expectedWorkDays: number;
  paidLeaveDays: number;
  attendanceBonusEnabled: boolean;
  attendanceBonusDays: number;
  attendanceBonusAmount: number;
  standardHours: number;
  allowances: EmployeeAllowance[];
};

export function resolveEmployeeSalaryType(employee?: Partial<Employee>) {
  if (employee?.salaryType === "monthly") return "monthly";
  if (employee?.salaryType === "hourly") return "hourly";

  const hasMonthlySignals =
    (employee?.monthlySalary || 0) > 0 ||
    (employee?.expectedWorkDays || 0) > 0 ||
    (employee?.standardHours || 0) > 0;

  return hasMonthlySignals ? "monthly" : "hourly";
}

export function createEmployeeSalaryFormValues(
  defaultRole: string,
  employee?: Partial<Employee>
): EmployeeSalaryFormValues {
  const salaryType = resolveEmployeeSalaryType(employee);

  return {
    employeeCode: employee?.employeeCode || "",
    name: employee?.name || "",
    role: employee?.role || defaultRole,
    salaryType,
    hourlyRate: employee?.hourlyRate || 0,
    monthlySalary: salaryType === "monthly" ? employee?.monthlySalary || 0 : 0,
    expectedWorkDays:
      salaryType === "monthly" ? employee?.expectedWorkDays || 30 : 30,
    paidLeaveDays: salaryType === "monthly" ? employee?.paidLeaveDays || 0 : 0,
    attendanceBonusEnabled: employee?.attendanceBonusEnabled || false,
    attendanceBonusDays: employee?.attendanceBonusDays || 0,
    attendanceBonusAmount: employee?.attendanceBonusAmount || 0,
    standardHours: salaryType === "monthly" ? employee?.standardHours || 0 : 0,
    allowances: employee?.allowances || [],
  };
}

export function buildEmployeeMutationPayload(values: EmployeeSalaryFormValues) {
  const isMonthly = values.salaryType === "monthly";

  return {
    employeeCode: values.employeeCode.trim(),
    name: values.name.trim(),
    role: values.role,
    hourlyRate: values.hourlyRate,
    salaryType: values.salaryType,
    monthlySalary: isMonthly ? values.monthlySalary : 0,
    expectedWorkDays: isMonthly ? values.expectedWorkDays || 30 : 0,
    paidLeaveDays: isMonthly ? values.paidLeaveDays : 0,
    attendanceBonusEnabled: values.attendanceBonusEnabled,
    attendanceBonusDays: values.attendanceBonusEnabled
      ? values.attendanceBonusDays
      : 0,
    attendanceBonusAmount: values.attendanceBonusEnabled
      ? values.attendanceBonusAmount
      : 0,
    standardHours: isMonthly ? values.standardHours : 0,
    allowances: (values.allowances || []).map((allowance) => ({
      name: allowance.name.trim(),
      amount: allowance.amount || 0,
      period: allowance.period || "all",
    })),
  };
}

export function validateEmployeeSalaryForm(values: EmployeeSalaryFormValues) {
  if (!values.employeeCode.trim() || !values.name.trim()) {
    return "Vui lòng nhập mã nhân viên và tên nhân viên.";
  }

  if (values.salaryType === "monthly") {
    if (!values.monthlySalary) {
      return "Vui lòng nhập lương tháng.";
    }
    return "";
  }

  if (!values.hourlyRate) {
    return "Vui lòng nhập lương theo giờ.";
  }

  return "";
}

export default function EmployeeSalaryFields({
  roleGroups,
  values,
  onChange,
  className,
}: {
  roleGroups: Record<string, string[]>;
  values: EmployeeSalaryFormValues;
  onChange: (changes: Partial<EmployeeSalaryFormValues>) => void;
  className?: string;
}) {
  const isMonthly = values.salaryType === "monthly";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Mã nhân viên (EnNo)
          </label>
          <Input
            value={values.employeeCode}
            onChange={(event) => onChange({ employeeCode: event.target.value })}
            placeholder="Ví dụ: 00125"
            className="h-11 rounded-2xl"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tên nhân viên
          </label>
          <Input
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Ví dụ: Nguyễn Văn A"
            className="h-11 rounded-2xl"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Vai trò
          </label>
          <select
            value={values.role}
            onChange={(event) => onChange({ role: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            {Object.entries(roleGroups).map(([group, roles]) => (
              <optgroup key={group} label={group}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 md:self-end">
          <input
            type="checkbox"
            checked={isMonthly}
            onChange={(event) =>
              onChange({
                salaryType: event.target.checked ? "monthly" : "hourly",
                expectedWorkDays:
                  event.target.checked ? values.expectedWorkDays || 30 : values.expectedWorkDays,
              })
            }
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm font-semibold text-slate-900">Lương tháng</div>
            <p className="text-xs text-slate-500">
              Bật để nhập cấu hình nhân sự full tháng.
            </p>
          </div>
        </label>
      </div>

      {isMonthly ? (
        <div className="grid gap-4 md:grid-cols-2">
          <InputMoney
            label="Lương tháng"
            value={values.monthlySalary}
            set={(value) => onChange({ monthlySalary: value })}
            className="h-11 rounded-2xl bg-slate-50"
          />
          <Input
            type="number"
            label="Số ngày phải đi làm trong tháng"
            value={values.expectedWorkDays || ""}
            onChange={(event) =>
              onChange({ expectedWorkDays: Number(event.target.value) || 0 })
            }
            className="h-11 rounded-2xl bg-slate-50 text-right"
          />
          <Input
            type="number"
            label="Nghỉ phép được tính lương"
            value={values.paidLeaveDays || ""}
            onChange={(event) =>
              onChange({ paidLeaveDays: Number(event.target.value) || 0 })
            }
            className="h-11 rounded-2xl bg-slate-50 text-right"
          />
          <Input
            type="number"
            label="Số giờ cần làm"
            value={values.standardHours || ""}
            onChange={(event) =>
              onChange({ standardHours: Number(event.target.value) || 0 })
            }
            className="h-11 rounded-2xl bg-slate-50 text-right"
          />
          <InputMoney
            label="Lương OT / giờ"
            value={values.hourlyRate}
            set={(value) => onChange({ hourlyRate: value })}
            className="h-11 rounded-2xl bg-slate-50"
          />
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Nếu tổng giờ làm vượt mốc giờ cần làm thì phần vượt được cộng theo lương OT / giờ.
          </div>
        </div>
      ) : (
        <div className="max-w-md">
          <InputMoney
            label="Lương theo giờ"
            value={values.hourlyRate}
            set={(value) => onChange({ hourlyRate: value })}
            className="h-11 rounded-2xl"
          />
        </div>
      )}

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center justify-between gap-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
          <div>
            <div className="font-semibold text-slate-900">Chuyên cần hồ sơ</div>
            <p className="mt-1 text-sm text-slate-500">
              Lưu cấu hình thưởng chuyên cần để dùng lại khi tạo kỳ lương mới.
            </p>
          </div>
          <input
            type="checkbox"
            checked={values.attendanceBonusEnabled}
            onChange={(event) =>
              onChange({
                attendanceBonusEnabled: event.target.checked,
                attendanceBonusDays: event.target.checked
                  ? values.attendanceBonusDays
                  : 0,
                attendanceBonusAmount: event.target.checked
                  ? values.attendanceBonusAmount
                  : 0,
              })
            }
            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
        </label>

        {values.attendanceBonusEnabled ? (
          <div className="mt-4 grid gap-4 rounded-[20px] border border-emerald-200 bg-emerald-50/60 p-4 md:grid-cols-[1fr_1fr]">
            <Input
              type="number"
              label="Mốc trừ chuyên cần (ngày nghỉ)"
              value={values.attendanceBonusDays || ""}
              onChange={(event) =>
                onChange({
                  attendanceBonusDays: Number(event.target.value) || 0,
                })
              }
              className="h-11 rounded-2xl bg-white text-right"
            />
            <InputMoney
              label="Thưởng chuyên cần"
              value={values.attendanceBonusAmount}
              set={(value) => onChange({ attendanceBonusAmount: value })}
              className="h-11 rounded-2xl bg-white"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Phụ cấp hồ sơ</div>
            <p className="text-xs text-slate-500">
              Thiết lập phụ cấp cho nhân viên theo kỳ 1, kỳ 2 hoặc tất cả.
            </p>
          </div>
          <Button
            variant="outline"
            className="inline-flex items-center gap-2 rounded-2xl border-dashed"
            onClick={() =>
              onChange({
                allowances: [
                  ...(values.allowances || []),
                  { name: "", amount: 0, period: "all" },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" /> Thêm phụ cấp
          </Button>
        </div>

        {(!values.allowances || values.allowances.length === 0) ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            Chưa có phụ cấp nào.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {values.allowances.map((allowance, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-[1.5fr,140px,130px,44px]"
              >
                <Input
                  value={allowance.name}
                  onChange={(event) =>
                    onChange({
                      allowances: values.allowances.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, name: event.target.value }
                          : item
                      ),
                    })
                  }
                  placeholder="Tên phụ cấp"
                  className="h-11 rounded-2xl"
                />
                <InputMoney
                  label="Số tiền"
                  value={allowance.amount}
                  set={(value) =>
                    onChange({
                      allowances: values.allowances.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, amount: value }
                          : item
                      ),
                    })
                  }
                  className="h-11 rounded-2xl"
                />
                <select
                  value={allowance.period || "all"}
                  onChange={(event) =>
                    onChange({
                      allowances: values.allowances.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              period: event.target.value as EmployeeAllowance['period'],
                            }
                          : item
                      ),
                    })
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="all">Tất cả</option>
                  <option value="1">Kỳ 1</option>
                  <option value="2">Kỳ 2</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-2xl text-rose-500 hover:bg-rose-50"
                  onClick={() =>
                    onChange({
                      allowances: values.allowances.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
