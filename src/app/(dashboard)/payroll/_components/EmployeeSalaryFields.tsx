"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MultiSelectBox } from "@/components/ui/MultiSelectBox";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { Employee, EmployeeAllowance, getEmployeeRoleNames } from "@/services/employees";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmployeeSalaryFormValues = {
  employeeCode: string;
  name: string;
  role: string;
  roles: string[];
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
  const roles = getEmployeeRoleNames(employee);

  return {
    employeeCode: employee?.employeeCode || "",
    name: employee?.name || "",
    role: roles[0] || defaultRole,
    roles: roles.length > 0 ? roles : [defaultRole],
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
    role: values.roles[0] || values.role,
    roles: values.roles.length > 0 ? values.roles : [values.role],
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

export function validateEmployeeSalaryForm(
  values: EmployeeSalaryFormValues,
  { autoEmployeeCode = false } = {},
) {
  if (!autoEmployeeCode && !values.employeeCode.trim()) {
    return "Vui lòng nhập mã nhân viên.";
  }
  if (!values.name.trim()) {
    return "Vui lòng nhập tên nhân viên.";
  }

  if (values.roles.length === 0) {
    return "Vui lòng chọn ít nhất một vai trò.";
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
  multipleRoles = false,
  autoEmployeeCode = false,
}: {
  roleGroups: Record<string, string[]>;
  values: EmployeeSalaryFormValues;
  onChange: (changes: Partial<EmployeeSalaryFormValues>) => void;
  className?: string;
  multipleRoles?: boolean;
  autoEmployeeCode?: boolean;
}) {
  const isMonthly = values.salaryType === "monthly";
  const roleOptions: SelectBoxOption<string>[] = Object.entries(roleGroups).flatMap(
    ([group, roles]) =>
      roles.map((role) => ({ value: role, label: role, group })),
  );
  const allowancePeriodOptions: SelectBoxOption<"all" | "1" | "2">[] = [
    { value: "all", label: "Tất cả các kỳ" },
    { value: "1", label: "Kỳ 1" },
    { value: "2", label: "Kỳ 2" },
  ];

  return (
    <div className={cn("space-y-6", className)}>
      <section className="space-y-4" aria-labelledby="employee-basic-info">
        <div>
          <h4 id="employee-basic-info" className="text-sm font-semibold text-slate-950">
            Thông tin nhân viên
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Mã nhân viên, tên hiển thị và các vai trò có thể đảm nhiệm.
          </p>
        </div>
        <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Mã nhân viên (EnNo)
          </label>
          <Input
            value={values.employeeCode}
            onChange={(event) => onChange({ employeeCode: event.target.value })}
            readOnly={autoEmployeeCode}
            aria-label="Mã nhân viên (EnNo)"
            placeholder={autoEmployeeCode ? "Tự động tạo khi lưu" : "Ví dụ: 00125"}
            className="h-10 rounded-md"
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
            className="h-10 rounded-md"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Vai trò
          </label>
          {multipleRoles ? (
            <MultiSelectBox
              values={values.roles}
              options={roleOptions}
              onValuesChange={(roles) =>
                onChange({ roles, role: roles[0] || "" })
              }
              ariaLabel="Chọn các vai trò nhân viên"
              searchThreshold={7}
              className="w-full"
              triggerClassName="shadow-none hover:bg-emerald-50/40"
            />
          ) : (
            <SelectBox
              value={values.role}
              options={roleOptions}
              onValueChange={(role) => onChange({ role, roles: [role] })}
              ariaLabel="Chọn vai trò nhân viên"
              searchable
              searchThreshold={7}
              searchPlaceholder="Tìm vai trò..."
              className="w-full"
              triggerClassName="h-10 rounded-md border-slate-200 bg-white shadow-none hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:ring-emerald-500"
            />
          )}
          {multipleRoles ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Vai trò đầu tiên là vai trò chính dùng trong bảng lương.
            </p>
          ) : null}
        </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Hình thức lương
            </span>
            <label className="flex h-10 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
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
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 shadow-inner transition-colors duration-200 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-[0_2px_5px_rgba(15,23,42,0.24)] after:transition-transform after:duration-200 peer-checked:bg-[linear-gradient(135deg,#123d2b_0%,#1d5a3a_100%)] peer-checked:after:translate-x-5 peer-checked:after:bg-[linear-gradient(135deg,#fff0ad_0%,#d99b2b_58%,#ffe48f_100%)] peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Lương tháng</div>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="employee-salary-info">
        <div>
          <h4 id="employee-salary-info" className="text-sm font-semibold text-slate-950">
            Cấu hình lương
          </h4>
        </div>
        {isMonthly ? (
        <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-2">
          <InputMoney
            label="Lương tháng"
            value={values.monthlySalary}
            set={(value) => onChange({ monthlySalary: value })}
            className="h-10 rounded-md bg-slate-50"
          />
          <Input
            type="number"
            label="Số ngày phải đi làm trong tháng"
            value={values.expectedWorkDays || ""}
            onChange={(event) =>
              onChange({ expectedWorkDays: Number(event.target.value) || 0 })
            }
            className="h-10 rounded-md bg-slate-50 text-right"
          />
          <Input
            type="number"
            label="Nghỉ phép được tính lương"
            value={values.paidLeaveDays || ""}
            onChange={(event) =>
              onChange({ paidLeaveDays: Number(event.target.value) || 0 })
            }
            className="h-10 rounded-md bg-slate-50 text-right"
          />
          <Input
            type="number"
            label="Số giờ cần làm"
            value={values.standardHours || ""}
            onChange={(event) =>
              onChange({ standardHours: Number(event.target.value) || 0 })
            }
            className="h-10 rounded-md bg-slate-50 text-right"
          />
          <InputMoney
            label="Lương OT / giờ"
            value={values.hourlyRate}
            set={(value) => onChange({ hourlyRate: value })}
            className="h-10 rounded-md bg-slate-50"
          />
          <div className="flex min-h-[64px] items-center rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-600 md:self-end">
            Nếu tổng giờ làm vượt mốc giờ cần làm thì phần vượt được cộng theo lương OT / giờ.
          </div>
        </div>
      ) : (
        <div className="grid items-end gap-x-5 gap-y-3 md:grid-cols-2">
          <InputMoney
            label="Lương theo giờ"
            value={values.hourlyRate}
            set={(value) => onChange({ hourlyRate: value })}
            className="h-10 rounded-md"
          />
          <div className="flex min-h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm leading-4 text-slate-600 md:h-10 md:py-0">
            Tiền lương được tính theo tổng số giờ làm hợp lệ trong kỳ.
          </div>
        </div>
      )}
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="employee-attendance-info">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
          <div>
            <div id="employee-attendance-info" className="text-sm font-semibold text-slate-900">Thưởng chuyên cần</div>
            <p className="mt-1 text-xs text-slate-500">
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
          <div className="mt-4 grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 md:grid-cols-[1fr_1fr]">
            <Input
              type="number"
              label="Mốc trừ chuyên cần (ngày nghỉ)"
              value={values.attendanceBonusDays || ""}
              onChange={(event) =>
                onChange({
                  attendanceBonusDays: Number(event.target.value) || 0,
                })
              }
              className="h-10 rounded-md bg-white text-right"
            />
            <InputMoney
              label="Thưởng chuyên cần"
              value={values.attendanceBonusAmount}
              set={(value) => onChange({ attendanceBonusAmount: value })}
              className="h-10 rounded-md bg-white"
            />
          </div>
        ) : null}
      </section>

      <section className="border-t border-slate-200 pt-5" aria-labelledby="employee-allowance-info">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div id="employee-allowance-info" className="text-sm font-semibold text-slate-900">Phụ cấp hồ sơ</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 rounded-md border-dashed text-sm"
            onClick={() =>
              onChange({
                allowances: [
                  ...(values.allowances || []),
                  { name: "", amount: 0, period: "all" },
                ],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Thêm phụ cấp
          </Button>
        </div>

        {(!values.allowances || values.allowances.length === 0) ? (
          <div className="mt-3 border-l-2 border-slate-200 px-3 py-2 text-sm text-slate-500">
            Chưa có phụ cấp nào.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {values.allowances.map((allowance, index) => (
              <div
                key={index}
                className="grid items-end gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1.5fr)_minmax(150px,0.8fr)_minmax(150px,0.7fr)_44px]"
              >
                <Input
                  label="Tên phụ cấp"
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
                  className="h-10 rounded-md"
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
                  className="h-10 rounded-md"
                />
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Áp dụng</label>
                  <SelectBox
                    value={allowance.period || "all"}
                    options={allowancePeriodOptions}
                    onValueChange={(period) =>
                      onChange({
                        allowances: values.allowances.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, period } : item,
                        ),
                      })
                    }
                    ariaLabel="Chọn kỳ áp dụng phụ cấp"
                    className="w-full"
                    triggerClassName="h-10 rounded-md border-slate-200 bg-white shadow-none"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-11 rounded-md text-rose-500 hover:bg-rose-50"
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
      </section>
    </div>
  );
}
